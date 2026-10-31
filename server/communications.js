import { linkGeometry } from './physics.js';

// Synthetic coordination traffic, separate from mission-service contracts.
// A radio can participate in at most one coordination link in each slot.
const SLOT_SECONDS = 30;
const RADIO_WATTS = 0.05;
const RATE_MBIT_PER_SECOND = 0.002;

const pairKey = (a, b) => [a, b].sort().join('|');

export function initializeCommunications(run) {
  if (run.communications) return run.communications;
  const pairs = [];
  for (let i = 0; i < run.spacecraft.length; i++) {
    for (let j = i + 1; j < run.spacecraft.length; j++) {
      pairs.push({ participants: [run.spacecraft[i].id, run.spacecraft[j].id].sort(), lastContactAt: null, dataMbit: 0, exchanges: 0 });
    }
  }
  run.communications = {
    // Coordination traffic belongs to the multi-vehicle constellation views. The
    // two-vehicle reference experiments stay free of it so their energy fixtures
    // remain reproducible.
    enabled: run.spacecraft.length > 2 && run.policyId !== 'B0' && run.scenarioId !== 'E0',
    slotSeconds: SLOT_SECONDS,
    nextSlotAt: run.time,
    links: [],
    pairs,
    totalDataMbit: 0,
    totalExchanges: 0,
  };
  return run.communications;
}

function busySpacecraft(run) {
  const busy = new Set();
  for (const contract of run.contracts || []) {
    if (['PROPOSED', 'ACCEPTED', 'RESERVED', 'AUTHORIZED', 'ACTIVE'].includes(contract.status)) {
      for (const id of contract.participants || []) busy.add(id);
    }
  }
  return busy;
}

function radioReady(sat, energyWh) {
  return sat.authorized && sat.radioKbps > 0 && sat.temperatureK < 333.15 &&
    sat.energyWh - energyWh > sat.reserveWh &&
    sat.components?.find(component => component.id === `${sat.id}-radio`)?.health !== 'FAILED';
}

function availablePair(a, b, busy, energyWh) {
  return !busy.has(a.id) && !busy.has(b.id) && radioReady(a, energyWh) &&
    radioReady(b, energyWh) && linkGeometry(a, b).lineOfSight;
}

function energyLedger(run, sat, amount) {
  if (!amount) return;
  const bucket = Math.floor(run.time / 60);
  const key = `coordination-${sat.id}-${bucket}`;
  let row = run.ledger.findLast(entry => entry.aggregateKey === key);
  if (!row) {
    row = { id: `COMM-${sat.id}-${bucket}`, time: run.time, source: sat.id,
      destination: 'coordination-radio', type: 'coordination_energy', amount: 0,
      unit: 'Wh', losses: 0, contractId: null, aggregateKey: key };
    run.ledger.push(row);
  }
  row.amount += amount;
  row.throughTime = run.time;
}

function selectLinks(run, state, priorityOf, busy, slotStart) {
  const pairHistory = new Map(state.pairs.map(pair => [pairKey(...pair.participants), pair]));
  const candidates = [];
  const sats = [...run.spacecraft].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sats.length; i++) {
    for (let j = i + 1; j < sats.length; j++) {
      const a = sats[i], b = sats[j];
      if (!availablePair(a, b, busy, RADIO_WATTS / 3600)) continue;
      const history = pairHistory.get(pairKey(a.id, b.id));
      const pa = priorityOf(run, a), pb = priorityOf(run, b);
      candidates.push({ a, b, history, priorityLevel: Math.min(pa.level, pb.level),
        deadline: Math.min(pa.deadlineRemainingS ?? Infinity, pb.deadlineRemainingS ?? Infinity) });
    }
  }
  candidates.sort((a, b) => a.priorityLevel - b.priorityLevel ||
    (a.history?.lastContactAt ?? -Infinity) - (b.history?.lastContactAt ?? -Infinity) ||
    a.deadline - b.deadline || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
  const used = new Set(busy), links = [];
  for (const candidate of candidates) {
    const { a, b, priorityLevel } = candidate;
    if (used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id); used.add(b.id);
    links.push({ id: `COMM-${slotStart}-${a.id}-${b.id}`, participants: [a.id, b.id],
      status: 'ACTIVE', mode: 'C1', dataState: 'OPERATIONAL', functionalState: 'TELEMETRY',
      startedAt: slotStart, endsAt: slotStart + SLOT_SECONDS, priorityLevel, dataTransferredMbit: 0 });
  }
  state.links = links;
  state.nextSlotAt = slotStart + SLOT_SECONDS;
}

// Called once after each physical simulation step, with dt in simulation seconds.
// Packet counts, data, and energy are accounted only while each pair is eligible.
export function updateCommunications(run, dt, priorityOf, audit = null) {
  const state = initializeCommunications(run);
  if (!state.enabled || !Number.isFinite(dt) || dt <= 0) return state;
  const busy = busySpacecraft(run);
  const start = run.time - dt;
  if (start >= state.nextSlotAt - 1e-8) selectLinks(run, state, priorityOf, busy, start);
  const byId = new Map(run.spacecraft.map(sat => [sat.id, sat]));
  const pairHistory = new Map(state.pairs.map(pair => [pairKey(...pair.participants), pair]));
  const energy = RADIO_WATTS * dt / 3600;
  for (const link of state.links) {
    if (link.status !== 'ACTIVE') continue;
    const [a, b] = link.participants.map(id => byId.get(id));
    if (!a || !b || !availablePair(a, b, busy, energy)) {
      link.status = 'ABORTED'; link.dataState = 'ISOLATED';
      continue;
    }
    const amount = Math.min(RATE_MBIT_PER_SECOND * dt, Math.min(a.radioKbps, b.radioKbps) * dt / 1000);
    if (!(amount > 0)) continue;
    const history = pairHistory.get(pairKey(a.id, b.id));
    if (link.dataTransferredMbit === 0) {
      state.totalExchanges++;
      if (history) history.exchanges++;
    }
    link.dataTransferredMbit += amount;
    state.totalDataMbit += amount;
    if (history) { history.dataMbit += amount; history.lastContactAt = run.time; }
    for (const sat of [a, b]) {
      sat.energyWh -= energy;
      if (audit) audit.serviceWh += energy;
      energyLedger(run, sat, energy);
    }
  }
  // Select the next slot only after accounting for the interval that just ended.
  if (run.time >= state.nextSlotAt - 1e-8) selectLinks(run, state, priorityOf, busy, run.time);
  return state;
}

// A paused run (including one reloaded after a restart) does not transmit.
// Also suppress links whose physical constraints changed since the last tick.
export function communicationSnapshot(run) {
  const state = structuredClone(initializeCommunications(run));
  const busy = busySpacecraft(run);
  const byId = new Map(run.spacecraft.map(sat => [sat.id, sat]));
  for (const link of state.links) {
    if (link.status !== 'ACTIVE') continue;
    const [a, b] = link.participants.map(id => byId.get(id));
    if (!run.playing) { link.status = 'PAUSED'; link.dataState = 'ISOLATED'; }
    else if (!a || !b || !availablePair(a, b, busy, RADIO_WATTS / 3600)) {
      link.status = 'ABORTED'; link.dataState = 'ISOLATED';
    }
  }
  return state;
}
