// P03 Symbiotic Pair Twin (UX-020 to 029). Both structural models side by side
// with independent component selection, the contract header, the exchange flow
// and the release forecast. Every value here is read from the run snapshot; a
// stage the engine has not recorded is shown as NOT RECORDED rather than filled in.
import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Battery, Check, Cpu, Database, Eye, Radio, ShieldCheck, Thermometer, TriangleAlert, Unplug, Zap } from 'lucide-react';
import TwinScene from './TwinScene.jsx';
import { fixed, fmtTime, friendly, Status } from '../ui.jsx';
import { pairMode, releaseForecast, RELEASE_LABEL } from './pairState.js';
import './pair-twin.css';

const num = (value, digits = 2) => Number.isFinite(Number(value)) ? fixed(Number(value), digits) : '—';

function Participant({ satellite, role, truth, selected, onSelect, onTwin }) {
  if (!satellite) return <div className="pt-vehicle"><p className="pt-empty">Participant not present in this snapshot.</p></div>;
  const shown = useMemo(() => ({
    ...satellite,
    components: (satellite.components || []).map(c => ({
      ...c,
      health: c.simulationStatus === 'CATALOG_ONLY' ? 'UNKNOWN' : truth ? c.health : c.observedHealth || 'UNKNOWN',
    })),
  }), [satellite, truth]);
  const energy = truth ? satellite.energyWh : satellite.lastObservedEnergyWh;
  const margin = (energy ?? 0) - satellite.reserveWh;
  const component = (satellite.components || []).find(c => c.id === selected);
  return <article className="pt-vehicle">
    <header>
      <div>
        <span className="pt-role">{role}</span>
        <h3>{satellite.name || satellite.id}<button aria-label={`Open ${satellite.id} twin`} onClick={() => onTwin?.(satellite.id)}><ArrowUpRight size={14} /></button></h3>
        <small>{satellite.id} · {satellite.classId} · manifest {satellite.manifestId || 'OSV-REF'} v{satellite.manifestVersion || '1.0'}</small>
      </div>
      <Status small value={(truth ? satellite.health : satellite.observedHealth) || 'UNKNOWN'} />
    </header>

    <div className="pt-scene">
      <TwinScene satellite={shown} selectedComponent={selected} onSelectComponent={onSelect} pair />
    </div>

    <div className="pt-telemetry">
      <div><Battery size={13} /><span>Stored</span><strong>{num(energy)}<small> Wh</small></strong></div>
      <div className={margin < 0 ? 'danger' : ''}><ShieldCheck size={13} /><span>Reserve margin</span><strong>{num(margin)}<small> Wh</small></strong></div>
      <div><Zap size={13} /><span>Generation / load</span><strong>{num(satellite.solarW, 0)}<small> / {num(satellite.loadW, 0)} W</small></strong></div>
      <div><Cpu size={13} /><span>Compute quality</span><strong>{num((satellite.computeQuality ?? 0) * 100, 0)}<small> %</small></strong></div>
      <div><Radio size={13} /><span>Usable rate</span><strong>{num(satellite.radioKbps, 0)}<small> kbit/s</small></strong></div>
      <div><Thermometer size={13} /><span>{truth ? 'Physical' : 'Reported'} temp</span><strong>{num(truth ? satellite.temperatureK : satellite.observedTemperatureK, 1)}<small> K</small></strong></div>
    </div>

    {/* UX-022: observed and actual are never conflated. */}
    <p className="pt-divergence">
      {satellite.observedHealth !== satellite.health
        ? <><TriangleAlert size={12} /> Observed {friendly(satellite.observedHealth)} · actual {friendly(satellite.health)}</>
        : <><Check size={12} /> Observation agrees with physical state</>}
    </p>

    {component && <div className="pt-component">
      <strong>{component.name}</strong>
      <span>{component.board}{component.simulationStatus === 'CATALOG_ONLY' ? ' · not modelled' : component.simulationStatus === 'DECLARED' ? ' · declared, follows its parent' : ''}</span>
      <Status small value={(truth ? component.health : component.observedHealth) || 'UNKNOWN'} />
    </div>}
  </article>;
}

function Lifecycle({ connection, contract }) {
  const accepted = contract?.acceptanceRecord ? Math.max(...Object.values(contract.acceptanceRecord).map(r => r.at ?? 0)) : null;
  const physical = connection && connection.mode !== 'C1';
  const stages = [
    ['Request', contract?.start],
    ['Acceptance', accepted],
    ['Rendezvous', physical ? connection?.approachStart : null],
    ['Capture', connection?.capturedAt],
    ['Interfaces live', connection?.capturedAt != null && connection?.powerState !== 'ISOLATED' ? connection.capturedAt : null],
    ['Service', connection?.startedAt],
    ['Verification', connection?.verification?.time],
    [connection?.status === 'ABORTED' ? 'Abort' : 'Termination', connection?.status === 'ABORTED' ? connection?.verification?.time ?? contract?.start : null],
    ['Separation', connection?.mechanicalState === 'RELEASED' ? connection.detachmentTime : null],
  ];
  return <ol className="pt-lifecycle">
    {stages.map(([label, at]) => <li key={label} className={Number.isFinite(at) ? 'done' : ''}>
      <i /><span>{label}</span><strong>{Number.isFinite(at) ? `T+ ${fmtTime(at)}` : 'NOT RECORDED'}</strong>
    </li>)}
  </ol>;
}

function Flow({ connection }) {
  const live = connection && ['ACTIVE', 'VERIFIED'].includes(connection.status);
  const wireless = connection?.mode === 'C1';
  const powerLive = live && connection.powerState === 'PROTECTED_ACTIVE' && connection.transferW > 0;
  const dataLive = live && connection.dataState === 'OPERATIONAL' && (wireless || connection.dataTransferredMbit > 0);
  return <div className="pt-flow">
    <div className="pt-flow-head">
      <span>{wireless ? 'CROSS-LINK' : 'DIRECT INTERFACE'}</span>
      {wireless && <small>No mechanical latch · no direct electrical path</small>}
    </div>

    <div className={'pt-path data' + (dataLive ? ' live' : '')}>
      <Database size={14} />
      <div>
        <strong>Data</strong>
        <span>{dataLive ? `${num(connection.dataTransferredMbit, 2)} Mbit delivered` : 'No verified data exchange'}</span>
      </div>
      {dataLive && <ArrowRight size={14} className="pt-arrow" />}
    </div>

    <div className={'pt-path power' + (powerLive ? ' live' : '')}>
      <Zap size={14} />
      <div>
        <strong>Power</strong>
        <span>{powerLive
          ? `${num(connection.transferW, 1)} W · ${num(connection.exportedWh, 3)} Wh exported, ${num(connection.receivedWh, 3)} received, ${num(connection.lossWh, 3)} lost`
          : wireless ? 'Electrically isolated by mode' : 'No active power path'}</span>
      </div>
      {powerLive && <ArrowRight size={14} className="pt-arrow" />}
    </div>

    {connection?.combinedMassKg && <div className="pt-coupled">
      <span>Coupled mass<strong>{num(connection.combinedMassKg, 3)} kg</strong></span>
      <span>Control margin<strong>{num(connection.controlMarginNm, 4)} N·m</strong></span>
      <span>Inertia<strong>{(connection.combinedInertiaKgm2 || []).map(v => num(v, 3)).join(' / ')} kg·m²</strong></span>
    </div>}
  </div>;
}

export default function PairTwin({ connection, contract, sats = [], onTwin, onBack, time = 0 }) {
  const [truth, setTruth] = useState(false);
  const [leftSelected, setLeftSelected] = useState(null);
  const [rightSelected, setRightSelected] = useState(null);
  const [a, b] = (connection?.participants || []).map(id => sats.find(s => s.id === id));
  const mode = pairMode(connection);
  const forecast = releaseForecast(connection);
  const forecastLabel = forecast.status === 'ETA' ? `T+ ${fmtTime(forecast.at)}` : RELEASE_LABEL[forecast.status];
  const verification = connection?.verification;

  return <div className="pair-twin">
    <div className="page-subnav">
      <button className="text-button" onClick={onBack}><ArrowLeft size={14} />Back to cooperation overview</button>
      <div className="view-toggle">
        <button className={!truth ? 'selected' : ''} onClick={() => setTruth(false)}><Eye size={13} />Agent observations</button>
        <button className={truth ? 'selected' : ''} onClick={() => setTruth(true)}>Simulation truth</button>
      </div>
    </div>

    <header className="pt-header">
      <div className="pt-ids">
        <h2>{a?.id || '—'} <span>+</span> {b?.id || '—'}</h2>
        <p>{a?.name} and {b?.name} · synchronized at T+ {fmtTime(time)}</p>
      </div>
      <div className="pt-badges">
        <span className={'pt-mode mode-' + mode.toLowerCase()}>{mode.replace('_', ' ')}</span>
        <span className="pt-srcc">SRCC<strong>{contract?.id || 'NONE'}</strong></span>
        <span className="pt-verified">
          {verification
            ? <>{verification.predicatePassed ? <Check size={12} /> : <TriangleAlert size={12} />}{verification.predicatePassed ? 'VERIFIED' : 'VERIFICATION FAILED'}</>
            : <>Verification<strong>PENDING</strong></>}
        </span>
      </div>
    </header>

    {contract?.abortReason && <div className="pt-alarm"><TriangleAlert size={16} />{contract.abortReason}</div>}

    <div className="pt-body">
      <Participant satellite={a} role="REQUESTER" truth={truth} selected={leftSelected} onSelect={setLeftSelected} onTwin={onTwin} />
      <div className="pt-centre">
        <Flow connection={connection} />
        <div className="pt-release">
          <span className="eyebrow">RELEASE FORECAST</span>
          <strong className={forecast.safe ? '' : 'danger-text'}>{forecastLabel}</strong>
          <p>{forecast.reason}</p>
          {connection?.mode !== 'C1' && <small><Unplug size={11} /> Mechanical {friendly(connection?.mechanicalState)} · data {friendly(connection?.dataState)} · power {friendly(connection?.powerState)}</small>}
        </div>
        <Lifecycle connection={connection} contract={contract} />
      </div>
      <Participant satellite={b} role="PROVIDER" truth={truth} selected={rightSelected} onSelect={setRightSelected} onTwin={onTwin} />
    </div>
  </div>;
}
