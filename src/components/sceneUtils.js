import * as THREE from 'three';

export const EARTH_RADIUS_M = 6378137;
export const EARTH_SCENE_RADIUS = 2.1;
export const WORLD_SCALE = EARTH_SCENE_RADIUS / EARTH_RADIUS_M;
export const palette = ['#79e5dc', '#edb26c', '#839cf1', '#dd91d9', '#a5c97b'];

export function toScene(position = [0, 0, 0]) {
  const p = Array.isArray(position) ? position : [position.x || 0, position.y || 0, position.z || 0];
  return new THREE.Vector3(p[0] * WORLD_SCALE, p[2] * WORLD_SCALE, -p[1] * WORLD_SCALE);
}

export function healthColor(value = '') {
  const state = String(value).toUpperCase();
  if (['FAILED', 'FAULT', 'OFFLINE'].some(s => state.includes(s))) return '#f1787b';
  if (['DEGRADED', 'WARNING', 'SUSPECTED'].some(s => state.includes(s))) return '#edb26c';
  if (['UNKNOWN', 'UNOBSERVED'].some(s => state.includes(s))) return '#8b96a8';
  return '#79e5bc';
}

export function getOrbitPoints(satellite, count = 256) {
  const orbit = satellite.orbit || {};
  const p = satellite.position || satellite.inertial_r_m;
  const positionRadius = p ? Math.hypot(...p) : 6878137;
  const rawRadius = orbit.semiMajorAxis ?? orbit.semiMajorAxisM ?? orbit.a ?? orbit.radius ?? positionRadius;
  const radius = rawRadius < 100000 ? rawRadius * 1000 : rawRadius;
  const angle = value => Math.abs(value || 0) > Math.PI * 2 ? (value || 0) * Math.PI / 180 : (value || 0);
  const i = angle(orbit.inclination ?? orbit.inclinationRad ?? 0);
  const O = angle(orbit.raan ?? orbit.raanRad ?? 0);
  const w = angle(orbit.argumentOfPeriapsis ?? orbit.argPeriapsis ?? 0);
  const e = orbit.eccentricity ?? orbit.e ?? 0;
  const points = [];
  for (let index = 0; index <= count; index++) {
    const v = index / count * Math.PI * 2;
    const r = radius * (1 - e * e) / (1 + e * Math.cos(v));
    const u = v + w;
    points.push(toScene([
      r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)),
      r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i)),
      r * Math.sin(u) * Math.sin(i),
    ]));
  }
  return points;
}
