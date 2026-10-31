// Regression cover for the M02/M06 boundary and the stored-energy audit.
// These hold the properties that P1 fixed: agents decide on observations only,
// stored energy closes across the whole run, and recovery time is attributed to
// the fault the contract was actually planned against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault, plan } from '../server/engine.js';
import { agentView, candidate, planningContext, viewPriority } from '../server/planner.js';

const make = (options = {}) => makeRun({ scenarioId: 'VEIL-REF-01', seed: 20261029, faultMode: 'HYBRID', ...options });
const componentOf = (sat, key) => sat.components.find(c => c.id === `${sat.id}-${key}`);

test('SYS-10: the agent view exposes no physical truth field', () => {
  const run = make();
  advance(run, 5);
  const sat = run.spacecraft[0];
  // Diverge truth from observation on every channel the view could leak.
  sat.health = 'FAILED';
  componentOf(sat, 'alpha').health = 'FAILED';
  sat.temperatureK = 400;
  sat.mission.quality = 0;
  const view = agentView(run, sat);
  assert.notEqual(view.observedHealth, 'FAILED', 'truth health must not reach the view');
  assert.equal(view.computeQuality, 1, 'observed compute quality must ignore truth component health');
  assert.notEqual(view.temperatureK, 400, 'the view carries the observed temperature, not the physical one');
  assert.equal(view.mission.quality, 1, 'mission quality must be derived from observed payload health');
  assert.ok(!('components' in view) && !('orbit' in view === false), 'the view is a projection, not the record');
});

test('SYS-10: planner geometry uses the navigation estimate, not the true position', () => {
  const run = make({ scenarioId: 'E2' });
  advance(run, 30);
  const sat = run.spacecraft[0];
  componentOf(sat, 'nav').observedHealth = 'FAILED';
  advance(run, 2);
  const lastFix = [...sat.navPosition];
  sat.position = [9e7, 9e7, 9e7];
  advance(run, 2);
  const view = agentView(run, sat);
  assert.deepEqual(view.position, lastFix, 'the view holds the last valid fix');
  assert.notEqual(view.position[0], sat.position[0], 'truth moved and the view did not follow');
});

test('SYS-10: frozen monitoring keeps a hidden failure out of the decision', () => {
  const run = make();
  injectFault(run, { commandId: 'freeze', expectedRevision: run.revision, spacecraftId: 'SAT-A', componentId: 'SAT-A-monitor', modelId: 'F-12', parameters: { effect: 'freeze' } });
  advance(run, 10);
  const sat = run.spacecraft[0];
  const before = agentView(run, sat).computeQuality;
  sat.components.find(c => c.id === 'SAT-A-alpha').health = 'FAILED';
  advance(run, 10);
  assert.equal(agentView(run, sat).computeQuality, before, 'an unobserved physical failure cannot change the agent view');
});

test('candidate() is pure over its context and views', () => {
  const run = make();
  advance(run, 5);
  const ctx = planningContext(run);
  const a = agentView(run, run.spacecraft[0]);
  const b = agentView(run, run.spacecraft[1]);
  const first = candidate(ctx, a, b, 'C1', viewPriority(b, run.time));
  const second = candidate(ctx, a, b, 'C1', viewPriority(b, run.time));
  assert.deepEqual(first, second, 'same inputs produce the same candidate');
  assert.equal(typeof first.score === 'number' || first.score === null, true);
});

test('stored energy closes across the run, and an unaccounted change is detected', () => {
  const clean = makeRun({ scenarioId: 'E2', seed: 20261029 });
  advance(clean, 900);
  assert.ok(clean.metrics.energyExportedWh > 0, 'the scenario actually transferred power');
  assert.ok(clean.metrics.conservationWorstResidualWh < 1e-9,
    `clean run drifted ${clean.metrics.conservationWorstResidualWh} Wh`);

  const tampered = makeRun({ scenarioId: 'E2', seed: 20261029 });
  advance(tampered, 60);
  tampered.spacecraft[0].energyWh += 5;
  advance(tampered, 5);
  assert.ok(Math.abs(tampered.metrics.conservationWorstResidualWh - 5) < 1e-6, 'the audit measures the injected quantity');
  assert.ok(tampered.events.some(e => e.type === 'CONSERVATION_RESIDUAL'), 'and raises an event');
});

test('capacity reclassification does not register as a conservation failure', () => {
  const run = make();
  injectFault(run, { commandId: 'battery', expectedRevision: run.revision, spacecraftId: 'SAT-A', componentId: 'SAT-A-battery', modelId: 'F-04' });
  advance(run, 400);
  assert.equal(run.spacecraft[0].capacityWh, 96, 'the battery fault actually downgraded usable capacity');
  assert.ok(run.metrics.conservationWorstResidualWh < 1e-9, 'the declared reclamation path is accounted');
});

test('recovery time is attributed to the fault the contract was planned for', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 150);
  assert.equal(run.spacecraft[0].mission.status, 'ASSISTED');
  const decision = run.decisions.find(d => d.chosenMode !== 'C0');
  assert.ok(decision?.causeFaultId, 'the decision records the fault that triggered it');
  const cause = run.faults.find(f => f.id === decision.causeFaultId);
  const verified = run.events.find(e => e.type === 'MISSION_VERIFIED');
  assert.ok(Number.isFinite(run.metrics.recoveryTimeS), 'a recovery time was measured');
  // Measured at verification, from the detection of the fault this contract addressed.
  assert.ok(Math.abs(run.metrics.recoveryTimeS - (verified.time - cause.detectedS)) < 1e-6,
    'recovery time spans fault detection to verification, not time zero to now');
  assert.ok(run.metrics.recoveryTimeS < run.time, 'and is not the whole elapsed run');
});

test('named RNG streams are checkpointed and reproduce the hazard schedule', () => {
  const a = makeRun({ scenarioId: 'E1', seed: 4242, hazardPerNodeHour: 0.05 });
  const b = makeRun({ scenarioId: 'E1', seed: 4242, hazardPerNodeHour: 0.05 });
  assert.deepEqual(a.rngStreams, b.rngStreams, 'streams start from the same seed');
  assert.ok(Number.isInteger(a.rngStreams.hazard) && Number.isInteger(a.rngStreams.scenario));
  advance(a, 86400);
  advance(b, 86400);
  const schedule = run => run.faults.filter(f => f.origin === 'STOCHASTIC').map(f => `${f.scheduledS.toFixed(3)}:${f.componentId}`).join('|');
  assert.equal(schedule(a), schedule(b), 'the hazard stream is deterministic for a seed');
  assert.notEqual(a.rngStreams.hazard, 4242, 'the hazard stream actually advanced');
});

test('matched policies share one exogenous incident schedule', () => {
  const schedules = ['B0', 'B1', 'B2', 'B3'].map(policyId => {
    const run = makeRun({ scenarioId: 'E1', seed: 20261029, policyId, hazardPerNodeHour: 0.05 });
    advance(run, 86400);
    return run.faults.filter(f => f.origin === 'STOCHASTIC').map(f => `${f.scheduledS.toFixed(3)}:${f.componentId}`).join('|');
  });
  assert.ok(schedules[0].length > 0, 'the fixture actually produced incidents');
  for (const other of schedules.slice(1)) assert.equal(other, schedules[0], 'policies must not perturb exogenous incidents');
});

test('the decision record carries the weights and normalization the UI renders', () => {
  const run = make();
  injectFault(run, { commandId: 'cpu', expectedRevision: run.revision, spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01' });
  advance(run, 10);
  const decision = run.decisions.at(-1);
  assert.deepEqual(Object.keys(decision.weights).sort(), ['benefit', 'cost', 'donor', 'risk', 'time']);
  const total = Object.values(decision.weights).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights must sum to 1, got ${total}`);
  assert.ok(decision.normalization.timeHorizonS > 0 && decision.normalization.qualityRequired > 0);
});
