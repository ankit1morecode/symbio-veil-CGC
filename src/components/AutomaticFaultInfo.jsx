import React from 'react';
import { Clock3, Shuffle } from 'lucide-react';
import { fmtTime } from '../ui.jsx';
import './automatic-fault-info.css';

export default function AutomaticFaultInfo({ snapshot }) {
  const engine = snapshot.faultEngine;
  const manual = snapshot.faultMode === 'MANUAL';
  const incidents = (snapshot.faults || []).filter(fault => ['SCENARIO_AUTO', 'STOCHASTIC'].includes(fault.origin)).slice(-3).reverse();
  const scenarioIncident = engine?.scenarioFaultModel;
  const rate = engine?.hazardPerNodeHour;
  return <details className="automatic-fault-info">
    <summary><Shuffle size={14}/>How automatic faults work<span>{manual ? 'Suppressed' : 'Enabled'}</span></summary>
    <div className="automatic-fault-content">
      <p><Clock3 size={13}/>{snapshot.playing ? 'Running in simulation time' : 'Paused with the simulation'} · seed {snapshot.seed}</p>
      <dl><div><dt>Scenario incident</dt><dd>{!engine ? 'Awaiting backend details' : scenarioIncident ? `${scenarioIncident} at T+ ${fmtTime(engine.scenarioFaultAt)}` : 'No scripted fault in this scenario'}</dd></div><div><dt>Random model</dt><dd>{engine ? engine.hazardModel : 'Awaiting backend details'}</dd></div>{engine?.hazardModel === 'WEIBULL' ? <div><dt>Weibull settings</dt><dd>β {engine.weibullBeta} · η {engine.weibullEtaHours} node-hours</dd></div> : engine && <div><dt>Rate per eligible component</dt><dd>{rate > 0 ? `${rate} / simulated hour` : 'Disabled'}</dd></div>}<div><dt>Eligible components</dt><dd>{engine?.eligibleComponents ?? 'Unknown'}</dd></div></dl>
      <p>{manual ? 'Manual mode suppresses automatic incidents as they become due. Existing faults remain active.' : 'Automatic mode accepts only seeded incidents; Hybrid also accepts manual injection. Random incidents can be absent in short runs.'}</p>
      <p>Physical effects happen first. Most component faults are diagnosed after a six-second simulation timeout; monitoring failures can hide observations. Specialist inventory boards do not receive random faults.</p>
      {incidents.length > 0 && <div className="automatic-fault-recent"><strong>Recent automatic incidents</strong>{incidents.map(fault => <div key={fault.id}><span>{fault.spacecraftId} · {fault.modelId}</span><small>{fault.origin === 'SCENARIO_AUTO' ? 'Scenario' : 'Seeded random'} · {String(fault.status || 'UNKNOWN').toLowerCase()}</small></div>)}</div>}
    </div>
  </details>;
}
