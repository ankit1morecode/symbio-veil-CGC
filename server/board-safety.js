// Display telemetry for existing simulation guards. These do not add a hardware
// reset controller or independent board-temperature model. Health and guard
// states are derived separately for physical truth and available observations.
const TIMEOUT_S = 6;
const DIGITAL = new Set(['compute', 'radio', 'navigation', 'bus', 'monitor', 'dock', 'payload']);
const check = (status, detail) => ({ status, detail });
const healthRank = { OPERATIONAL: 0, DEGRADED: 1, UNKNOWN: 2, FAILED: 3 };
const worstHealth = values => values.reduce((a, b) => (healthRank[b] ?? 2) > (healthRank[a] ?? 2) ? b : a, 'OPERATIONAL');

export function boardSafety(run, sat, observed = false) {
  const groups = new Map();
  for (const component of sat.components || []) {
    const name = component.board || component.name;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(component);
  }
  const at = observed ? sat.observedAt ?? 0 : run.time;
  const stale = observed && run.time - at > TIMEOUT_S;
  const energy = observed ? sat.lastObservedEnergyWh : sat.energyWh;
  const temperature = observed ? sat.observedTemperatureK : sat.temperatureK;
  const healthOf = comp => observed ? comp?.observedHealth || 'UNKNOWN' : comp?.health || 'UNKNOWN';
  const faults = (run.faults || []).filter(f => f.status === 'ACTIVE' && f.spacecraftId === sat.id && (!observed || f.observationState === 'CONFIRMED'));
  return [...groups].map(([name, components]) => {
    const modeled = components.some(comp => comp.simulationStatus !== 'CATALOG_ONLY');
    const base = { id: components[0].id + '-board', name, componentIds: components.map(comp => comp.id), modeled,
      layer: observed ? 'OBSERVATION' : 'TRUTH', updatedAt: modeled ? at : null };
    if (!modeled) {
      const unavailable = check('NOT_MODELED', 'Specialist hardware inventory; independent behavior is not simulated.');
      return { ...base, health: 'UNKNOWN', overall: 'NOT_MODELED', activeFaultCount: 0,
        watchdog: { ...unavailable, lastHeartbeatAt: null, timeoutS: null }, power: unavailable,
        thermal: unavailable, dependencies: unavailable, protection: unavailable };
    }
    const modeledComponents = components.filter(comp => comp.simulationStatus !== 'CATALOG_ONLY');
    const activeFaults = faults.filter(f => modeledComponents.some(comp => comp.id === f.componentId));
    const health = stale ? 'UNKNOWN' : worstHealth(modeledComponents.map(healthOf));
    const dependencies = [...new Set(modeledComponents.flatMap(comp => comp.dependencies || []))].map(id => sat.components.find(comp => comp.id === id));
    const failedDependency = dependencies.some(comp => healthOf(comp) === 'FAILED');
    const uncertainDependency = dependencies.some(comp => ['DEGRADED', 'UNKNOWN'].includes(healthOf(comp)));
    const dependencyState = !dependencies.length ? check('NOT_APPLICABLE', 'No declared upstream dependency.') : failedDependency
      ? check('ALARM', 'A declared upstream component is unavailable.') : uncertainDependency
        ? check('WARNING', 'A declared upstream component is degraded or unobserved.') : check('OK', 'Declared upstream components are available.');
    let power = !Number.isFinite(energy) ? check('UNKNOWN', 'No usable battery observation.') : energy <= 0
      ? check('ALARM', 'Battery depleted; board power is unavailable.') : energy <= sat.reserveWh
        ? check('WARNING', 'Battery is at or below the protected reserve.') : check('OK', 'Battery is above the protected reserve.');
    if (modeledComponents.some(comp => comp.targetClass === 'rail' && healthOf(comp) === 'FAILED') || failedDependency) {
      power = check('ALARM', 'A required regulated supply or declared dependency is unavailable.');
    } else if (modeledComponents.some(comp => comp.targetClass === 'rail' && healthOf(comp) === 'DEGRADED')) {
      power = check('WARNING', 'The regulated rail is degraded.');
    }
    const thermal = !Number.isFinite(temperature) ? check('UNKNOWN', 'No usable thermal observation.') : temperature >= 333.15
      ? check(!observed && sat.thermalDerated ? 'ALARM' : 'WARNING', 'Shared spacecraft thermal node reached the 333.15 K guard.')
      : check('OK', 'Shared spacecraft thermal node is below 333.15 K.');
    const digital = modeledComponents.filter(comp => DIGITAL.has(comp.targetClass));
    const monitorFrozen = !observed && activeFaults.some(f => f.modelId === 'F-12' && f.parameters?.effect === 'freeze');
    const digitalFailed = digital.some(comp => healthOf(comp) === 'FAILED') || failedDependency || monitorFrozen;
    const affected = faults.filter(f => digital.some(comp => comp.id === f.componentId) || dependencies.some(comp => comp?.id === f.componentId));
    const lostAt = affected.length ? Math.min(...affected.map(f => f.activatedS ?? run.time)) : run.time;
    const timedOut = digitalFailed && (observed || run.time - lostAt >= TIMEOUT_S);
    const energyKnown = Number.isFinite(energy);
    const heartbeatUnknown = !energyKnown || digital.some(comp => healthOf(comp) === 'UNKNOWN');
    let watchdog = !digital.length ? { ...check('NOT_APPLICABLE', 'This group has no modeled digital heartbeat interface.'), lastHeartbeatAt: null, timeoutS: null }
      : { ...check(timedOut || energyKnown && energy <= 0 ? 'ALARM' : digitalFailed ? 'WARNING' : heartbeatUnknown ? 'UNKNOWN' : 'OK', timedOut
        ? 'Synthetic heartbeat supervision timed out after 6 simulation seconds.' : energyKnown && energy <= 0
          ? 'No power is available for the supervised interface.' : digitalFailed
            ? 'Heartbeat unavailable; the 6-second supervision window is pending.' : heartbeatUnknown
              ? 'Power or interface observations cannot establish a responding heartbeat.' : 'Synthetic supervised interface is responding.'),
        lastHeartbeatAt: !energyKnown || energy <= 0 || heartbeatUnknown ? null : digitalFailed ? affected.length ? lostAt : null : at, timeoutS: TIMEOUT_S };
    const dock = modeledComponents.some(comp => comp.targetClass === 'dock');
    const battery = modeledComponents.some(comp => comp.targetClass === 'battery');
    let protection = dock ? check(health === 'FAILED' ? 'ALARM' : 'OK', health === 'FAILED'
      ? 'Docking interface failed; direct power path must remain isolated.' : 'Direct-path isolation and capture guards are available.')
      : battery ? check(energy <= 0 ? 'ALARM' : energy <= sat.reserveWh || health !== 'OPERATIONAL' ? 'WARNING' : 'OK',
        'Donor reserve and recipient capacity guards apply to simulated transfers.') : check('NOT_APPLICABLE', 'No independent containment actuator is modeled for this board.');
    if (stale) {
      watchdog = { ...check('UNKNOWN', 'No fresh monitoring sample; an OK heartbeat cannot be established.'), lastHeartbeatAt: energyKnown && energy > 0 ? at : null, timeoutS: digital.length ? TIMEOUT_S : null };
      power = check('UNKNOWN', 'Power observation is stale.');
      protection = check('UNKNOWN', 'Protection observation is stale.');
    }
    const checks = [watchdog, power, thermal, dependencyState, protection];
    const overall = stale ? 'UNKNOWN' : health === 'FAILED' || checks.some(item => item.status === 'ALARM') ? 'ALARM'
      : health === 'DEGRADED' || checks.some(item => item.status === 'WARNING') ? 'WARNING'
        : health === 'UNKNOWN' || checks.some(item => item.status === 'UNKNOWN') ? 'UNKNOWN' : 'OK';
    return { ...base, health, overall, watchdog, power, thermal: stale ? check('UNKNOWN', 'Thermal observation is stale.') : thermal,
      dependencies: stale ? check('UNKNOWN', 'Dependency observation is stale.') : dependencyState, protection, activeFaultCount: activeFaults.length };
  });
}

export function faultEngineSummary(run) {
  return { hazardModel: run.config.hazardModel, hazardPerNodeHour: run.config.hazardPerNodeHour,
    weibullBeta: run.config.weibullBeta ?? null, weibullEtaHours: run.config.weibullEtaHours ?? null,
    eligibleComponents: run.spacecraft.reduce((total, sat) => total + sat.components.filter(comp => comp.faultability !== false && comp.faultClasses?.length).length, 0),
    scenarioFaultModel: run.scenario.fault || null, scenarioFaultAt: run.scenario.fault ? 20 : null };
}
