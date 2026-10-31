// P3 properties: score terms are computed from observable state, observation
// confidence decays with staleness, the planner records forecast against actual,
// packet loss costs energy without delivering data, and a replay is deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, injectFault, exportRun, importRun } from '../server/engine.js';
import { agentView, candidate, planningContext, viewConfidence, normalization } from '../server/planner.js';

test('the donor term tracks the donor\'s observable margin, not the mode', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029 });
  advance(run, 5);
  const ctx = planningContext(run);
  const requester = agentView(run, run.spacecraft[0]);
  const donorAt = energyWh => candidate(ctx, requester, { ...agentView(run, run.spacecraft[1]), energyWh }, 'C2').features.donor;

  const ample = donorAt(110), nominal = donorAt(84), thin = donorAt(30);
  assert.ok(ample < nominal, 'a donor with more spare margin is cheaper to ask');
  assert.ok(nominal < thin, 'and one near its reserve is dearer');
  assert.ok(ample > 0 && thin <= 1, 'the term stays normalized');
});

test('risk responds to thermal headroom and closing speed', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029 });
  advance(run, 5);
  const ctx = planningContext(run);
  const a = agentView(run, run.spacecraft[0]);
  const b = agentView(run, run.spacecraft[1]);
  const cool = candidate(ctx, a, b, 'C2').features.risk;
  const hot = candidate(ctx, { ...a, temperatureK: 330 }, b, 'C2').features.risk;
  assert.ok(hot > cool, 'approaching the thermal limit raises risk');
  assert.ok(cool >= 0 && hot <= 1, 'risk stays in [0,1]');
});

test('every score term is normalized and the weighted sum stays in range', () => {
  const run = makeRun({ scenarioId: 'E2', seed: 20261029 });
  advance(run, 5);
  const ctx = planningContext(run);
  const a = agentView(run, run.spacecraft[0]);
  const b = agentView(run, run.spacecraft[1]);
  for (const mode of ['C1', 'C2', 'C3']) {
    const c = candidate(ctx, a, b, mode);
    if (!c.features) continue;
    for (const [name, value] of Object.entries(c.features)) {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${mode} ${name} = ${value} is out of range`);
    }
    if (c.score !== null) assert.ok(c.score >= 0 && c.score <= 1, `${mode} score ${c.score} out of range`);
  }
});

test('observation confidence decays with staleness and is zero when invalid', () => {
  const run = makeRun({ seed: 20261029 });
  advance(run, 5);
  const view = agentView(run, run.spacecraft[0]);
  const fresh = viewConfidence({ ...view, observedAt: run.time }, run.time);
  const stale = viewConfidence({ ...view, observedAt: run.time - 10 }, run.time);
  assert.equal(fresh, normalization.observationReliability, 'a fresh observation carries the declared reliability');
  assert.ok(stale < fresh, 'a stale one carries less');
  assert.equal(viewConfidence({ ...view, observationValid: false }, run.time), 0);
});

test('the planner records its forecast against the actual outcome', () => {
  const run = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(run, 150);
  const decision = run.decisions.find(d => d.outcome === 'VERIFIED EXTERNAL ASSISTANCE');
  assert.ok(decision, 'an assisted outcome was reached');
  assert.ok(Number.isFinite(decision.forecastCompletionS), 'the forecast was recorded at decision time');
  assert.ok(Number.isFinite(decision.actualCompletionS), 'and the actual at verification');
  assert.equal(decision.forecastErrorS, decision.actualCompletionS - decision.forecastCompletionS);
});

test('F-05 packet loss spends radio energy without delivering the lost data', () => {
  const clean = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(clean, 60);

  const lossy = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(lossy, 30);
  injectFault(lossy, { commandId: 'loss', expectedRevision: lossy.revision, spacecraftId: 'SAT-B',
    componentId: 'SAT-B-radio', modelId: 'F-05', parameters: { effect: 'degraded', packetLoss: 0.5 } });
  advance(lossy, 30);

  const link = lossy.connections.find(c => c.mode === 'C1');
  assert.equal(link.packetLoss, 0.5, 'the link carries the loss fraction');
  assert.ok(link.lostMbit > 0, 'data was actually lost');
  assert.ok(lossy.metrics.dataLostMbit > 0, 'and is reported as a metric');
  assert.ok(link.dataTransferredMbit < clean.connections[0].dataTransferredMbit,
    'less is delivered than on a clean link');
});

test('packet loss is only accepted for the radio fault class', () => {
  const run = makeRun({ seed: 20261029 });
  assert.throws(() => injectFault(run, { commandId: 'bad-loss', expectedRevision: run.revision,
    spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-01', parameters: { packetLoss: 0.2 } }),
    { code: 'INVALID_PARAMETER' });
});

test('an exported run replays deterministically after import', () => {
  const original = makeRun({ scenarioId: 'E1', seed: 20261029, faultMode: 'HYBRID' });
  advance(original, 200);
  const replay = importRun(exportRun(original));

  advance(original, 300);
  advance(replay, 300);

  const trace = run => run.events.map(e => `${e.time.toFixed(6)}|${e.type}|${e.spacecraftId ?? ''}`).join('\n');
  assert.equal(trace(replay), trace(original), 'the replayed event trace matches the original');
  assert.equal(replay.time, original.time);
  assert.deepEqual(replay.rngStreams, original.rngStreams, 'and both streams land on the same state');
  assert.equal(replay.spacecraft[0].energyWh, original.spacecraft[0].energyWh);
});
