// Graph Trend: historical telemetry analysis over the authoritative simulation
// clock. Every series here is fetched from the engine's telemetry endpoint; this
// component holds no simulation state and synthesises no values. Parameters the
// model does not implement are listed and disabled rather than plotted.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Check, Download, Layers3, Plus, Radio, Trash2, X, Zap } from 'lucide-react';
import { apiUrl } from '../api-config.js';
import { fmtTime, fixed, request, Empty } from '../ui.jsx';
import './graph-trend.css';

const SERIES_COLORS = ['#9be2be', '#78acf3', '#efbe78', '#d69fe9', '#e88f9d', '#6ed3ce', '#e5d27a', '#9dafe9'];
const WINDOWS = [[0, 'Whole run'], [300, 'Last 5 min'], [900, 'Last 15 min'], [3600, 'Last hour'], [21600, 'Last 6 h']];
const GRAPH_TYPES = [['line', 'Line'], ['area', 'Area'], ['multi', 'Multi-series'], ['events', 'Event overlay']];
const SEVERITY_COLOR = { critical: '#e5a19c', warning: '#e5b776', success: '#9fdcbc', info: '#7f909e' };

const keyOf = (ownerId, parameterId) => `${ownerId}|${parameterId}`;
const shortParam = id => id.split('.').slice(1).join('.') || id;

function Badge({ classification }) {
  const label = { MEASURED: 'measured', OBSERVED: 'observed', CALCULATED: 'calculated', DECLARED: 'declared', NOT_MODELLED: 'not modelled' }[classification] || classification;
  return <span className={'gt-badge gt-' + String(classification).toLowerCase()}>{label}</span>;
}

export default function GraphTrend({ snapshot, runId, notify, onSelectSpacecraft }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [owners, setOwners] = useState([]);          // spacecraft ids in scope
  const [subsystem, setSubsystem] = useState('battery');
  const [charts, setCharts] = useState([{ id: 'g1', keys: [] }]);
  const [activeChart, setActiveChart] = useState('g1');
  const [graphType, setGraphType] = useState('line');
  const [windowS, setWindowS] = useState(0);
  const [showEvents, setShowEvents] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [series, setSeries] = useState({});
  const lastFetch = useRef(-Infinity);

  const time = snapshot?.time ?? 0;
  const sats = snapshot?.spacecraft ?? [];

  // --- catalog ------------------------------------------------------------
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    request(`/runs/${runId}/telemetry`)
      .then(data => { if (cancelled) return; setCatalog(data); setError(null); setOwners(prev => prev.length ? prev : data.spacecraft.slice(0, 1).map(s => s.id)); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [runId]);

  const activeKeys = useMemo(() => [...new Set(charts.flatMap(chart => chart.keys))], [charts]);
  const keySignature = activeKeys.join(',');

  // --- series data --------------------------------------------------------
  const fetchSeries = useCallback(() => {
    if (!runId || !activeKeys.length) { setSeries({}); return; }
    const from = windowS ? Math.max(0, time - windowS) : undefined;
    const query = new URLSearchParams({ keys: activeKeys.join(',') });
    if (from !== undefined) query.set('from', String(from));
    request(`/runs/${runId}/telemetry/series?${query}`)
      .then(data => {
        const next = {};
        for (const entry of data.series) next[entry.key] = entry;
        setSeries(next);
        lastFetch.current = time;
        setError(null);
      })
      .catch(e => setError(e.message));
  }, [runId, keySignature, windowS, time, activeKeys]);

  useEffect(() => { fetchSeries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [runId, keySignature, windowS]);

  // Refresh as the authoritative clock advances, at the engine's own sample
  // rate. A paused run does not advance `time`, so nothing is refetched.
  useEffect(() => {
    const interval = catalog?.sampleIntervalS ?? 30;
    if (!activeKeys.length) return;
    if (time - lastFetch.current >= interval) fetchSeries();
  }, [time, catalog, activeKeys.length, fetchSeries]);

  // --- selection ----------------------------------------------------------
  const scopeParameters = useMemo(() => (catalog?.parameters ?? []).filter(entry => entry.subsystem === subsystem), [catalog, subsystem]);
  const componentsOf = useCallback(id => (catalog?.spacecraft.find(s => s.id === id)?.components ?? []).filter(c => c.modelled), [catalog]);

  const toggleKey = key => setCharts(prev => prev.map(chart => chart.id !== activeChart ? chart
    : { ...chart, keys: chart.keys.includes(key) ? chart.keys.filter(k => k !== key) : [...chart.keys, key].slice(0, 8) }));

  const chartKeys = charts.find(c => c.id === activeChart)?.keys ?? [];

  // --- chart rows ---------------------------------------------------------
  const rowsFor = useCallback(keys => {
    const byTime = new Map();
    for (const key of keys) {
      const entry = series[key];
      if (!entry?.available) continue;
      for (const [t, v] of entry.points) {
        if (!byTime.has(t)) byTime.set(t, { t });
        byTime.get(t)[key] = v;
      }
    }
    return [...byTime.values()].sort((a, b) => a.t - b.t);
  }, [series]);

  const domain = useMemo(() => {
    const from = windowS ? Math.max(0, time - windowS) : 0;
    return [from, Math.max(from + 1, time)];
  }, [windowS, time]);

  const visibleEvents = useMemo(() => (snapshot?.events ?? [])
    .filter(e => e.time >= domain[0] && e.time <= domain[1])
    .filter(e => ['FAULT_ACTIVE', 'FAULT_DIAGNOSED', 'FAULT_CLEARED', 'DECISION', 'CONTRACT_ACTIVE', 'CONTRACT_ABORTED', 'CAPTURE_VERIFIED', 'MISSION_VERIFIED', 'SEPARATION_COMPLETE', 'THRESHOLD_TRIPPED', 'THERMAL_DERATE'].includes(e.type)),
    [snapshot, domain]);

  const unitsOf = keys => [...new Set(keys.map(k => series[k]?.unit).filter(Boolean))];

  const exportCsv = () => {
    if (!activeKeys.length) { notify?.('Select at least one parameter to export.', 'error'); return; }
    const url = apiUrl(`/api/v1/runs/${runId}/telemetry/export.csv`) + '?' + new URLSearchParams({ keys: activeKeys.join(',') });
    const link = document.createElement('a');
    link.href = url; link.download = '';
    document.body.appendChild(link); link.click(); link.remove();
    notify?.(`Exporting ${activeKeys.length} series as CSV.`);
  };

  if (error && !catalog) return <Empty icon={AlertTriangle} title="Telemetry unavailable">{error}</Empty>;
  if (!catalog) return <Empty icon={Activity} title="Loading telemetry catalog">Reading the recorded series from the simulation service.</Empty>;

  return <div className="graph-trend">
    {/* upper toolbar */}
    <div className="gt-toolbar">
      <div className="gt-toolbar-group">
        <span className="eyebrow">SIMULATION TIME</span>
        <strong className="mono">T+ {fmtTime(time)}</strong>
        <small>{catalog.sampleCount} samples · every {catalog.sampleIntervalS} s{catalog.droppedPoints ? ` · ${catalog.droppedPoints} aged out` : ''}</small>
      </div>
      <div className="gt-toolbar-group">
        <span className="eyebrow">WINDOW</span>
        <select value={windowS} onChange={e => setWindowS(Number(e.target.value))}>
          {WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="gt-toolbar-group">
        <span className="eyebrow">GRAPH TYPE</span>
        <div className="gt-segment">
          {GRAPH_TYPES.map(([value, label]) =>
            <button key={value} className={graphType === value ? 'selected' : ''} onClick={() => setGraphType(value)}>{label}</button>)}
        </div>
      </div>
      <div className="gt-toolbar-actions">
        <button className={'secondary small-button ' + (showEvents ? 'selected' : '')} onClick={() => setShowEvents(!showEvents)}>
          <Zap size={13} />Event markers
        </button>
        <button className="secondary small-button" onClick={() => {
          const id = 'g' + (charts.length + 1) + Date.now().toString(36).slice(-3);
          setCharts([...charts, { id, keys: [] }]); setActiveChart(id);
        }}><Plus size={13} />Add graph</button>
        <button className="secondary small-button" onClick={exportCsv}><Download size={13} />Export CSV</button>
      </div>
    </div>

    <div className="gt-body">
      {/* left selection panel */}
      <aside className="gt-select">
        <div className="gt-select-block">
          <span className="eyebrow">SPACECRAFT</span>
          {catalog.spacecraft.map(sat => <label key={sat.id} className="gt-check">
            <input type="checkbox" checked={owners.includes(sat.id)}
              onChange={() => setOwners(prev => prev.includes(sat.id) ? prev.filter(x => x !== sat.id) : [...prev, sat.id])} />
            <span>{sat.name}<small>{sat.id} · {sat.manifestId}</small></span>
          </label>)}
          {catalog.connections.length > 0 && <>
            <span className="eyebrow second">COOPERATION LINKS</span>
            {catalog.connections.map(link => <label key={link.id} className="gt-check">
              <input type="checkbox" checked={owners.includes(link.id)}
                onChange={() => setOwners(prev => prev.includes(link.id) ? prev.filter(x => x !== link.id) : [...prev, link.id])} />
              <span>{link.participants.join(' + ')}<small>{link.mode} · {link.status}</small></span>
            </label>)}
          </>}
        </div>

        <div className="gt-select-block">
          <span className="eyebrow">SUBSYSTEM</span>
          <select value={subsystem} onChange={e => setSubsystem(e.target.value)}>
            {catalog.subsystems.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </div>

        <div className="gt-select-block gt-parameters">
          <span className="eyebrow">PARAMETER</span>
          {scopeParameters.length === 0 && <p className="gt-note">No parameters declared for this subsystem.</p>}

          {subsystem === 'component'
            ? owners.filter(id => id.startsWith('SAT-')).map(satId => <div key={satId} className="gt-component-group">
                <strong className="gt-group-title">{satId}</strong>
                {componentsOf(satId).map(component => <details key={component.id}>
                  <summary>{component.name}<small>{component.board}</small></summary>
                  {scopeParameters.map(parameter => {
                    const key = keyOf(component.id, parameter.id);
                    return <button key={key} className={'gt-param ' + (chartKeys.includes(key) ? 'on' : '')}
                      disabled={!parameter.supported} onClick={() => toggleKey(key)}>
                      <span>{parameter.name}<small>{parameter.unit}</small></span><Badge classification={parameter.classification} />
                    </button>;
                  })}
                </details>)}
              </div>)
            : scopeParameters.map(parameter => {
                const scopeOwners = parameter.scope === 'connection'
                  ? owners.filter(id => !id.startsWith('SAT-'))
                  : owners.filter(id => id.startsWith('SAT-'));
                if (!parameter.supported) {
                  return <div key={parameter.id} className="gt-param unsupported" title="This model does not implement this parameter">
                    <span>{parameter.name}<small>{parameter.unit}</small></span><Badge classification={parameter.classification} />
                  </div>;
                }
                if (!scopeOwners.length) return null;
                return <div key={parameter.id} className="gt-param-row">
                  <div className="gt-param-head"><span>{parameter.name}<small>{parameter.unit}</small></span><Badge classification={parameter.classification} /></div>
                  <div className="gt-owner-row">{scopeOwners.map(ownerId => {
                    const key = keyOf(ownerId, parameter.id);
                    return <button key={key} className={'gt-owner ' + (chartKeys.includes(key) ? 'on' : '')} onClick={() => toggleKey(key)}>
                      {chartKeys.includes(key) && <Check size={10} />}{ownerId.startsWith('SAT-') ? ownerId : 'link'}
                    </button>;
                  })}</div>
                </div>;
              })}
        </div>
      </aside>

      {/* central workspace */}
      <section className="gt-charts">
        {charts.map((chart, index) => {
          const rows = rowsFor(chart.keys);
          const units = unitsOf(chart.keys);
          const mixed = units.length > 1;
          const Chart = graphType === 'area' ? AreaChart : LineChart;
          return <article key={chart.id} className={'gt-chart ' + (activeChart === chart.id ? 'active' : '')} onClick={() => setActiveChart(chart.id)}>
            <header>
              <div>
                <span className="eyebrow">GRAPH {index + 1}{activeChart === chart.id ? ' · SELECTING' : ''}</span>
                <h3>{chart.keys.length ? chart.keys.map(k => `${k.split('|')[0]} ${shortParam(k.split('|')[1])}`).join(' · ') : 'No parameter selected'}</h3>
                {mixed && <small className="gt-warn"><AlertTriangle size={11} />Mixed units ({units.join(', ')}); series are not directly comparable.</small>}
              </div>
              {charts.length > 1 && <button className="gt-remove" aria-label="Remove graph"
                onClick={e => { e.stopPropagation(); setCharts(charts.filter(c => c.id !== chart.id)); }}><Trash2 size={13} /></button>}
            </header>

            {chart.keys.length === 0
              ? <p className="gt-empty">Pick a spacecraft and a parameter on the left to plot it here.</p>
              : rows.length === 0
                ? <p className="gt-empty">No samples recorded in this window yet.</p>
                : <div className="gt-canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <Chart data={rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                        onMouseMove={state => { if (state?.activeLabel !== undefined) setCursor(Number(state.activeLabel)); }}
                        onMouseLeave={() => setCursor(null)}>
                        <CartesianGrid stroke="#202832" vertical={false} strokeDasharray="3 5" />
                        <XAxis dataKey="t" type="number" domain={domain} stroke="#687483" tick={{ fontSize: 9 }}
                          tickFormatter={v => fmtTime(v)} tickLine={false} axisLine={false} minTickGap={50} />
                        <YAxis stroke="#687483" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={52}
                          label={{ value: units[0] || '', angle: -90, position: 'insideLeft', fill: '#687483', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#101923', border: '1px solid #2c3a48', borderRadius: 8, fontSize: 11 }}
                          labelFormatter={v => `T+ ${fmtTime(v)}`}
                          formatter={(value, name) => [value === null ? 'no measurement' : fixed(value, 3), name.split('|').join(' ')]} />
                        {showEvents && visibleEvents.map(e => <ReferenceLine key={e.id} x={e.time} stroke={SEVERITY_COLOR[e.severity] || '#7f909e'}
                          strokeDasharray="2 3" strokeOpacity={.75} />)}
                        {cursor !== null && <ReferenceLine x={cursor} stroke="#cfe3ef" strokeOpacity={.55} />}
                        {chart.keys.map((key, i) => graphType === 'area'
                          ? <Area key={key} dataKey={key} type="monotone" stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                              fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={.12} strokeWidth={1.6} isAnimationActive={false} connectNulls={false} />
                          : <Line key={key} dataKey={key} type="monotone" stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                              strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls={false} />)}
                      </Chart>
                    </ResponsiveContainer>
                  </div>}

            <div className="gt-legend">
              {chart.keys.map((key, i) => {
                const entry = series[key];
                return <span key={key}>
                  <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  {key.split('|')[0]} {shortParam(key.split('|')[1])}
                  {entry && !entry.available && <em> · {entry.reason === 'NOT_MODELLED' ? 'not modelled' : 'no samples'}</em>}
                </span>;
              })}
            </div>
          </article>;
        })}
      </section>
    </div>

    {/* lower panel: statistics and events */}
    <div className="gt-lower">
      <div className="gt-stats">
        <span className="eyebrow">PARAMETER STATISTICS{cursor !== null && <em> · cursor T+ {fmtTime(cursor)}</em>}</span>
        {chartKeys.length === 0
          ? <p className="gt-note">Select a parameter to see its statistics.</p>
          : <table>
              <thead><tr><th>Series</th><th>Unit</th><th>Class</th><th>Min</th><th>Max</th><th>Average</th><th>Current</th><th>At cursor</th></tr></thead>
              <tbody>{chartKeys.map(key => {
                const entry = series[key];
                if (!entry?.available) return <tr key={key} className="gt-unavailable"><td>{key.split('|').join(' ')}</td><td colSpan={7}>
                  {entry?.reason === 'NOT_MODELLED' ? 'Not implemented by this model' : 'No samples recorded'}</td></tr>;
                const at = cursor === null ? null : entry.points.reduce((best, point) =>
                  best === null || Math.abs(point[0] - cursor) < Math.abs(best[0] - cursor) ? point : best, null);
                return <tr key={key}>
                  <td>{entry.ownerId} {shortParam(entry.parameterId)}</td>
                  <td>{entry.unit}</td>
                  <td><Badge classification={entry.classification} /></td>
                  <td>{fixed(entry.stats.min, 3)}</td>
                  <td>{fixed(entry.stats.max, 3)}</td>
                  <td>{fixed(entry.stats.avg, 3)}</td>
                  <td>{fixed(entry.stats.current, 3)}</td>
                  <td>{at ? (at[1] === null ? 'no measurement' : fixed(at[1], 3)) : '—'}</td>
                </tr>;
              })}</tbody>
            </table>}
      </div>
      <div className="gt-events">
        <span className="eyebrow">EVENTS IN WINDOW</span>
        {visibleEvents.length === 0
          ? <p className="gt-note">No fault, decision or cooperation events in this window.</p>
          : <ul>{visibleEvents.slice(-40).reverse().map(e => <li key={e.id}>
              <i style={{ background: SEVERITY_COLOR[e.severity] || '#7f909e' }} />
              <span className="mono">T+ {fmtTime(e.time)}</span>
              <strong>{e.type.replaceAll('_', ' ').toLowerCase()}</strong>
              <small>{e.spacecraftId || 'kernel'}</small>
            </li>)}</ul>}
      </div>
    </div>
  </div>;
}
