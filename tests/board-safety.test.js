import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, injectFault, advance, snapshot } from '../server/engine.js';

function inject(run, key = 'alpha', modelId = 'F-01', parameters = {}, duration = 'PERMANENT') {
  return injectFault(run, { commandId: `safety-${run.revision}`, expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: `SAT-A-${key}`, modelId, parameters, duration });
}
const executive = state => state.spacecraft[0].boardSafety.find(board => board.componentIds.includes('SAT-A-alpha'));
const observedExecutive = state => state.spacecraft[0].observedBoardSafety.find(board => board.componentIds.includes('SAT-A-alpha'));

test('board safety reflects manual failure, watchdog timeout and later observation without revealing hidden health', () => {
  const run = makeRun({ faultMode: 'MANUAL' });
  assert.equal(executive(snapshot(run)).overall, 'OK');
  inject(run);
  let state = snapshot(run);
  assert.equal(executive(state).health, 'FAILED');
  assert.equal(executive(state).watchdog.status, 'WARNING');
  assert.equal(observedExecutive(state).health, 'OPERATIONAL');
  advance(run, 6);
  state = snapshot(run);
  assert.equal(executive(state).watchdog.status, 'ALARM');
  assert.equal(observedExecutive(state).health, 'FAILED');
  assert.equal(observedExecutive(state).watchdog.status, 'ALARM');
  assert.equal(observedExecutive(state).activeFaultCount, 1);
});

test('automatic scenario faults, degraded components and transient recovery update safety tables', () => {
  const automatic = makeRun({ scenarioId: 'E1', faultMode: 'AUTOMATIC', hazardPerNodeHour: 0 });
  advance(automatic, 26);
  assert.equal(observedExecutive(snapshot(automatic)).overall, 'ALARM');
  const run = makeRun({ faultMode: 'MANUAL' });
  inject(run, 'alpha', 'F-01', { effect: 'degraded', durationS: 10 }, 'TRANSIENT');
  advance(run, 6);
  assert.equal(observedExecutive(snapshot(run)).health, 'DEGRADED');
  assert.equal(observedExecutive(snapshot(run)).overall, 'WARNING');
  assert.equal(observedExecutive(snapshot(run)).watchdog.status, 'OK');
  advance(run, 4);
  assert.equal(executive(snapshot(run)).overall, 'OK');
  assert.equal(observedExecutive(snapshot(run)).health, 'OPERATIONAL');
});

test('board guards show depletion, dependencies and stale monitoring instead of unconditional OK', () => {
  const power = makeRun({ faultMode: 'MANUAL' });
  power.spacecraft[0].energyWh = 0;
  assert.equal(executive(snapshot(power)).power.status, 'ALARM');
  assert.equal(executive(snapshot(power)).watchdog.status, 'ALARM');
  assert.equal(executive(snapshot(power)).watchdog.lastHeartbeatAt, null);
  const unknownPower = makeRun({ faultMode: 'MANUAL' });
  unknownPower.spacecraft[0].lastObservedEnergyWh = undefined;
  assert.equal(observedExecutive(snapshot(unknownPower)).power.status, 'UNKNOWN');
  assert.equal(observedExecutive(snapshot(unknownPower)).watchdog.status, 'UNKNOWN');
  assert.equal(observedExecutive(snapshot(unknownPower)).watchdog.lastHeartbeatAt, null);
  const dependent = makeRun({ faultMode: 'MANUAL' });
  inject(dependent, 'rail', 'F-02');
  assert.equal(executive(snapshot(dependent)).dependencies.status, 'ALARM');
  const frozen = makeRun({ faultMode: 'MANUAL' });
  inject(frozen, 'monitor', 'F-12', { effect: 'freeze' });
  advance(frozen, 7);
  const board = observedExecutive(snapshot(frozen));
  assert.equal(board.health, 'UNKNOWN');
  assert.equal(board.overall, 'UNKNOWN');
  assert.equal(board.watchdog.status, 'UNKNOWN');
  assert.equal(board.power.status, 'UNKNOWN');
  assert.equal(board.updatedAt, 0);
  assert.equal(board.watchdog.lastHeartbeatAt, 0);
});

test('specialist inventory never claims modeled safety and snapshot does not mutate the physical run', () => {
  const run = makeRun({ spacecraftCount: 6 });
  const before = JSON.stringify(run);
  const state = snapshot(run);
  assert.equal(JSON.stringify(run), before);
  for (const sat of state.spacecraft) {
    const inventory = sat.boardSafety.filter(board => !board.modeled);
    assert.equal(inventory.length, 2);
    for (const board of inventory) {
      assert.equal(board.health, 'UNKNOWN');
      assert.equal(board.overall, 'NOT_MODELED');
      assert.equal(board.watchdog.status, 'NOT_MODELED');
      assert.equal(board.updatedAt, null);
    }
  }
  assert.equal(state.faultEngine.eligibleComponents, 72);
  assert.equal(state.faultEngine.hazardPerNodeHour, 0.0002);
  assert.equal(state.faultEngine.scenarioFaultAt, null);
  assert.equal(snapshot(makeRun({ scenarioId: 'E1' })).faultEngine.scenarioFaultAt, 20);
});
