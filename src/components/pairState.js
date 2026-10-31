// Pair-state derivation for P03, kept free of JSX so it can be tested directly.
// The dossier's mode vocabulary is derived from the orthogonal mechanical, data,
// power and functional states rather than stored as a separate field, and the
// release forecast only reports an ETA the engine actually holds.

export function pairMode(connection) {
  if (!connection) return 'SEPARATE';
  const { mode, status, mechanicalState, functionalState, powerState, dataState } = connection;
  if (mechanicalState === 'RELEASED') return 'TERMINATING';
  if (status === 'ABORTED') return mechanicalState === 'CAPTURED' ? 'TERMINATING' : 'SEPARATE';
  if (mode === 'C1') return status === 'COMPLETED' ? 'SEPARATE' : 'WIRELESS';
  if (mechanicalState === 'APPROACH') return 'APPROACH';
  if (mechanicalState === 'CAPTURED') {
    if (functionalState === 'INTEGRATED') return 'INTEGRATED';
    if (powerState === 'PROTECTED_ACTIVE' && dataState === 'OPERATIONAL') return 'DIRECT_LINK';
    if (functionalState === 'SYMBIOTIC') return 'SYMBIOTIC';
    return 'MECHANICAL';
  }
  return 'SEPARATE';
}

export function releaseForecast(connection) {
  if (!connection) return { status: 'NOT_DETERMINED', at: null, safe: false, reason: 'No active pair.' };
  if (connection.mode === 'C1') {
    return { status: 'NOT_APPLICABLE', at: null, safe: true, reason: 'A cross-link has no mechanical latch to release.' };
  }
  if (connection.safetyState === 'SAFE_COUPLED') {
    return { status: 'NOT_SAFE', at: null, safe: false,
      reason: connection.detachmentReason || 'Release path unavailable; the formation stays coupled with isolated interfaces.' };
  }
  if (!Number.isFinite(connection.detachmentTime)) {
    return { status: 'NOT_DETERMINED', at: null, safe: false,
      reason: connection.detachmentReason || 'No feasible release plan has been computed.' };
  }
  return { status: 'ETA', at: connection.detachmentTime, safe: true,
    reason: connection.detachmentReason || 'Feasible release plan held.' };
}

export const RELEASE_LABEL = {
  NOT_APPLICABLE: 'NOT APPLICABLE',
  NOT_DETERMINED: 'NOT DETERMINED',
  NOT_SAFE: 'SEPARATION NOT CURRENTLY SAFE',
};
