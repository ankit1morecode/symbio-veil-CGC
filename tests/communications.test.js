import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, snapshot, checkpoint, restoreCheckpoint, spacecraftPriority } from '../server/engine.js';
import { updateCommunications } from '../server/communications.js';
import { linkGeometry } from '../server/physics.js';

test('six spacecraft exchange real bounded coordination data without claiming mission success', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  run.playing = true;
  advance(run, 1);
  const network = snapshot(run).communications;
  assert.equal(network.enabled, true);
  assert.equal(network.links.length, 3);
  assert.equal(new Set(network.links.flatMap(link => link.participants)).size, 6);
  for (const link of network.links) {
    const [a, b] = link.participants.map(id => run.spacecraft.find(sat => sat.id === id));
    assert.equal(linkGeometry(a, b).lineOfSight, true);
    assert.ok(link.dataTransferredMbit > 0);
  }
  assert.equal(network.totalExchanges, 3);
  assert.ok(network.totalDataMbit > 0);
  assert.equal(run.metrics.missionSuccess, 0);
  assert.ok(run.spacecraft.every(sat => !sat.mission.assisted));
  const costs = run.ledger.filter(row => row.type === 'coordination_energy');
  assert.equal(costs.length, 6);
  assert.ok(costs.every(row => row.amount > 0));
});

test('priority and fairness rotate feasible pairs, while never allocating a radio twice', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  for (const sat of run.spacecraft) { sat.position = [6878137, 0, 0]; sat.velocity = [0, 7500, 0]; }
  run.spacecraft[5].mission.status = 'PAUSED';
  run.time = 1;
  updateCommunications(run, 1, spacecraftPriority);
  assert.equal(run.communications.links[0].priorityLevel, 2);
  assert.ok(run.communications.links[0].participants.includes('SAT-F'));
  run.spacecraft[5].mission.status = 'EXECUTING';
  for (let i = 0; i < 20; i++) {
    run.time += 30;
    updateCommunications(run, 1, spacecraftPriority);
    const used = run.communications.links.flatMap(link => link.participants);
    assert.equal(new Set(used).size, used.length);
  }
  assert.ok(run.communications.pairs.every(pair => pair.exchanges > 0));
});

test('failed radio, reservation, occultation and low reserve stop or block exchanges', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  run.playing = true;
  advance(run, 1);
  const first = run.communications.links[0];
  const [a, b] = first.participants.map(id => run.spacecraft.find(sat => sat.id === id));
  a.radioKbps = 0;
  assert.equal(snapshot(run).communications.links[0].status, 'ABORTED');
  const before = first.dataTransferredMbit;
  run.time += 1; updateCommunications(run, 1, spacecraftPriority);
  assert.equal(first.status, 'ABORTED');
  assert.equal(first.dataTransferredMbit, before);
  a.radioKbps = 256;
  a.energyWh = a.reserveWh;
  run.time += 30; updateCommunications(run, 1, spacecraftPriority);
  assert.ok(run.communications.links.every(link => !link.participants.includes(a.id)));
  a.energyWh = 84;
  a.position = [6878137, 0, 0]; b.position = [-6878137, 0, 0];
  run.contracts.push({ status: 'RESERVED', participants: [a.id, 'SAT-F'] });
  run.time += 30; updateCommunications(run, 1, spacecraftPriority);
  assert.ok(run.communications.links.every(link => !link.participants.includes(a.id) && !link.participants.includes('SAT-F')));
  assert.ok(run.communications.links.every(link => {
    const [x, y] = link.participants.map(id => run.spacecraft.find(sat => sat.id === id));
    return linkGeometry(x, y).lineOfSight;
  }));
});

test('checkpoints preserve network schedule and paused or legacy snapshots are truthful', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  run.playing = true;
  advance(run, 47);
  checkpoint(run, 'network');
  advance(run, 120);
  const expected = structuredClone(run.communications);
  restoreCheckpoint(run, run.checkpoints[0]);
  assert.ok(snapshot(run).communications.links.every(link => link.status !== 'ACTIVE'));
  advance(run, 120);
  assert.deepEqual(run.communications, expected);
  const old = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  delete old.communications;
  assert.equal(snapshot(old).communications.enabled, true);
  assert.equal(snapshot(old).communications.links.length, 0);
});

test('independent policy and non-six reference cases do not generate coordination traffic', () => {
  for (const options of [{ spacecraftCount: 6, policyId: 'B0' }, { spacecraftCount: 2 }]) {
    const run = makeRun({ faultMode: 'MANUAL', ...options });
    advance(run, 100);
    assert.equal(run.communications.enabled, false);
    assert.equal(run.communications.totalDataMbit, 0);
  }
});

test('coordination slot choices and data do not depend on fractional advance steps', () => {
  const options = { spacecraftCount: 6, faultMode: 'MANUAL' };
  const whole = makeRun(options), fractional = makeRun(options);
  advance(whole, 90);
  for (let i = 0; i < 360; i++) advance(fractional, 0.25);
  assert.deepEqual(whole.communications.links.map(x => x.participants), fractional.communications.links.map(x => x.participants));
  assert.deepEqual(whole.communications.pairs.map(x => x.exchanges), fractional.communications.pairs.map(x => x.exchanges));
  assert.ok(Math.abs(whole.communications.totalDataMbit - fractional.communications.totalDataMbit) < 1e-9);
});
