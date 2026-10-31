// Condition-threshold triggers with persistence and hysteresis, and the
// propellant cost of a separation impulse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault } from '../server/engine.js';

const arm = (run, trigger, over = {}) => injectFault(run, {
  commandId: 'arm-' + Math.random(), expectedRevision: run.revision,
  spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01',
  duration: 'TRANSIENT', parameters: { effect: 'degraded', durationS: 86400 }, trigger, ...over,
});

test('a threshold trigger holds fire until its persistence window elapses', () => {
  const run = makeRun({ seed: 20261029, faultMode: 'HYBRID' });
  // The reference vehicle sits at its thermal equilibrium of 310 K, so a 309 K
  // threshold is met from the start and only the persistence window delays it.
  arm(run, { signal: 'temperatureK', above: 309, persistenceS: 30 });
  const watch = run.thresholdWatches[0];
  assert.equal(watch.state, 'ARMED');
  assert.ok(run.events.some(e => e.type === 'THRESHOLD_ARMED'));

  advance(run, 25);
  assert.equal(run.thresholdWatches[0].state, 'ARMED', 'not fired before the window closes');

  advance(run, 10);
  assert.equal(run.thresholdWatches[0].state, 'TRIPPED', 'fires once the condition is sustained');
  assert.ok(run.time >= 30 && run.time <= 36, `tripped at T+${run.time}, expected just after the 30 s window`);
  const tripped = run.events.find(e => e.type === 'THRESHOLD_TRIPPED');
  assert.ok(tripped, 'and says so in the timeline');
  assert.ok(run.faults.some(f => f.origin === 'THRESHOLD' && f.status === 'ACTIVE'), 'a real fault was applied');
});

test('hysteresis releases and re-arms the watch', () => {
  const run = makeRun({ seed: 20261029, faultMode: 'HYBRID' });
  arm(run, { signal: 'temperatureK', above: 309, persistenceS: 5, releaseBelow: 306, releaseForS: 10 });
  advance(run, 20);
  assert.equal(run.thresholdWatches[0].state, 'TRIPPED');

  // Cool the node below the release band; the thermal model pulls it back toward
  // 310 K only slowly, so it stays clear across the release window.
  run.spacecraft[0].temperatureK = 305;
  advance(run, 20);
  const watch = run.thresholdWatches[0];
  assert.equal(watch.state, 'ARMED', 're-armed after the release window');
  assert.equal(watch.faultId, null);
  assert.ok(run.events.some(e => e.type === 'THRESHOLD_RELEASED'));
});

test('a threshold trigger validates its signal and its release path', () => {
  const run = makeRun({ seed: 20261029, faultMode: 'HYBRID' });
  assert.throws(() => arm(run, { signal: 'nonsense', above: 1 }), { code: 'INVALID_PARAMETER' });
  assert.throws(() => arm(run, { signal: 'temperatureK' }), { code: 'INVALID_PARAMETER' });
  assert.throws(() => injectFault(run, { commandId: 'perm', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01', duration: 'PERMANENT',
    trigger: { signal: 'temperatureK', above: 320, releaseForS: 10 } }), { code: 'INVALID_PARAMETER' });
});

test('separation spends propellant for its commanded impulse', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 800);
  const before = run.spacecraft[0].propellantKg;
  assert.equal(run.connections[0].mechanicalState, 'CAPTURED');

  advance(run, 1000);
  const link = run.connections[0];
  assert.equal(link.mechanicalState, 'RELEASED', 'the pair separated');
  assert.ok(link.separationPropellantKg > 0, 'the impulse has a propellant cost');
  assert.equal(link.separationDeltaVMps, 0.02);
  assert.ok(run.spacecraft[0].propellantKg < before, 'and it was actually debited');
  assert.ok(run.ledger.some(r => r.destination === 'separation-impulse' && r.deltaVMps === 0.02),
    'the impulse is recorded in the ledger with its delta-v');
});
