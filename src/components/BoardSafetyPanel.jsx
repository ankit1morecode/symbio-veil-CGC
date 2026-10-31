import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, CircleHelp, HeartPulse, Layers3, ShieldCheck, Zap } from 'lucide-react';
import { fixed, fmtTime } from '../ui.jsx';
import './board-safety.css';

const statusText = value => value === 'NOT_APPLICABLE' ? 'N/A' : value === 'NOT_MODELED' ? 'Not modeled' : String(value || 'UNKNOWN').replaceAll('_', ' ');
const statusClass = value => String(value || 'UNKNOWN').toLowerCase().replaceAll('_', '-');
const fields = [['watchdog', 'Watchdog / heartbeat'], ['power', 'Power / rail'], ['thermal', 'Thermal margin'], ['dependencies', 'Upstream dependencies'], ['protection', 'Safety protection']];

function SafetyStatus({ value }) {
  return <span className={'board-check-status board-check-' + statusClass(value)}><i/>{statusText(value)}</span>;
}

function fallbackBoards(satellite, truth) {
  const groups = new Map();
  for (const component of satellite.components || []) {
    const name = component.board || 'Components';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(component);
  }
  return Array.from(groups, ([name, components]) => {
    const modeled = components.some(component => component.simulationStatus !== 'CATALOG_ONLY');
    const states = components.map(component => truth ? component.health : component.observedHealth);
    const health = !modeled ? 'UNKNOWN' : states.includes('FAILED') ? 'FAILED' : states.includes('DEGRADED') ? 'DEGRADED' : states.every(state => state === 'OPERATIONAL') ? 'OPERATIONAL' : 'UNKNOWN';
    const unknown = { status: modeled ? 'UNKNOWN' : 'NOT_MODELED', detail: modeled ? 'Safety telemetry has not been supplied for this run.' : 'Reference hardware inventory; safety behavior is not simulated.' };
    return { id: name, name, componentIds: components.map(component => component.id), health, overall: modeled ? 'UNKNOWN' : 'NOT_MODELED', modeled, watchdog: unknown, power: unknown, thermal: unknown, dependencies: unknown, protection: unknown, updatedAt: null };
  });
}

export default function BoardSafetyPanel({ satellite, selectedComponentId, truth, onSelectComponent, onFault }) {
  const supplied = truth ? satellite.boardSafety : satellite.observedBoardSafety;
  const boards = useMemo(() => Array.isArray(supplied) ? supplied : fallbackBoards(satellite, truth), [supplied, satellite.components, truth]);
  const selected = satellite.components?.find(component => component.id === selectedComponentId) || satellite.components?.[0];
  const selectedBoard = boards.find(board => board.componentIds?.includes(selected?.id));
  const [open, setOpen] = useState({});
  useEffect(() => { if (selectedBoard) setOpen(current => ({ ...current, [selectedBoard.id]: true })); }, [selectedBoard?.id, satellite.id]);
  const modeled = selected?.simulationStatus !== 'CATALOG_ONLY';
  return <section className="component-detail board-safety-panel" aria-label="Board health and safety tables">
    <header className="board-safety-header"><div className="eyebrow">BOARD HEALTH &amp; SAFETY</div><h3>{selected?.name || 'Select a board'}</h3><div className="component-id mono">{selected?.id}</div><div className="board-safety-layer"><ShieldCheck size={13}/>{truth ? 'Simulation truth' : 'Agent observations'}</div></header>
    <div className="board-safety-tables">{boards.map(board => {
      const expanded = !!open[board.id];
      const active = board.id === selectedBoard?.id;
      return <section className={'board-safety-group ' + (active ? 'selected' : '')} key={board.id}>
        <button className="board-safety-heading" onClick={() => setOpen(current => ({ ...current, [board.id]: !expanded }))} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<Layers3 size={14}/><span>{board.name}</span><SafetyStatus value={board.overall}/>
        </button>
        {expanded && <div className="board-safety-content"><div className="board-component-buttons">{board.componentIds?.map(id => {
          const component = satellite.components?.find(item => item.id === id);
          return <button className={selected?.id === id ? 'selected' : ''} key={id} onClick={() => onSelectComponent?.(id)}>{component?.name || id}</button>;
        })}</div><table className="board-safety-table"><caption>{board.name} status</caption><thead><tr><th scope="col">Feature</th><th scope="col">Status</th></tr></thead><tbody>
          <tr><th scope="row">Board health</th><td><SafetyStatus value={board.modeled === false ? 'NOT_MODELED' : board.health}/></td></tr>
          {Number.isFinite(board.activeFaultCount) && board.modeled !== false && <tr><th scope="row">Active fault incidents</th><td><SafetyStatus value={board.activeFaultCount > 0 ? 'WARNING' : 'OK'}/><small>{board.activeFaultCount} {board.activeFaultCount === 1 ? 'incident' : 'incidents'}</small></td></tr>}
          {fields.map(([key, label]) => <tr key={key}><th scope="row">{label}<small>{board[key]?.detail || 'No status available.'}</small></th><td><SafetyStatus value={board[key]?.status}/></td></tr>)}
        </tbody></table><div className="board-safety-sample"><HeartPulse size={12}/>{Number.isFinite(board.updatedAt) ? `Updated T+ ${fmtTime(board.updatedAt)}` : 'No modeled sample'}{Number.isFinite(board.watchdog?.lastHeartbeatAt) && <span>Heartbeat T+ {fmtTime(board.watchdog.lastHeartbeatAt)}</span>}</div></div>}
      </section>;
    })}</div>
    {selected && <div className="board-selected-detail"><h4>Selected component</h4><dl><div><dt>Power</dt><dd>{modeled && Number.isFinite(selected.powerW) ? `${fixed(selected.powerW)} W` : 'Not modeled'}</dd></div><div><dt>Temperature</dt><dd>{!modeled ? 'Not modeled' : truth && Number.isFinite(selected.temperatureK) ? `${fixed(selected.temperatureK)} K` : 'Spacecraft observation'}</dd></div><div><dt>Confidence</dt><dd>{modeled && Number.isFinite(selected.confidence) ? `${fixed(selected.confidence * 100)}%` : 'Unknown'}</dd></div></dl>{!modeled && <p><CircleHelp size={13}/>{selected.purpose}. This reference board has no simulated health, safety or electrical behavior.</p>}{!modeled && selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">View hardware reference ↗</a>}</div>}
    <button className="fault-launch" disabled={!selected?.faultClasses?.length} onClick={() => onFault?.(satellite.id, selected?.id)}><span><Zap size={15}/>Inject component fault<small>Watch the board safety status update</small></span><ArrowRight size={14}/></button>
  </section>;
}
