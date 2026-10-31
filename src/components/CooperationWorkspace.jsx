import React, { useMemo, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Battery, Check, ChevronRight, Clock3, Cpu, FileText, Filter, Layers3, Link2, Network, Pause, Play, Radio, Satellite, Search, ShieldCheck, SkipForward, TriangleAlert, Unplug, Waves, Zap } from 'lucide-react';
import { fixed, fmtTime, friendly, modes, Status } from '../ui.jsx';
import './cooperation.css';

const live = link => ['ACTIVE', 'VERIFIED'].includes(link.status);
const physical = link => ['C2', 'C3'].includes(link.mode);
const attention = link => ['ABORTED', 'REJECTED', 'EXPIRED'].includes(link.status) || link.safetyState === 'SAFE_COUPLED';
const metric = (value, digits = 1) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? fixed(Number(value), digits) : '—';

function Stat({ icon: Icon, label, value, unit, note }) {
  return <div className="coop-stat"><Icon size={17}/><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>;
}

function Participant({ satellite, role, onTwin }) {
  if (!satellite) return <div className="coop-participant"><strong>Participant unavailable</strong><p>Its state is not present in this snapshot.</p></div>;
  const margin = satellite.energyWh - satellite.reserveWh;
  return <article className="coop-participant">
    <div className="coop-participant-top"><span>{role}</span><button aria-label={`Inspect ${satellite.name || satellite.id}`} onClick={() => onTwin?.(satellite.id)}><ArrowUpRight size={16}/></button></div>
    <div className="coop-participant-name"><div><Satellite size={22}/></div><span><strong>{satellite.name || satellite.id}</strong><small>{satellite.id} · {satellite.priority ? `P${satellite.priority.level} ${satellite.priority.label}` : satellite.role}</small></span></div>
    <Status small value={satellite.observedHealth || 'UNKNOWN'}/>
    <div className="coop-battery"><Battery size={14}/><strong>{metric(satellite.energyWh, 2)}<small> Wh</small></strong><span>{metric(satellite.energyWh / satellite.capacityWh * 100, 0)}%</span></div>
    <div className="coop-energy-track"><i style={{ width: `${Math.min(100, Math.max(0, satellite.energyWh / satellite.capacityWh * 100))}%` }}/><span style={{ left: `${satellite.reserveWh / satellite.capacityWh * 100}%` }}/></div>
    <dl><div><dt>Reserve margin</dt><dd className={margin < 0 ? 'danger-text' : ''}>{metric(margin, 2)} Wh</dd></div><div><dt>Mission</dt><dd>{friendly(satellite.mission?.status)}</dd></div><div><dt>Modeled compute quality</dt><dd>{metric(satellite.computeQuality * 100, 0)}%</dd></div></dl>
    <button className="text-button" onClick={() => onTwin?.(satellite.id)}>Open digital twin <ArrowRight size={13}/></button>
  </article>;
}

function NetworkMap({ sats, communications, onTwin }) {
  const positions = sats.map((sat, index) => ({ sat, x: 50 + 36 * Math.cos(index / Math.max(1, sats.length) * Math.PI * 2 - Math.PI / 2), y: 50 + 36 * Math.sin(index / Math.max(1, sats.length) * Math.PI * 2 - Math.PI / 2) }));
  const active = (communications?.links || []).filter(link => link.status === 'ACTIVE' && link.dataState === 'OPERATIONAL');
  return <div className="coop-network-map"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="23"/>{active.map(link => {
    const [a, b] = link.participants.map(id => positions.find(point => point.sat.id === id));
    return a && b ? <line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/> : null;
  })}</svg><div className="coop-network-core"><Network size={26}/><strong>{active.length}</strong><small>telemetry links</small></div>{positions.map(({ sat, x, y }) => <button className="coop-network-node" key={sat.id} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onTwin?.(sat.id)} aria-label={`Open ${sat.name || sat.id} digital twin`}><Satellite size={17}/><strong>{sat.name || sat.id}</strong><small>{sat.priority ? `P${sat.priority.level}` : sat.id}</small></button>)}</div>;
}

function OperationDetail({ link, contract, sats, onTwin, onDecision, onControl, busy, events, time }) {
  const [tab, setTab] = useState('overview');
  const isPhysical = physical(link), captured = link.mechanicalState === 'CAPTURED';
  const approaching = link.mechanicalState === 'APPROACH' && link.status === 'ACTIVE';
  const title = captured ? link.safetyState === 'SAFE_COUPLED' ? 'Safe coupled · paths isolated' : 'Physical capture verified' : approaching ? 'Controlled approach in progress' : link.mechanicalState === 'RELEASED' ? 'Separation complete' : isPhysical ? 'Physical operation ' + friendly(link.status) : 'Wireless service ' + friendly(link.status);
  const participants = link.participants || [];
  const [requester, provider] = participants.map(id => sats.find(sat => sat.id === id));
  const evidence = (events || []).filter(event => event.contractId === link.contractId || (contract?.decisionId && event.decisionId === contract.decisionId));
  const stages = [
    ['Agreement', contract?.start, !!contract], ['Service active', link.startedAt, Number.isFinite(link.startedAt)],
    ['Capture', link.capturedAt, captured || Number.isFinite(link.capturedAt)], ['Verified output', link.verification?.time, !!link.verification?.predicatePassed],
    ['Released', link.detachmentTime, link.mechanicalState === 'RELEASED'],
  ].filter(([label]) => isPhysical || !['Capture', 'Released'].includes(label));
  return <div className="coop-operation-detail">
    <div className="coop-operation-title"><div><span className="eyebrow">{link.id}</span><h2>{title}</h2><p>{modes[link.mode] || link.mode} <span>·</span> {participants.join(' ↔ ')}</p></div><Status value={link.status || 'UNKNOWN'}/></div>
    <div className="coop-detail-tabs" role="tablist" aria-label="Operation detail"><button role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}><Activity size={14}/>Live operation</button><button role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}><FileText size={14}/>Evidence <small>{evidence.length}</small></button></div>
    {tab === 'overview' ? <>
      <div className="coop-flow-layout"><Participant satellite={requester} role="REQUESTER / RECEIVER" onTwin={onTwin}/><div className="coop-flow-center"><div className={'coop-link-emblem ' + (captured ? 'captured' : '')}>{isPhysical ? <Link2 size={29}/> : <Radio size={29}/>}</div><span className="eyebrow">{captured ? 'MECHANICAL CONNECTION' : approaching ? 'APPROACH · CAPTURE PENDING' : 'SERVICE CHANNEL'}</span><div className="coop-flow-line"><i/><span/><i/></div><strong>{metric(link.transferW || 0, 1)} <small>W transferred now</small></strong><p>{provider?.name || participants[1]} → {requester?.name || participants[0]}</p><div className="coop-path-states">{[['Mechanical', link.mechanicalState], ['Data', link.dataState], ['Power', link.powerState]].map(([label, value]) => <div key={label}><span>{label}</span><Status small value={value || 'UNKNOWN'}/></div>)}</div></div><Participant satellite={provider} role="PROVIDER / DONOR" onTwin={onTwin}/></div>
      <div className="coop-ledger-strip"><div><span>Energy exported</span><strong>{metric(link.exportedWh || 0, 4)} <small>Wh</small></strong></div><div><span>Energy received</span><strong>{metric(link.receivedWh || 0, 4)} <small>Wh</small></strong></div><div><span>Accounted losses</span><strong>{metric(link.lossWh || 0, 4)} <small>Wh</small></strong></div><div><span>Delivered data</span><strong>{metric(link.dataTransferredMbit || 0, 3)} <small>Mbit</small></strong></div></div>
      <div className="coop-safety-grid"><section><h3><ShieldCheck size={16}/>Protection &amp; geometry</h3><dl><div><dt>Protected donor reserve</dt><dd>{metric(contract?.donorReserveWh ?? provider?.reserveWh, 1)} Wh</dd></div><div><dt>Relative separation</dt><dd>{metric(link.relativeDistanceM, 1)} m</dd></div><div><dt>Relative speed</dt><dd>{metric(link.relativeSpeedMps, 3)} m/s</dd></div>{captured && <div><dt>Combined mass</dt><dd>{metric(link.combinedMassKg, 3)} kg</dd></div>}</dl></section><section><h3><Unplug size={16}/>Release &amp; local veto</h3><strong className="coop-release-status">{link.safetyState === 'SAFE_COUPLED' ? 'Safe coupled / isolated' : link.mechanicalState === 'RELEASED' ? 'Independent propagation resumed' : captured && Number.isFinite(link.detachmentTime) ? `Forecast T+ ${fmtTime(link.detachmentTime)}` : isPhysical ? 'Capture required before release' : 'Wireless vehicles remain separate'}</strong><p>{link.detachmentReason || 'Release is checked against current local control and interface conditions.'}</p>{captured && onControl && <button className="secondary small-button" disabled={busy} onClick={() => onControl('release', link.id)}><Unplug size={13}/>Revalidate &amp; request release</button>}</section></div>
    </> : <div className="coop-evidence"><div className="coop-evidence-contract"><span>Agreement reference</span><strong>{contract?.id || 'Unavailable'}</strong><Status small value={contract?.status || 'UNKNOWN'}/></div><p>Recorded state transitions and delivered resources provide the evidence for this operation.</p>{evidence.length ? <div className="coop-event-list">{evidence.map(event => <div key={event.id}><span className={'coop-event-dot ' + (['critical', 'error'].includes(event.severity) ? 'danger' : '')}/><time>T+ {fmtTime(event.time)}</time><p>{event.message}</p></div>)}</div> : <div className="coop-no-evidence">No matching events are present in the latest snapshot. The full timeline may contain earlier records.</div>}{link.verification && <div className="coop-verification"><ShieldCheck size={20}/><div><strong>{link.verification.predicatePassed ? 'Output predicate passed' : 'Output predicate failed'}</strong><p>Recorded T+ {fmtTime(link.verification.time)} · quality {metric(link.verification.quality, 2)}</p></div></div>}</div>}
    <section className="coop-lifecycle"><div><span className="eyebrow">ACTUAL MILESTONES</span><button className="text-button" onClick={onDecision}>Why this partner?<ArrowUpRight size={13}/></button></div><ol>{stages.map(([label, at, reached]) => <li key={label} className={reached ? 'reached' : ''}><span>{reached ? <Check size={12}/> : <Clock3 size={12}/>}</span><strong>{label}</strong><small>{reached && Number.isFinite(at) ? `T+ ${fmtTime(at)}` : reached ? 'Recorded' : attention(link) ? 'Not reached' : 'Pending'}</small></li>)}</ol></section>
  </div>;
}

export default function CooperationWorkspace({ connection, connections = [], onSelectConnection, contracts = [], sats = [], onTwin, onDecision, onFault, onScenario, onLaunchDocking, onControl, busy = false, playing = false, communications, events = [], time = 0 }) {
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const visible = useMemo(() => connections.filter(link => {
    const matches = filter === 'all' || filter === 'active' && live(link) || filter === 'physical' && physical(link) || filter === 'wireless' && !physical(link) || filter === 'attention' && attention(link);
    const haystack = [link.id, modes[link.mode], link.status, ...(link.participants || []).flatMap(id => [id, sats.find(sat => sat.id === id)?.name])].join(' ').toLowerCase();
    return matches && haystack.includes(search.toLowerCase());
  }).sort((a, b) => Number(live(b)) - Number(live(a)) || (b.startedAt || 0) - (a.startedAt || 0)), [connections, filter, search, sats]);
  const selected = visible.find(link => link.id === connection?.id) || visible[0];
  const contract = selected && contracts.find(item => item.id === selected.contractId);
  const active = connections.filter(live).length, captured = connections.filter(link => link.mechanicalState === 'CAPTURED').length;
  const data = connections.reduce((sum, link) => sum + (link.dataTransferredMbit || 0), 0), received = connections.reduce((sum, link) => sum + (link.receivedWh || 0), 0);
  return <div className="coop-workspace">
    <header className="coop-hero"><div><span className="eyebrow">CONSTELLATION OPERATIONS</span><h2>Cooperation control<span>.</span></h2><p>Follow partner selection, physical capture and verified resource exchange across your fleet.</p></div><div className="coop-hero-actions">{onControl && <><button className="secondary" disabled={busy} onClick={() => onControl(playing ? 'pause' : 'play')}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Resume'}</button><button className="secondary" disabled={busy} onClick={() => onControl('step', 60)}><SkipForward size={14}/>+60 s</button></>}<button className="primary" disabled={busy} onClick={onLaunchDocking || onScenario}><Link2 size={14}/>Docking demonstration</button></div></header>
    <div className="coop-stats"><Stat icon={Activity} label="LIVE OPERATIONS" value={active} note="Active or verified service records"/><Stat icon={Link2} label="PHYSICAL CAPTURES" value={captured} note="Includes safely isolated coupled pairs"/><Stat icon={Radio} label="MISSION DATA DELIVERED" value={metric(data, 2)} unit="Mbit" note="Separate from routine telemetry"/><Stat icon={Zap} label="USEFUL ENERGY RECEIVED" value={metric(received, 3)} unit="Wh" note="Actual transfer ledger quantities"/></div>
    <div className="coop-console"><aside className="coop-operation-list"><div className="coop-list-title"><h3>Operations</h3><span>{connections.length}</span></div><label className="coop-search"><Search size={14}/><input aria-label="Search cooperation operations" value={search} onChange={event => setSearch(event.target.value)} placeholder="Satellite, link or status…"/></label><div className="coop-filters" aria-label="Operation filters">{[['all', 'All'], ['active', 'Live'], ['physical', 'Physical'], ['wireless', 'Wireless'], ['attention', 'Attention']].map(([id, label]) => <button key={id} className={filter === id ? 'selected' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="coop-links">{visible.map(link => <button key={link.id} className={selected?.id === link.id ? 'selected' : ''} onClick={() => onSelectConnection?.(link.id)}><div className={'coop-list-icon ' + (physical(link) ? 'physical' : '')}>{physical(link) ? <Link2 size={16}/> : <Radio size={16}/>}</div><span><strong>{link.participants?.map(id => sats.find(sat => sat.id === id)?.name || id).join(' ↔ ')}</strong><small>{modes[link.mode]} · {friendly(link.status)}</small><em>{link.id}</em></span><ChevronRight size={13}/></button>)}{!visible.length && <div className="coop-list-empty"><Filter size={21}/><strong>{connections.length ? 'No matching operations' : 'No mission operation yet'}</strong><p>{connections.length ? 'Try another filter or search.' : 'Routine telemetry can run before a mission needs cooperation.'}</p></div>}</div><div className="coop-list-foot"><ShieldCheck size={14}/>Physical and donor safety gates remain authoritative.</div></aside>
      {selected ? <OperationDetail key={selected.id} link={selected} contract={contract} sats={sats} onTwin={onTwin} onDecision={onDecision} onControl={onControl} busy={busy} events={events} time={time}/> : <section className="coop-ready"><div className="coop-ready-heading"><span className="eyebrow">FLEET READINESS</span><h2>Your fleet, one operations view.</h2><p>{communications?.enabled === false ? 'This configuration keeps routine telemetry disabled. Inspect a satellite or launch a cooperative scenario.' : 'Inspect current telemetry contacts while mission support waits for a diagnosed need.'}</p></div><NetworkMap sats={sats} communications={communications} onTwin={onTwin}/><div className="coop-ready-actions"><button className="secondary" onClick={onFault}><Zap size={14}/>Introduce a mission fault</button><button className="text-button" onClick={onScenario}>Explore research scenarios<ArrowRight size={14}/></button></div><div className="coop-ready-note"><Cpu size={15}/><span>Wireless assistance shares a service. Physical support adds validated approach, capture, protected power and controlled separation.</span></div></section>}
    </div>
  </div>;
}
