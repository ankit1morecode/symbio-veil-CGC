import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, snapshot, injectFault } from '../server/engine.js';

test('six spacecraft retain shared modeled core and receive distinct specialist inventory', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'HYBRID' });
  const allNames = [];
  for (const sat of run.spacecraft) {
    for (const key of ['alpha', 'rail', 'radio', 'bus', 'solar', 'battery']) {
      assert.ok(sat.components.some(c => c.id === `${sat.id}-${key}`), `${sat.id} has ${key}`);
    }
    const specialists = sat.components.filter(c => c.specialty);
    assert.equal(specialists.length, 2);
    assert.ok(specialists.every(c => c.simulationStatus === 'CATALOG_ONLY' && c.faultability === false && c.faultClasses.length === 0 && c.powerW === null && c.sourceUrl.startsWith('https://')));
    allNames.push(...specialists.map(c => c.name));
  }
  assert.equal(new Set(allNames).size, 12);
  assert.ok(run.queue.filter(q => q.origin === 'STOCHASTIC').every(q => q.modelId));
  advance(run, 60);
  assert.ok(snapshot(run).spacecraft.every(s => s.components.filter(c => c.specialty).length === 2));
});

test('catalog-only specialist boards have no modeled observations or effect on fleet health', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  const sat = run.spacecraft[0];
  const assertCatalogOnly = () => {
    for (const component of sat.components.filter(c => c.specialty)) {
      assert.equal(component.health, 'UNKNOWN');
      assert.equal(component.observedHealth, 'UNKNOWN');
      assert.equal(component.temperatureK, null);
      assert.equal(component.powerW, null);
      assert.equal(component.observedAt, null);
      assert.equal(component.confidence, null);
    }
  };
  assertCatalogOnly();
  advance(run, 1);
  assertCatalogOnly();
  injectFault(run, { commandId: 'temporary-thermal-fault', expectedRevision: run.revision,
    spacecraftId: sat.id, componentId: `${sat.id}-thermal`, modelId: 'F-09',
    duration: 'TRANSIENT', parameters: { durationS: 2 } });
  assert.equal(sat.health, 'DEGRADED');
  assertCatalogOnly();
  advance(run, 3);
  assert.equal(sat.health, 'OPERATIONAL');
  assertCatalogOnly();
  assert.ok(snapshot(run).spacecraft[0].components.filter(c => c.specialty).every(c => c.health === 'UNKNOWN' && c.temperatureK === null));
});
