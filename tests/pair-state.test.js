// P03 mode vocabulary and release forecast, checked against connections the
// engine actually produces rather than hand-written fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault } from '../server/engine.js';
import { pairMode, releaseForecast } from '../src/components/pairState.js';

test('UX-021: wireless cooperation reports CROSS-LINK semantics with no latch', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 60);
  const link = run.connections.find(c => c.mode === 'C1');
  assert.ok(link, 'a wireless connection exists');
  assert.equal(link.status, 'ACTIVE', 'caught while the service is live');
  assert.equal(pairMode(link), 'WIRELESS');
  assert.equal(link.mechanicalState, 'SEPARATE', 'a cross-link never latches');
  assert.equal(link.powerState, 'ISOLATED', 'and carries no direct electrical path');
  const forecast = releaseForecast(link);
  assert.equal(forecast.status, 'NOT_APPLICABLE');
  assert.equal(forecast.at, null);
});

test('UX-023: a captured pair reports a physical mode and a feasible release ETA', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 800);
  const link = run.connections[0];
  assert.equal(link.mechanicalState, 'CAPTURED');
  assert.ok(['DIRECT_LINK', 'SYMBIOTIC', 'MECHANICAL', 'INTEGRATED'].includes(pairMode(link)),
    `expected a physical mode, got ${pairMode(link)}`);
  const forecast = releaseForecast(link);
  assert.equal(forecast.status, 'ETA');
  assert.ok(forecast.safe && forecast.at > run.time - 1, 'the ETA is a real forward time');
  assert.ok(link.combinedInertiaKgm2?.length === 3 && link.controlMarginNm > 0,
    'coupled inertia and control margin are available to display');
});

test('UX-026: losing release authority mid-bond withdraws the ETA and keeps the pair coupled', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 800);
  assert.equal(releaseForecast(run.connections[0]).status, 'ETA', 'an ETA was held before the fault');
  injectFault(run, { commandId: 'pair-actuator', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-wheel', modelId: 'F-08' });
  advance(run, 5);
  const link = run.connections[0];
  const forecast = releaseForecast(link);
  assert.equal(forecast.status, 'NOT_SAFE');
  assert.equal(forecast.safe, false);
  assert.ok(forecast.reason.length > 0, 'and gives a grounded reason');
  assert.equal(pairMode(link), 'TERMINATING', 'an aborted but captured pair is terminating, not separate');
});

test('a finished cross-link reports SEPARATE, since the pair is no longer coupled', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 120);
  const link = run.connections[0];
  assert.equal(link.status, 'COMPLETED');
  assert.equal(pairMode(link), 'SEPARATE');
});

test('no connection degrades to SEPARATE and NOT DETERMINED', () => {
  assert.equal(pairMode(null), 'SEPARATE');
  assert.equal(pairMode(undefined), 'SEPARATE');
  assert.equal(releaseForecast(null).status, 'NOT_DETERMINED');
});
