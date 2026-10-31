// M02 agents and M06 planner. This module is the enforced boundary between
// simulation truth and what a spacecraft agent is allowed to decide on.
//
// Nothing here receives a `run` or a spacecraft record. `agentView` is the only
// function that touches one, and it is the only place a truth field may be read:
// everything downstream sees the projection it returns. Adding a parameter that
// carries physical truth into `candidate` reintroduces the leak this split exists
// to prevent, so new inputs belong in the view or in the planning context.
import { clamp, linkGeometry } from './physics.js';

export const weights = { benefit: .4, time: .2, cost: .15, risk: .15, donor: .1 };
export const normalization = { timeHorizonS: 1800, energyCostScaleWh: 8, qualityRequired: .8 };

const observedFactor = health => health === 'FAILED' ? 0 : health === 'DEGRADED' ? .5 : health === 'UNKNOWN' ? 0 : 1;

// The agent's own picture of a spacecraft: declared observations, its navigation
// estimate and its own gauges. Physical health, true stored energy, true
// temperature and true position never appear here.
export function agentView(run, sat) {
  const observed = key => sat.components.find(component => component.id === `${sat.id}-${key}`).observedHealth;
  const navigationValid = observed('nav') !== 'FAILED';
  return {
    id: sat.id,
    energyWh: sat.observationValid ? sat.energyWh : sat.lastObservedEnergyWh ?? 84,
    temperatureK: sat.observedTemperatureK,
    observedHealth: sat.observedHealth,
    observationValid: sat.observationValid,
    observedAt: sat.observedAt,
    computeQuality: Math.min(...['alpha', 'rail', 'bus'].map(key => observedFactor(observed(key)))),
    inputQuality: observedFactor(observed('payload')),
    missionQuality: observedFactor(observed('payload')),
    solarObservedFailed: observed('solar') === 'FAILED',
    radioKbps: observed('radio') === 'FAILED' ? 0 : observed('radio') === 'DEGRADED' ? 64 : observed('radio') === 'UNKNOWN' ? 0 : 256,
    radioAvailable: observed('radio') !== 'FAILED',
    navigationValid,
    actuatorValid: observed('wheel') !== 'FAILED',
    dockValid: observed('dock') !== 'FAILED',
    interfaceVersion: sat.interfaceVersion,
    authorized: sat.authorized,
    mission: { quality: observedFactor(observed('payload')), deadline: sat.mission.deadline },
    missionStatus: sat.mission.status,
    // The vehicle's own navigation estimate, held at its last valid fix once the
    // navigation sensor is unavailable. Not the propagated physical position.
    position: [...(sat.navPosition ?? sat.position)],
    velocity: [...(sat.navVelocity ?? sat.velocity)],
    navigationAt: sat.navAt ?? 0,
    // Declared orbital elements and the vehicle's own propellant gauge. Both are
    // onboard knowledge exchanged between peers, not hidden simulation state.
    orbit: { radius: sat.orbit.radius, inclination: sat.orbit.inclination },
    propellantKg: sat.propellantKg,
    capacityWh: sat.capacityWh,
    reserveWh: sat.reserveWh,
  };
}

// Everything the planner may know about the run that is not a spacecraft.
export function planningContext(run) {
  const held = ['PROPOSED', 'ACCEPTED', 'RESERVED', 'AUTHORIZED', 'ACTIVE'];
  const confirmed = new Map();
  for (const fault of run.faults) {
    if (fault.status !== 'ACTIVE' || fault.observationState !== 'CONFIRMED') continue;
    if (!confirmed.has(fault.spacecraftId)) confirmed.set(fault.spacecraftId, new Set());
    confirmed.get(fault.spacecraftId).add(fault.modelId);
  }
  return {
    time: run.time,
    policyId: run.policyId,
    scenarioId: run.scenarioId,
    emergency: run.scenarioId === 'E4',
    cooperationPermitted: run.policyId !== 'B0' && run.scenarioId !== 'E0',
    physicalPermitted: ['E2', 'E4', 'E6'].includes(run.scenarioId),
    integrationPermitted: run.scenarioId === 'E6',
    reducedBenefitPhysical: run.scenarioId === 'E6',
    reservedProviders: new Set(run.contracts.filter(c => held.includes(c.status)).map(c => c.participants[1])),
    confirmedFaults: confirmed,
  };
}

export function candidate(ctx, requester, provider, mode, providerPriority = null) {
  const a = requester, b = provider;
  const checks = [];
  const add = (name, pass, reason) => checks.push({ name, pass: !!pass, reason: pass ? 'PASS' : reason });
  const physical = mode === 'C2' || mode === 'C3';
  const availableLocal = a.computeQuality >= .8 && a.missionQuality >= .8 && !a.solarObservedFailed;

  if (mode === 'C0') {
    return { id: `${a.id}-C0`, provider: a.id, mode, status: 'ELIGIBLE', score: availableLocal ? 1 : .6,
      checks: [{ name: 'Local service availability', pass: availableLocal, reason: availableLocal ? 'PASS' : 'Required local service unavailable; controlled degradation is valid.' }],
      features: { benefit: availableLocal ? 1 : 0, time: 0, cost: 0, risk: 0, donor: 0 },
      costs: { energyWh: 0, propellantKg: 0, dataMbit: 0 }, completionS: 0,
      reason: availableLocal ? 'Continue independent mission' : 'Controlled degradation / no cooperation', intervention: 0 };
  }

  // A scoring input the agent cannot observe is not the same outcome as a check
  // it evaluated and failed: the dossier requires UNSCORABLE and a conservative
  // fallback, so these candidates never enter the ranking.
  const unknown = [];
  if (!Number.isFinite(b.energyWh)) unknown.push('DONOR_ENERGY_UNKNOWN');
  if (!Number.isFinite(b.computeQuality)) unknown.push('PEER_QUALITY_UNKNOWN');
  if (!Number.isFinite(b.temperatureK)) unknown.push('PEER_THERMAL_UNKNOWN');
  if (!Number.isFinite(a.mission.deadline)) unknown.push('HORIZON_UNKNOWN');
  if (b.observedHealth === 'UNKNOWN') unknown.push('PEER_STATE_UNKNOWN');
  if (unknown.length) {
    return { id: `${a.id}-${b.id}-${mode}`, provider: b.id, providerPriority, mode, status: 'UNSCORABLE', score: null,
      checks: unknown.map(reason => ({ name: 'Scorable inputs', pass: false, reason })), features: null, costs: null,
      completionS: null, reason: unknown.join(' · '), intervention: Number(mode[1]) };
  }

  const geo = linkGeometry(a, b);
  const completionS = physical ? Math.max(60, geo.distanceM / .8) + 600 : 64;
  add('Policy permits cooperation', ctx.cooperationPermitted, 'INDEPENDENT_POLICY');
  add('Peer authority / consent', b.authorized, 'PEER_UNAUTHORIZED');
  add('Fresh observable state', a.observationValid && b.observationValid, 'OBSERVATIONS_UNKNOWN');
  add('Output contract quality', physical || b.computeQuality >= .8, 'OUTPUT_QUALITY_INSUFFICIENT');
  add('Donor mission / energy reserve', b.energyWh - 8 * completionS / 3600 - (physical ? 10 * 600 / 3600 : .15) >= b.reserveWh, 'DONOR_RESERVE_PROTECTED');
  add('Deadline / survival horizon', ctx.time + completionS <= a.mission.deadline && (!ctx.emergency || a.energyWh - 8 * completionS / 3600 > 0), 'OUTCOME_TOO_LATE');
  add('Capacity reservation', !ctx.reservedProviders.has(b.id), 'PEER_CAPACITY_RESERVED');
  add('Thermal margin', b.temperatureK < 333.15 && a.temperatureK < 333.15, 'THERMAL_LIMIT');

  if (physical) {
    add('Near-coorbital relative model', Math.abs(a.orbit.radius - b.orbit.radius) < 5000 && Math.abs(a.orbit.inclination - b.orbit.inclination) < .002 && geo.distanceM < 2000, 'RENDEZVOUS_OUTSIDE_MODEL');
    add('Navigation and actuator authority', a.navigationValid && b.navigationValid && a.actuatorValid && b.actuatorValid, 'GNC_UNAVAILABLE');
    add('Direct interface version / isolation', a.interfaceVersion === b.interfaceVersion && a.dockValid && b.dockValid, 'DIRECT_INTERFACE_INCOMPATIBLE');
    add('Maneuver fuel margin', a.propellantKg > .01 && b.propellantKg > .01, 'PROPELLANT_MARGIN');
    add('Scenario physical permissions', ctx.physicalPermitted, 'PHYSICAL_MODE_NOT_CONFIGURED');
    add('Persistent configuration allowed', mode !== 'C3' || ctx.integrationPermitted, 'INTEGRATION_NOT_CONFIGURED');
  } else {
    add('Input artifact quality', a.inputQuality >= .8, 'INPUT_ARTIFACT_UNAVAILABLE');
    add('RF line of sight', geo.lineOfSight, 'EARTH_OCCLUSION');
    add('Radio service available', a.radioAvailable && b.radioAvailable, 'RADIO_UNAVAILABLE');
    add('Integrated data capacity', Math.min(a.radioKbps, b.radioKbps) * 1000 * 60 >= 8000000, 'INSUFFICIENT_LINK_CAPACITY');
    const powerFault = ctx.confirmedFaults.get(a.id);
    add('Capability restores required service', !powerFault || !['F-03', 'F-04'].some(model => powerFault.has(model)), 'WIRELESS_CANNOT_TRANSFER_POWER');
  }

  const features = { benefit: ctx.reducedBenefitPhysical && mode === 'C2' ? .5 : 1, time: clamp(completionS / normalization.timeHorizonS, 0, 1),
    cost: physical ? .22 : .035, risk: physical ? .12 : .025, donor: physical ? .12 : .025 };
  const passed = checks.every(check => check.pass);
  const score = weights.benefit * features.benefit + weights.time * (1 - features.time) + weights.cost * (1 - features.cost) +
    weights.risk * (1 - features.risk) + weights.donor * (1 - features.donor);
  return { id: `${a.id}-${b.id}-${mode}`, provider: b.id, providerPriority, mode, status: passed ? 'ELIGIBLE' : 'REJECTED',
    score: passed ? score : null, checks, features,
    costs: { energyWh: physical ? 1.6666667 : .15, propellantKg: physical ? .002 : 0, dataMbit: physical ? 0 : 8 },
    completionS, reason: passed ? 'All mandatory constraints passed' : checks.filter(c => !c.pass).map(c => c.reason).join(' · '),
    intervention: Number(mode[1]) };
}

// Each participant's own decision to enter a contract, taken from its own view at
// the moment of acceptance. A plan is a proposal: this is the local veto the
// dossier requires before reservation, and either side can withhold it.
export function consent(view, role, caps) {
  const reasons = [];
  if (!view.authorized) reasons.push('NOT_AUTHORIZED');
  if (!view.observationValid) reasons.push('OBSERVATIONS_UNKNOWN');
  if (!(view.temperatureK < 333.15)) reasons.push('THERMAL_LIMIT');
  if (role === 'provider' && view.energyWh - (caps?.energyWh ?? 0) < view.reserveWh) reasons.push('RESERVE_PROTECTED');
  return { accepted: reasons.length === 0, role, reasons };
}

// Observed need for help, derived from a view rather than a spacecraft record.
// Lower levels are more urgent; reserve and deadline stay explicit in the result.
export function viewPriority(view, time) {
  const energyMarginWh = Math.max(0, view.energyWh - view.reserveWh);
  const deadlineRemainingS = Math.max(0, view.mission.deadline - time);
  const stalled = ['PAUSED', 'DEGRADED'].includes(view.missionStatus);
  const critical = energyMarginWh <= 3 || (stalled && deadlineRemainingS <= 120);
  const high = !critical && (view.observedHealth === 'FAILED' || view.observedHealth === 'DEGRADED' || stalled || energyMarginWh <= 15);
  const level = critical ? 1 : high ? 2 : 3;
  const reason = critical ? (energyMarginWh <= 3 ? 'Energy reserve nearly exhausted' : 'Mission deadline approaching')
    : high ? (stalled ? 'Mission needs assistance' : view.observedHealth !== 'OPERATIONAL' ? 'Observed health degraded' : 'Energy reserve margin reduced')
      : 'Nominal mission and reserve';
  return { level, label: ['', 'Critical', 'High', 'Normal'][level], reason, energyMarginWh, deadlineRemainingS };
}

// Feasible candidates ranked by weighted score. Within 0.01 the dossier's order
// applies: lower intervention, then earliest completion, then stable ID. Provider
// need is consulted between those and the ID tie-break.
export function rankCandidates(candidates) {
  return candidates.filter(x => x.status === 'ELIGIBLE').sort((a, b) => Math.abs(b.score - a.score) < .01
    ? a.intervention - b.intervention || a.completionS - b.completionS ||
      (b.providerPriority?.level ?? 3) - (a.providerPriority?.level ?? 3) ||
      (b.providerPriority?.energyMarginWh ?? 0) - (a.providerPriority?.energyMarginWh ?? 0) ||
      a.provider.localeCompare(b.provider)
    : b.score - a.score);
}
