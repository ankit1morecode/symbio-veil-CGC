import React from 'react';
import { Battery, Link2, Orbit, Sun, Moon } from 'lucide-react';
import { fixed } from '../ui.jsx';

const earthRadiusM = 6378137;

const Tag = ({ children }) => <span className="info-tag">{children}</span>;

export default function FleetOperations({ spacecraft, connections, onDockingScenario, onPairSelect, onModelReference, busy }) {
  const physical = connections.filter(link => ['C2', 'C3'].includes(link.mode));
  const current = physical.findLast(link => link.mechanicalState === 'CAPTURED' || (link.mechanicalState === 'APPROACH' && link.status === 'ACTIVE'));
  const last = current || physical.at(-1);
  return <section className="fleet-operations">
    <div className="fleet-operations-head"><div><span className="eyebrow">SIX-SATELLITE CONSTELLATION</span><h2>Orbit &amp; power</h2><div className="info-tags"><Tag>Independent orbits</Tag><Tag>Sunlight charges</Tag><Tag>Shadow stops generation</Tag></div></div><Orbit size={24}/></div>
    <div className="fleet-orbit-grid">{spacecraft.map(sat => {
      const speed = Array.isArray(sat.velocity) ? Math.hypot(...sat.velocity) / 1000 : NaN;
      const altitude = Array.isArray(sat.position) ? (Math.hypot(...sat.position) - earthRadiusM) / 1000 : NaN;
      const solar = Number(sat.solarW), load = Number(sat.loadW);
      const power = Number.isFinite(solar) && Number.isFinite(load) ? solar - load : NaN;
      return <article className="fleet-orbit-card" key={sat.id}>
        <div className="fleet-orbit-card-head"><strong>{sat.name || sat.id}</strong><small>{sat.id}</small></div>
        <div className={'fleet-illumination ' + (sat.eclipse ? 'shadow' : 'sunlight')}>{sat.eclipse ? <Moon size={14}/> : <Sun size={14}/>} {sat.eclipse ? 'Earth shadow' : 'Sunlight'}</div>
        <div className="fleet-orbit-metric"><Battery size={14}/><span>Battery</span><strong>{fixed(sat.energyWh, 3)} Wh</strong></div>
        <div className="fleet-orbit-metric"><span>Solar / base load</span><strong>{fixed(solar, 1)} / {fixed(load, 1)} W</strong></div>
        <div className="fleet-orbit-metric"><span>Solar − base load</span><strong>{Number.isFinite(power) && power > 0 ? '+' : ''}{fixed(power, 1)} W</strong></div>
        <div className="fleet-orbit-metric"><span>Altitude</span><strong>{fixed(altitude, 1)} km</strong></div>
        <div className="fleet-orbit-metric"><span>Orbital speed</span><strong>{fixed(speed, 3)} km/s</strong></div>
      </article>;
    })}</div>
    <div className="info-tags fleet-power-note"><span className="info-tag-label">Solar − base load excludes</span><Tag>radio use</Tag><Tag>docking transfer</Tag><Tag>capacity limits</Tag><Tag>fault effects</Tag>{onModelReference && <button className="info-link" onClick={onModelReference}>Model reference →</button>}</div>
    <div className="docking-panel"><div><div className="eyebrow">PHYSICAL COOPERATION</div><h3><Link2 size={17}/> Docking &amp; power transfer</h3><div className="info-tags"><Tag>Approach</Tag><Tag>Capture</Tag><Tag>Protected transfer</Tag><Tag>Separation</Tag><span className="info-badge">Simplified research model</span></div>{last && <button className="text-button docking-status" onClick={() => onPairSelect?.(last.id)}>{last.participants?.join(' ↔ ')} · {String(last.mechanicalState || 'UNKNOWN').replaceAll('_', ' ')} · {last.status} · inspect details →</button>}</div><button className="secondary" disabled={busy} onClick={onDockingScenario}>Launch docking demonstration</button></div>
  </section>;
}
