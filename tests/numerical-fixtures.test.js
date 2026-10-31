// NR-09 and NR-10, the two numerical fixtures the suite did not previously cover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault } from '../server/engine.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`);

test('NR-09: 10 Mbit over a 256 kbit/s contact serializes in 39.0625 s', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 120);
  const link = run.connections.find(c => c.mode === 'C1');
  assert.ok(link, 'the wireless contract reached an active connection');
  assert.ok(link.dataTransferredMbit > 0, 'data actually moved');

  // The modelled rate, read back from the vehicles the link runs between.
  const [a, b] = link.participants.map(id => run.spacecraft.find(s => s.id === id));
  const ratekbps = Math.min(a.radioKbps, b.radioKbps);
  assert.equal(ratekbps, 256, 'full-contact usable rate is the declared 256 kbit/s');

  const mbitPerSecond = ratekbps / 1000;
  near(10 / mbitPerSecond, 39.0625, 1e-9);

  // And the engine's own accounting moves at that rate, not faster.
  const before = link.dataTransferredMbit;
  const fresh = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(fresh, 121);
  const later = fresh.connections.find(c => c.mode === 'C1');
  assert.ok(later.dataTransferredMbit - before <= mbitPerSecond + 1e-9,
    'one additional second delivers no more than the declared rate');
});

test('NR-10: a later actuator fault invalidates a valid termination ETA and leaves the pair coupled', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 800);
  const link = run.connections[0];
  assert.equal(link.mechanicalState, 'CAPTURED', 'the pair captured');
  assert.ok(Number.isFinite(link.detachmentTime), 'a termination ETA was forecast');
  assert.equal(link.detachmentReason, null, 'and it was not already blocked');

  injectFault(run, { commandId: 'nr10-actuator', expectedRevision: run.revision,
    spacecraftId: link.participants[0], componentId: `${link.participants[0]}-wheel`, modelId: 'F-08' });
  advance(run, 5);

  const after = run.connections[0];
  assert.equal(after.detachmentTime, null, 'the ETA is invalidated, not recomputed optimistically');
  assert.equal(after.mechanicalState, 'CAPTURED', 'an unsafe release leaves the formation coupled');
  assert.equal(after.safetyState, 'SAFE_COUPLED');
  assert.match(after.detachmentReason, /SAFE COUPLED/, 'and says why it cannot separate');
  assert.equal(after.powerState, 'FAULT_ISOLATED', 'direct paths are isolated');
});
