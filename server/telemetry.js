// M01 time-indexed telemetry. The engine is the only source of these values:
// nothing here computes physics, it samples state the kernel already holds.
//
// The catalog deliberately declares parameters the analysis workspace asks for
// that this model does NOT implement, classified NOT_MODELLED. That is how the
// UI can list them as unavailable instead of inventing a series for them. Adding
// a parameter here without a `read` is a declaration, not a measurement.

export const CLASSIFICATION = {
  MEASURED: 'MEASURED',       // physical truth the kernel integrates
  OBSERVED: 'OBSERVED',       // what the agent's sensors report, bias and staleness included
  CALCULATED: 'CALCULATED',   // derived from measured values
  DECLARED: 'DECLARED',       // a manifest or configuration constant
  NOT_MODELLED: 'NOT_MODELLED',
};

export const subsystems = [
  { id: 'battery', name: 'Battery and energy storage' },
  { id: 'solar', name: 'Solar power generation' },
  { id: 'eps', name: 'Electrical power system' },
  { id: 'compute', name: 'Onboard computing and processing' },
  { id: 'comms', name: 'Communication subsystem' },
  { id: 'thermal', name: 'Thermal management' },
  { id: 'adcs', name: 'Attitude determination and control' },
  { id: 'propulsion', name: 'Propulsion' },
  { id: 'mission', name: 'Mission payload and services' },
  { id: 'orbit', name: 'Orbital state' },
  { id: 'component', name: 'Individual components' },
  { id: 'cooperation', name: 'Symbiotic cooperation' },
];

const NOMINAL_CAPACITY_WH = 120;   // manifest nominal, used for state of health
const DECLARED_HEAT_W = 3;         // lumped node heat input, P2 synthetic

const ordinal = health => health === 'OPERATIONAL' ? 3 : health === 'DEGRADED' ? 2 : health === 'UNKNOWN' ? 1 : health === 'FAILED' ? 0 : null;
export const HEALTH_LEGEND = { 3: 'OPERATIONAL', 2: 'DEGRADED', 1: 'UNKNOWN', 0: 'FAILED' };

// scope 'spacecraft' reads (sat, run); 'component' reads (component, sat, run);
// 'connection' reads (connection, run).
export const parameters = [
  // --- battery -------------------------------------------------------------
  p('battery.storedEnergyWh', 'battery', 'Stored energy', 'Wh', 'MEASURED', sat => sat.energyWh),
  p('battery.observedStoredEnergyWh', 'battery', 'Reported stored energy', 'Wh', 'OBSERVED', sat => sat.lastObservedEnergyWh),
  p('battery.stateOfChargePct', 'battery', 'State of charge', '%', 'CALCULATED', sat => sat.capacityWh ? sat.energyWh / sat.capacityWh * 100 : null),
  p('battery.usableCapacityWh', 'battery', 'Usable capacity', 'Wh', 'DECLARED', sat => sat.capacityWh),
  p('battery.stateOfHealthPct', 'battery', 'State of health', '%', 'CALCULATED', sat => sat.capacityWh / NOMINAL_CAPACITY_WH * 100),
  p('battery.reserveMarginWh', 'battery', 'Reserve margin', 'Wh', 'CALCULATED', sat => sat.energyWh - sat.reserveWh),
  p('battery.protectedReserveWh', 'battery', 'Protected reserve', 'Wh', 'DECLARED', sat => sat.reserveWh),
  p('battery.voltageV', 'battery', 'Terminal voltage', 'V', 'NOT_MODELLED'),
  p('battery.currentA', 'battery', 'Charge / discharge current', 'A', 'NOT_MODELLED'),

  // --- solar ---------------------------------------------------------------
  p('solar.generatedPowerW', 'solar', 'Generated power', 'W', 'MEASURED', sat => sat.solarW),
  p('solar.capabilityW', 'solar', 'Illuminated capability', 'W', 'DECLARED', sat => sat.availableSolarW ?? null),
  p('solar.inEclipse', 'solar', 'In eclipse', '0/1', 'MEASURED', sat => sat.eclipse ? 1 : 0),
  p('solar.outputVoltageV', 'solar', 'Array output voltage', 'V', 'NOT_MODELLED'),
  p('solar.outputCurrentA', 'solar', 'Array output current', 'A', 'NOT_MODELLED'),
  p('solar.efficiencyPct', 'solar', 'Generation efficiency', '%', 'NOT_MODELLED'),

  // --- eps -----------------------------------------------------------------
  p('eps.loadPowerW', 'eps', 'Load power', 'W', 'MEASURED', sat => sat.loadW),
  p('eps.netPowerW', 'eps', 'Net power', 'W', 'CALCULATED', sat => (sat.solarW ?? 0) - (sat.loadW ?? 0)),
  p('eps.busVoltageV', 'eps', 'Bus voltage', 'V', 'NOT_MODELLED'),
  p('eps.railVoltageV', 'eps', 'Regulated rail voltage', 'V', 'NOT_MODELLED'),
  p('eps.loadCurrentA', 'eps', 'Load current', 'A', 'NOT_MODELLED'),

  // --- compute -------------------------------------------------------------
  p('compute.qualityFraction', 'compute', 'Compute quality', 'fraction', 'MEASURED', sat => sat.computeQuality),
  p('compute.serviceAvailable', 'compute', 'Processing service available', '0/1', 'CALCULATED', sat => sat.capabilities?.[0]?.available ? 1 : 0),
  p('compute.utilisationPct', 'compute', 'CPU utilisation', '%', 'NOT_MODELLED'),
  p('compute.memoryPct', 'compute', 'Memory utilisation', '%', 'NOT_MODELLED'),

  // --- comms ---------------------------------------------------------------
  p('comms.usableRateKbps', 'comms', 'Usable bitrate', 'kbit/s', 'MEASURED', sat => sat.radioKbps),
  p('comms.packetLossFraction', 'comms', 'Packet loss', 'fraction', 'MEASURED', sat => sat.packetLoss ?? 0),
  p('comms.signalStrengthDbm', 'comms', 'Signal strength', 'dBm', 'NOT_MODELLED'),
  p('comms.latencyMs', 'comms', 'Link latency', 'ms', 'NOT_MODELLED'),

  // --- thermal -------------------------------------------------------------
  p('thermal.temperatureK', 'thermal', 'Physical temperature', 'K', 'MEASURED', sat => sat.temperatureK),
  p('thermal.observedTemperatureK', 'thermal', 'Reported temperature', 'K', 'OBSERVED', sat => sat.observedTemperatureK),
  p('thermal.conductanceWperK', 'thermal', 'Node conductance', 'W/K', 'DECLARED', sat => sat.conductance),
  p('thermal.heatInputW', 'thermal', 'Node heat input', 'W', 'DECLARED', () => DECLARED_HEAT_W),

  // --- adcs ----------------------------------------------------------------
  p('adcs.availableTorqueNm', 'adcs', 'Available torque', 'N·m', 'MEASURED', sat => sat.torqueNm),
  p('adcs.angularRateRadps', 'adcs', 'Angular rate', 'rad/s', 'NOT_MODELLED'),
  p('adcs.attitudeErrorDeg', 'adcs', 'Attitude error', 'deg', 'NOT_MODELLED'),

  // --- propulsion ----------------------------------------------------------
  p('propulsion.propellantKg', 'propulsion', 'Propellant remaining', 'kg', 'MEASURED', sat => sat.propellantKg),

  // --- mission -------------------------------------------------------------
  p('mission.availabilityFraction', 'mission', 'Mission availability', 'fraction', 'MEASURED', sat => sat.mission?.availability),
  p('mission.qualityFraction', 'mission', 'Output quality', 'fraction', 'MEASURED', sat => sat.mission?.quality),
  p('mission.healthOrdinal', 'mission', 'Spacecraft health', 'state', 'MEASURED', sat => ordinal(sat.health)),
  p('mission.observedHealthOrdinal', 'mission', 'Observed health', 'state', 'OBSERVED', sat => ordinal(sat.observedHealth)),

  // --- orbit ---------------------------------------------------------------
  p('orbit.altitudeKm', 'orbit', 'Altitude', 'km', 'CALCULATED',
    sat => Array.isArray(sat.position) && sat.position.length === 3 ? (Math.hypot(...sat.position) - 6378137) / 1000 : null),
];

// Per-component series, recorded for every modelled component in the manifest.
export const componentParameters = [
  c('component.healthOrdinal', 'Physical health', 'state', 'MEASURED', comp => ordinal(comp.health)),
  c('component.observedHealthOrdinal', 'Observed health', 'state', 'OBSERVED', comp => ordinal(comp.observedHealth)),
  c('component.temperatureK', 'Temperature', 'K', 'MEASURED', comp => comp.temperatureK),
  c('component.powerW', 'Declared power draw', 'W', 'DECLARED', comp => comp.powerW),
  c('component.confidence', 'Observation confidence', 'fraction', 'CALCULATED', comp => comp.confidence),
];

// Per-connection series, recorded while a cooperation link exists.
export const connectionParameters = [
  k('cooperation.transferPowerW', 'Transfer power', 'W', 'MEASURED', link => link.transferW),
  k('cooperation.exportedWh', 'Energy exported', 'Wh', 'MEASURED', link => link.exportedWh),
  k('cooperation.receivedWh', 'Energy received', 'Wh', 'MEASURED', link => link.receivedWh),
  k('cooperation.lossWh', 'Transfer loss', 'Wh', 'MEASURED', link => link.lossWh),
  k('cooperation.dataTransferredMbit', 'Data delivered', 'Mbit', 'MEASURED', link => link.dataTransferredMbit),
  k('cooperation.relativeDistanceM', 'Relative distance', 'm', 'MEASURED', link => link.relativeDistanceM),
  k('cooperation.relativeSpeedMps', 'Relative speed', 'm/s', 'MEASURED', link => link.relativeSpeedMps),
];

function p(id, subsystem, name, unit, classification, read) {
  return { id, subsystem, name, unit, classification, scope: 'spacecraft', read: read ?? null };
}
function c(id, name, unit, classification, read) {
  return { id, subsystem: 'component', name, unit, classification, scope: 'component', read };
}
function k(id, name, unit, classification, read) {
  return { id, subsystem: 'cooperation', name, unit, classification, scope: 'connection', read };
}

export const allParameters = [...parameters, ...componentParameters, ...connectionParameters];
export const parameterById = new Map(allParameters.map(entry => [entry.id, entry]));
export const seriesKey = (ownerId, parameterId) => `${ownerId}|${parameterId}`;

export const DEFAULT_SAMPLE_INTERVAL_S = 30;
export const DEFAULT_MAX_POINTS = 720;

export function initializeTelemetry(run, options = {}) {
  if (run.telemetry) return run.telemetry;
  run.telemetry = {
    schemaVersion: '1.0',
    sampleIntervalS: options.sampleIntervalS ?? DEFAULT_SAMPLE_INTERVAL_S,
    maxPoints: options.maxPoints ?? DEFAULT_MAX_POINTS,
    nextSampleAt: 0,
    sampleCount: 0,
    droppedPoints: 0,
    // Parallel arrays rather than point objects: a checkpointed run carries
    // thousands of samples and the object form roughly triples the footprint.
    series: {},
  };
  return run.telemetry;
}

function push(state, key, meta, time, value) {
  let series = state.series[key];
  if (!series) series = state.series[key] = { ...meta, t: [], v: [] };
  const last = series.t.length - 1;
  if (last >= 0 && Math.abs(series.t[last] - time) < 1e-9) { series.v[last] = value; return; }
  series.t.push(time);
  series.v.push(Number.isFinite(value) ? value : null);
  if (series.t.length > state.maxPoints) { series.t.shift(); series.v.shift(); state.droppedPoints++; }
}

// Record one sample of every supported series. `reason` distinguishes the
// periodic sampler from an event-driven mark so a step change is never missed
// between two scheduled samples.
export function recordTelemetry(run, reason = 'INTERVAL') {
  const state = initializeTelemetry(run);
  const time = run.time;
  for (const sat of run.spacecraft) {
    for (const parameter of parameters) {
      if (!parameter.read) continue;
      push(state, seriesKey(sat.id, parameter.id),
        { ownerId: sat.id, ownerKind: 'spacecraft', parameterId: parameter.id, unit: parameter.unit, classification: parameter.classification },
        time, parameter.read(sat, run));
    }
    for (const component of sat.components) {
      if (component.simulationStatus === 'CATALOG_ONLY') continue;
      for (const parameter of componentParameters) {
        push(state, seriesKey(component.id, parameter.id),
          { ownerId: component.id, ownerKind: 'component', spacecraftId: sat.id, parameterId: parameter.id, unit: parameter.unit, classification: parameter.classification },
          time, parameter.read(component, sat, run));
      }
    }
  }
  for (const link of run.connections) {
    for (const parameter of connectionParameters) {
      push(state, seriesKey(link.id, parameter.id),
        { ownerId: link.id, ownerKind: 'connection', participants: link.participants, parameterId: parameter.id, unit: parameter.unit, classification: parameter.classification },
        time, parameter.read(link, run));
    }
  }
  state.sampleCount++;
  state.lastReason = reason;
  return state;
}

// Called once per physical step. A paused run never advances `run.time`, so it
// records nothing: there is no artificial progression while paused.
export function sampleTelemetry(run) {
  const state = initializeTelemetry(run);
  if (run.time + 1e-9 < state.nextSampleAt) return state;
  recordTelemetry(run, 'INTERVAL');
  state.nextSampleAt = Math.floor(run.time / state.sampleIntervalS + 1) * state.sampleIntervalS;
  return state;
}

// Restoring a checkpoint rewinds history to that instant. The series are not
// stored inside the checkpoint; they are truncated by timestamp, which is exact
// and costs nothing.
export function truncateTelemetry(run, time) {
  const state = run.telemetry;
  if (!state) return;
  for (const series of Object.values(state.series)) {
    let keep = series.t.length;
    while (keep > 0 && series.t[keep - 1] > time + 1e-9) keep--;
    series.t.length = keep;
    series.v.length = keep;
  }
  state.nextSampleAt = Math.floor(time / state.sampleIntervalS + 1) * state.sampleIntervalS;
}

// The catalog the UI renders its selector from, including what is unavailable.
export function telemetryCatalog(run) {
  const state = run.telemetry;
  const available = key => !!state?.series[key]?.t.length;
  return {
    schemaVersion: '1.0',
    sampleIntervalS: state?.sampleIntervalS ?? DEFAULT_SAMPLE_INTERVAL_S,
    maxPoints: state?.maxPoints ?? DEFAULT_MAX_POINTS,
    sampleCount: state?.sampleCount ?? 0,
    droppedPoints: state?.droppedPoints ?? 0,
    healthLegend: HEALTH_LEGEND,
    subsystems,
    spacecraft: run.spacecraft.map(sat => ({
      id: sat.id, name: sat.name, classId: sat.classId, manifestId: sat.manifestId,
      components: sat.components.map(component => ({
        id: component.id, name: component.name, board: component.board,
        modelled: component.simulationStatus !== 'CATALOG_ONLY',
        simulationStatus: component.simulationStatus ?? 'MODELLED',
      })),
    })),
    connections: run.connections.map(link => ({ id: link.id, participants: link.participants, mode: link.mode, status: link.status })),
    parameters: allParameters.map(entry => ({
      id: entry.id, subsystem: entry.subsystem, name: entry.name, unit: entry.unit,
      classification: entry.classification, scope: entry.scope,
      supported: entry.classification !== 'NOT_MODELLED' && !!entry.read,
    })),
    series: Object.entries(state?.series ?? {}).map(([key, series]) => ({
      key, ownerId: series.ownerId, ownerKind: series.ownerKind, spacecraftId: series.spacecraftId,
      parameterId: series.parameterId, unit: series.unit, classification: series.classification,
      points: series.t.length, available: available(key),
    })),
  };
}

export function telemetrySeries(run, keys, { from = -Infinity, to = Infinity } = {}) {
  const state = run.telemetry;
  return (keys || []).map(key => {
    const series = state?.series[key];
    if (!series) {
      const parameterId = String(key).split('|')[1];
      const parameter = parameterById.get(parameterId);
      return { key, available: false,
        reason: parameter ? (parameter.classification === 'NOT_MODELLED' ? 'NOT_MODELLED' : 'NO_SAMPLES') : 'UNKNOWN_PARAMETER',
        unit: parameter?.unit ?? null, classification: parameter?.classification ?? null, points: [] };
    }
    const points = [];
    for (let i = 0; i < series.t.length; i++) {
      if (series.t[i] < from || series.t[i] > to) continue;
      points.push([series.t[i], series.v[i]]);
    }
    const values = points.map(point => point[1]).filter(Number.isFinite);
    return {
      key, available: true, ownerId: series.ownerId, ownerKind: series.ownerKind, spacecraftId: series.spacecraftId,
      parameterId: series.parameterId, unit: series.unit, classification: series.classification, points,
      stats: values.length
        ? { min: Math.min(...values), max: Math.max(...values), avg: values.reduce((a, b) => a + b, 0) / values.length,
            current: values[values.length - 1], samples: values.length, gaps: points.length - values.length }
        : { min: null, max: null, avg: null, current: null, samples: 0, gaps: points.length },
    };
  });
}
