// Graph Trend's data contract: the telemetry layer records only what the kernel
// holds, says plainly what it does not model, and stays consistent with the
// event log and the resource ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault, checkpoint, restoreCheckpoint, exportRun, importRun, telemetryCatalog, telemetrySeries } from '../server/engine.js';

const seriesOf = (run, key) => telemetrySeries(run, [key])[0];

test('telemetry records against the authoritative clock', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029 });
  advance(run, 300);
  const soc = seriesOf(run, 'SAT-A|battery.stateOfChargePct');
  assert.ok(soc.available && soc.points.length > 1, 'samples were recorded');
  assert.equal(soc.unit, '%');
  assert.equal(soc.classification, 'CALCULATED');
  for (const [time] of soc.points) assert.ok(time >= 0 && time <= run.time, `sample at T+${time} is outside the run`);
  const times = soc.points.map(p => p[0]);
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'samples are time-ordered');
});

test('a paused run generates no artificial history', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029 });
  advance(run, 300);
  const before = seriesOf(run, 'SAT-A|battery.storedEnergyWh').points.length;
  const timeBefore = run.time;
  // Advancing by zero is what a paused tick amounts to: the clock does not move.
  advance(run, 0);
  assert.equal(run.time, timeBefore);
  assert.equal(seriesOf(run, 'SAT-A|battery.storedEnergyWh').points.length, before,
    'no samples were appended while the clock stood still');
});

test('unmodelled parameters are declared, never fabricated', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029 });
  advance(run, 120);
  const catalog = telemetryCatalog(run);
  const unsupported = catalog.parameters.filter(p => !p.supported);
  assert.ok(unsupported.length > 0, 'the catalog declares what it does not model');
  for (const parameter of unsupported) assert.equal(parameter.classification, 'NOT_MODELLED');
  for (const id of ['battery.voltageV', 'compute.utilisationPct', 'comms.signalStrengthDbm', 'adcs.attitudeErrorDeg']) {
    const entry = seriesOf(run, `SAT-A|${id}`);
    assert.equal(entry.available, false, `${id} must not produce a series`);
    assert.equal(entry.reason, 'NOT_MODELLED');
    assert.equal(entry.points.length, 0);
  }
});

test('fault markers in the series line up with the event log', () => {
  const run = makeRun({ scenarioId: 'VEIL-REF-01', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 60);
  injectFault(run, { commandId: 'tel-fault', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01' });
  advance(run, 60);

  const faultEvent = run.events.find(e => e.type === 'FAULT_ACTIVE');
  assert.ok(faultEvent, 'the fault actually fired');
  const quality = seriesOf(run, 'SAT-A|compute.qualityFraction');
  const sampleAtFault = quality.points.find(([t]) => Math.abs(t - faultEvent.time) < 1e-6);
  assert.ok(sampleAtFault, 'an event-driven sample exists at the fault timestamp');

  // The physical effect is visible in the recorded series, not just the log.
  assert.equal(quality.stats.min, 0, 'compute quality actually fell');
  assert.equal(quality.points[0][1], 1, 'and started healthy');
});

test('a fault injection does not imply diagnosis in the observed series', () => {
  const run = makeRun({ scenarioId: 'VEIL-REF-01', seed: 20261029, faultMode: 'HYBRID' });
  injectFault(run, { commandId: 'tel-hidden', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-monitor', modelId: 'F-12', parameters: { effect: 'freeze' } });
  advance(run, 10);
  injectFault(run, { commandId: 'tel-cpu', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01' });
  advance(run, 40);

  const truth = seriesOf(run, 'SAT-A-alpha|component.healthOrdinal');
  const observed = seriesOf(run, 'SAT-A-alpha|component.observedHealthOrdinal');
  assert.equal(truth.stats.min, 0, 'physical health failed');
  assert.ok(observed.stats.min > 0, 'the observed series never reports the hidden failure');
});

test('transfer series agree with the resource ledger', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 900);
  const link = run.connections[0];
  const exported = seriesOf(run, `${link.id}|cooperation.exportedWh`);
  assert.ok(exported.available && exported.stats.max > 0, 'energy actually moved');

  const ledgerExported = run.ledger.filter(r => r.type === 'power_transfer').reduce((sum, r) => sum + r.amount, 0);
  assert.ok(Math.abs(exported.stats.max - ledgerExported) < 1e-6,
    `series max ${exported.stats.max} should match ledger total ${ledgerExported}`);

  // The exchange has two sides. The donor is in sunlight and nets positive over
  // this window, so its stored energy still rises; the honest comparison is
  // against the same run with cooperation disabled.
  const received = seriesOf(run, `${link.id}|cooperation.receivedWh`);
  const loss = seriesOf(run, `${link.id}|cooperation.lossWh`);
  assert.ok(Math.abs(exported.stats.max - (received.stats.max + loss.stats.max)) < 1e-6,
    'exported equals received plus loss in the recorded series');

  const independent = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID', policyId: 'B0' });
  advance(independent, 900);
  const donorWithTransfer = seriesOf(run, 'SAT-B|battery.storedEnergyWh').stats.current;
  const donorAlone = seriesOf(independent, 'SAT-B|battery.storedEnergyWh').stats.current;
  assert.ok(donorWithTransfer < donorAlone,
    `donating should leave less stored energy: ${donorWithTransfer} vs ${donorAlone} when independent`);
});

test('restoring a checkpoint rewinds history to that instant', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029 });
  advance(run, 300);
  const point = checkpoint(run, 'telemetry-rewind');
  const atCheckpoint = seriesOf(run, 'SAT-A|battery.storedEnergyWh').points.length;
  advance(run, 300);
  assert.ok(seriesOf(run, 'SAT-A|battery.storedEnergyWh').points.length > atCheckpoint, 'history grew');

  restoreCheckpoint(run, run.checkpoints.find(c => c.id === point.id));
  const after = seriesOf(run, 'SAT-A|battery.storedEnergyWh');
  assert.ok(after.points.every(([t]) => t <= run.time + 1e-9), 'no sample sits in the future');
  assert.equal(after.points.length, atCheckpoint, 'history is back to the checkpoint depth');
});

test('deterministic replay reproduces the same trends', () => {
  const original = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(original, 200);
  const replay = importRun(exportRun(original));
  advance(original, 300);
  advance(replay, 300);

  for (const key of ['SAT-A|battery.storedEnergyWh', 'SAT-A|thermal.temperatureK', 'SAT-A|compute.qualityFraction']) {
    const a = seriesOf(original, key), b = seriesOf(replay, key);
    assert.deepEqual(b.points, a.points, `${key} differs between the run and its replay`);
  }
});

test('series are bounded so history cannot grow without limit', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, sampleIntervalS: 1, telemetryMaxPoints: 50 });
  advance(run, 400);
  const entry = seriesOf(run, 'SAT-A|battery.storedEnergyWh');
  assert.ok(entry.points.length <= 50, `expected at most 50 retained points, got ${entry.points.length}`);
  assert.ok(run.telemetry.droppedPoints > 0, 'and the run reports what aged out');
});

test('the catalog describes components and links the workspace can select', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 900);
  const catalog = telemetryCatalog(run);
  assert.equal(catalog.spacecraft.length, 2);
  const sat = catalog.spacecraft[0];
  assert.ok(sat.components.some(c => c.modelled), 'modelled components are offered');
  assert.ok(sat.components.some(c => !c.modelled), 'catalog-only hardware is marked unmodelled');
  assert.ok(catalog.connections.length >= 1, 'the cooperation link is selectable');
  assert.ok(catalog.series.length > 0 && catalog.sampleCount > 0);
});
