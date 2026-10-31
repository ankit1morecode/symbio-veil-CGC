import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, snapshot } from '../server/engine.js';
import { EARTH_RADIUS, MU, norm, inEclipse } from '../server/physics.js';

test('six satellites have distinct identities and physically distinct orbital speeds', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL' });
  assert.deepEqual(run.spacecraft.map(s => s.name), ['AURORA', 'ATLAS', 'ORION', 'VEGA', 'NOVA', 'HELIOS']);
  assert.equal(new Set(run.spacecraft.map(s => s.orbit.radius)).size, 6);
  const speed = run.spacecraft.map(s => norm(s.velocity));
  assert.equal(new Set(speed.map(s => s.toFixed(6))).size, 6);
  for (const sat of run.spacecraft) {
    assert.ok(Math.abs(norm(sat.velocity) - Math.sqrt(MU / sat.orbit.radius)) < 1e-8);
    assert.equal(sat.eclipse, inEclipse(sat.position));
    assert.equal(sat.solarW, sat.eclipse ? 0 : 20);
  }
});

test('battery charges in sunlight and drains in Earth shadow at the modeled rates', () => {
  const run = makeRun({ spacecraftCount: 6, faultMode: 'MANUAL', policyId: 'B0' });
  const [sunlit, shaded] = run.spacecraft;
  sunlit.energyWh = shaded.energyWh = 60;
  sunlit.orbit.phase = 0;
  shaded.orbit.phase = Math.PI;
  advance(run, 60);
  assert.equal(sunlit.eclipse, false);
  assert.equal(shaded.eclipse, true);
  assert.equal(sunlit.solarW, 20);
  assert.equal(shaded.solarW, 0);
  assert.ok(Math.abs(sunlit.energyWh - (60 + 12 * 60 / 3600)) < 1e-9);
  assert.ok(Math.abs(shaded.energyWh - (60 - 8 * 60 / 3600)) < 1e-9);
  assert.equal(snapshot(run).spacecraft[1].eclipse, true);
});

test('near-coorbital physical-support scenario keeps distinct, compatible satellite orbits', () => {
  const run = makeRun({ spacecraftCount: 6, scenarioId: 'E2', faultMode: 'HYBRID' });
  assert.ok(run.spacecraft.every(s => s.orbit.radius >= EARTH_RADIUS + 500000));
  assert.equal(new Set(run.spacecraft.map(s => s.orbit.radius)).size, 6);
  assert.ok(Math.abs(run.spacecraft[0].orbit.radius - run.spacecraft[1].orbit.radius) < 5000);
  advance(run, 800);
  assert.ok(run.connections.some(c => c.captureVerified), 'physical support should remain possible');
});
