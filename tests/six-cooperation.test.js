import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault, plan, snapshot } from '../server/engine.js';

function clusteredRun(options = {}) {
  const run = makeRun({ scenarioId: 'VEIL-REF-01', spacecraftCount: 6, faultMode: 'MANUAL', ...options });
  const reference = run.spacecraft[0].orbit;
  for (let i = 1; i < run.spacecraft.length; i++) {
    run.spacecraft[i].orbit = { ...reference, phase: reference.phase + i * .0001 };
  }
  // Refresh positions after deliberately placing the fixture in mutual radio view.
  advance(run, 1);
  return run;
}
function processorFault(run, satId) {
  injectFault(run, { commandId: 'fault-' + satId, expectedRevision: run.revision,
    spacecraftId: satId, componentId: satId + '-alpha', modelId: 'F-01' });
}

test('six-spacecraft planner considers every peer and independent policy forbids crosslinks', () => {
  const run = clusteredRun({ policyId: 'B0' });
  assert.equal(snapshot(run).spacecraft.length, 6);
  for (const sat of run.spacecraft) {
    const decision = plan(run, sat.id);
    assert.equal(new Set(decision.candidates.filter(c => c.mode === 'C1').map(c => c.provider)).size, 5);
    assert.equal(decision.chosenMode, 'C0');
  }
  assert.equal(run.contracts.length, 0);
});

test('simultaneous recovery requests prioritize low reserve and reserve separate providers', () => {
  const run = clusteredRun();
  run.spacecraft[1].energyWh = 26;
  processorFault(run, 'SAT-A');
  processorFault(run, 'SAT-B');
  advance(run, 6);
  const [first, second] = run.decisions;
  assert.equal(first.spacecraftId, 'SAT-B');
  assert.equal(first.requesterPriority.level, 1);
  assert.equal(second.spacecraftId, 'SAT-A');
  assert.equal(second.requesterPriority.level, 2);
  assert.notEqual(first.chosenProvider, second.chosenProvider);
  const reserved = second.candidates.find(c => c.provider === first.chosenProvider && c.mode === 'C1');
  assert.equal(reserved.status, 'REJECTED');
  assert.ok(reserved.checks.some(c => c.reason === 'PEER_CAPACITY_RESERVED'));
});

test('equally feasible providers favor spare reserve, but hard reserve gates still win', () => {
  const run = clusteredRun();
  run.spacecraft[1].energyWh = 24.1;
  run.spacecraft[2].energyWh = 110;
  run.spacecraft[3].energyWh = 75;
  processorFault(run, 'SAT-A');
  advance(run, 6);
  const decision = run.decisions[0];
  assert.equal(decision.chosenProvider, 'SAT-C');
  const lowReserve = decision.candidates.find(c => c.provider === 'SAT-B' && c.mode === 'C1');
  assert.equal(lowReserve.status, 'REJECTED');
  assert.ok(lowReserve.checks.some(c => c.reason === 'DONOR_RESERVE_PROTECTED'));
  assert.ok(decision.candidates.find(c => c.provider === 'SAT-C' && c.mode === 'C1').providerPriority.energyMarginWh > 80);
});
