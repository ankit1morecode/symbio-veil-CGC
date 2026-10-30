import React from 'react';
import { Activity, Radio, Satellite, ShieldCheck } from 'lucide-react';
import { fixed, fmtTime } from '../ui.jsx';

// The communications network is independent of mission-service contracts.
export default function CommunicationsNetwork({ communications, playing = false, onSelectSatellite }) {
  const links = communications?.links || [];
  const active = links.filter(link => link.status === 'ACTIVE' && link.dataState === 'OPERATIONAL');
  const pairs = communications?.pairs || [];
  return <section className="network-panel" aria-label="Constellation telemetry network">
    <div className="network-heading">
      <div><span className="eyebrow">CONSTELLATION COMMUNICATIONS</span><h2>Telemetry network</h2><p>Satellites exchange simulated status updates in priority order when radio, line of sight, and resources permit.</p></div>
      <div className="network-summary"><span><i className={active.length ? 'live-dot' : 'paused-dot'} />{active.length} {playing ? 'active' : 'paused'} {active.length === 1 ? 'link' : 'links'}</span><small>{communications ? `${communications.totalExchanges || 0} exchanges · ${fixed(communications.totalDataMbit || 0, 2)} Mbit` : 'Waiting for network data'}</small></div>
    </div>
    {active.length ? <div className="network-link-grid">{active.map(link => <article className="network-link" key={link.id}>
      <div className="network-link-top"><span><Radio size={14} /> TELEMETRY LINK</span><strong>P{link.priorityLevel}</strong></div>
      <div className="network-participants">{link.participants.map((id, index) => <React.Fragment key={id}>{index > 0 && <span className="network-link-arrow">↔</span>}<button onClick={() => onSelectSatellite?.(id)}><Satellite size={14} />{id}</button></React.Fragment>)}</div>
      <div className="network-link-foot"><span><Activity size={12} />{playing ? 'Active' : 'Paused'}</span><span>{fixed(link.dataTransferredMbit || 0, 2)} Mbit exchanged</span></div>
    </article>)}</div> : <div className="network-empty"><Radio size={18} /><div><strong>{communications?.enabled === false ? 'Telemetry network disabled' : !playing ? 'Simulation paused' : 'No active telemetry links'}</strong><span>{communications ? (communications.enabled === false ? 'Telemetry is available in six-satellite cooperative scenarios.' : !playing ? 'Press Play to start or resume telemetry exchanges.' : 'Links wait for line of sight, working radios, available resources, and the next priority slot.') : 'This run has not supplied telemetry network data yet.'}</span></div></div>}
    {pairs.length > 0 && <details className="network-history"><summary>Pair contact history <span>{pairs.length} {pairs.length === 1 ? 'pair' : 'pairs'}</span></summary><div className="network-history-grid">{pairs.map(pair => <div key={pair.participants.join(':')}><strong>{pair.participants.join(' ↔ ')}</strong><span>{pair.exchanges || 0} exchanges · {fixed(pair.dataMbit || 0, 2)} Mbit</span><small>{Number.isFinite(pair.lastContactAt) ? `Last contact T+ ${fmtTime(pair.lastContactAt)}` : 'No contact yet'}</small></div>)}</div></details>}
    <div className="network-note"><ShieldCheck size={13} />Links use priority slots; visibility, radio availability and resources limit simultaneous exchanges. Telemetry is separate from mission-support contracts and docking.</div>
  </section>;
}
