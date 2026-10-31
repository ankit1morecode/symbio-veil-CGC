import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { scenarios, faultModels } from './catalog.js';
import { makeRun, snapshot, control, injectFault, advance, checkpoint, exportRun, importRun, experiment, SimulationError, validateMutation, completeMutation } from './engine.js';
import { connectStorage, storageLabel, saveRun, loadRuns, closeStorage } from './storage.js';
try { process.loadEnvFile?.(); } catch { }

// Browser origins are exact values, not wildcard patterns. This is a browser
// access policy only: requests without an Origin are still allowed, so it is
// not authentication or a substitute for per-user authorization.
function configuredOrigins() {
    return (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean).map(value => {
        let url;
        try { url = new URL(value); } catch { throw new Error('ALLOWED_ORIGINS must contain valid HTTP(S) origins.'); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
            throw new Error('ALLOWED_ORIGINS entries must be origins only, without credentials, paths, queries, or fragments.');
        }
        return url.origin;
    });
}
function allowedOrigin(origin) {
    if (!origin) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    return configuredOrigins().includes(origin);
}
export const app = express();
app.use(cors({
    origin(origin, cb) {
        if (allowedOrigin(origin)) return cb(null, true);
        const error = new Error('This browser origin is not allowed. Add its exact origin to ALLOWED_ORIGINS.');
        error.code = 'ORIGIN_DENIED'; error.status = 403;
        cb(error);
    }
}));
app.use(express.json({ limit: '25mb' }));
const runs = new Map(), sockets = new Map(), saving = new Map(); let defaultRunId;
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const findRun = id => { const run = runs.get(id === 'current' ? defaultRunId : id); if (!run) throw new SimulationError('RUN_NOT_FOUND', 'Run not found. Load a scenario to begin.', 404); return run; };
function broadcast(run) { const body = JSON.stringify({ type: 'snapshot', sequence: run.sequence, revision: run.revision, state: snapshot(run) }); for (const ws of sockets.get(run.runId) || []) { if (ws.readyState === 1) ws.send(body); } }
async function persist(run) { const previous = saving.get(run.runId) || Promise.resolve(), task = previous.catch(() => { }).then(() => saveRun(run)); saving.set(run.runId, task); try { await task; } finally { if (saving.get(run.runId) === task) saving.delete(run.runId); } }
const mutate = fn => asyncRoute(async (req, res) => { const run = findRun(req.params.id); const result = fn(run, req.body, req.params); broadcast(run); await persist(run); res.json(result); });
app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'VEIL simulation service', storage: storageLabel(), version: '1.0.0' }));
app.get('/api/v1/health', (_, res) => res.json({ status: 'ok', storage: storageLabel() }));
app.get('/api/v1/scenarios', (_, res) => res.json(scenarios));
app.get('/api/v1/fault-models', (_, res) => res.json(faultModels));
app.get('/api/v1/runs', (_, res) => res.json([...runs.values()].map(r => ({ runId: r.runId, scenarioId: r.scenarioId, time: r.time, playing: r.playing }))));
app.post('/api/v1/runs', asyncRoute(async (req, res) => { if (req.body.resume && defaultRunId) { res.json(snapshot(findRun(defaultRunId))); return; } const run = makeRun(req.body); run.storage = storageLabel(); runs.set(run.runId, run); defaultRunId = run.runId; await persist(run); res.status(201).json(snapshot(run)); }));
app.get('/api/v1/runs/current', (_, res) => res.json(snapshot(findRun('current'))));
app.get('/api/v1/runs/:id/state', (req, res) => res.json(snapshot(findRun(req.params.id))));
app.get('/api/v1/runs/:id/spacecraft/:satId', (req, res, next) => { const sat = findRun(req.params.id).spacecraft.find(x => x.id === req.params.satId); if (!sat) return next(new SimulationError('UNKNOWN_SPACECRAFT', 'Select a declared spacecraft.', 404)); res.json(sat); });
app.post('/api/v1/runs/:id/control', mutate(control)); app.post('/api/v1/runs/:id/faults', mutate(injectFault));
app.get('/api/v1/runs/:id/decisions', (req, res) => res.json(findRun(req.params.id).decisions));
app.get('/api/v1/runs/:id/contracts', (req, res) => res.json(findRun(req.params.id).contracts));
app.get('/api/v1/runs/:id/connections', (req, res) => res.json(findRun(req.params.id).connections));
app.get('/api/v1/runs/:id/events', (req, res) => { const run = findRun(req.params.id); let rows = run.events; if (req.query.spacecraftId) rows = rows.filter(x => x.spacecraftId === req.query.spacecraftId); if (req.query.type) rows = rows.filter(x => x.type.includes(req.query.type)); if (req.query.severity) rows = rows.filter(x => x.severity === req.query.severity); const offset = Math.max(0, Number(req.query.offset) || 0), limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100)); res.json({ events: rows.slice(offset, offset + limit), total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null }); });
app.post('/api/v1/runs/:id/checkpoints', asyncRoute(async (req, res) => { const run = findRun(req.params.id); const check = validateMutation(run, req.body); if (check.duplicate) { res.json(snapshot(run)); return; } const point = checkpoint(run, req.body.name); completeMutation(run, check.key, { checkpointId: point.id }); await persist(run); broadcast(run); res.status(201).json({ ...snapshot(run), checkpoint: point }); }));
app.post('/api/v1/runs/:id/checkpoints/:checkpointId/restore', mutate((run, body, params) => control(run, { ...body, action: 'load_checkpoint', value: params.checkpointId })));
app.get('/api/v1/exports/:runId', (req, res) => { const run = findRun(req.params.runId); res.setHeader('Content-Disposition', `attachment; filename="VEIL-${run.scenarioId}-${Math.floor(run.time)}s.json"`); res.json(exportRun(run)); });
app.post('/api/v1/imports', asyncRoute(async (req, res) => { const run = importRun(req.body); run.storage = storageLabel(); runs.set(run.runId, run); defaultRunId = run.runId; await persist(run); res.status(201).json(snapshot(run)); }));
app.post('/api/v1/experiments', asyncRoute(async (req, res) => res.json(experiment(req.body))));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'); app.use(express.static(root)); app.get('/{*splat}', (req, res, next) => { if (req.path.startsWith('/api/')) return next(new SimulationError('NOT_FOUND', 'API route not found.', 404)); res.sendFile(path.join(root, 'index.html'), err => { if (err) next(new SimulationError('FRONTEND_NOT_BUILT', 'Frontend not built. Run npm run build, or npm run dev for Vite.', 404)); }); });
app.use((error, req, res, next) => { const known = error instanceof SimulationError; res.status(error.status || 400).json({ error: { code: error.code || (error instanceof SyntaxError ? 'INVALID_JSON' : 'INVALID_PARAMETER'), message: known ? error.message : error.message || 'Request validation failed.' } }); });
export async function startServer() {
    // Refuse a malformed deployment configuration during startup, not on the
    // first request from an otherwise valid origin.
    configuredOrigins();
    await connectStorage(); for (const run of await loadRuns()) { run.storage = storageLabel(); runs.set(run.runId, run); defaultRunId = run.runId; } if (!defaultRunId) { const run = makeRun(); run.storage = storageLabel(); runs.set(run.runId, run); defaultRunId = run.runId; }
    const server = http.createServer(app), wss = new WebSocketServer({ noServer: true }); server.on('upgrade', (req, socket, head) => { const match = req.url.match(/^\/api\/v1\/runs\/([^/]+)\/stream/); if (!match) { socket.destroy(); return; } if (!allowedOrigin(req.headers.origin)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; } let run; try { run = findRun(match[1]); } catch { socket.destroy(); return; } wss.handleUpgrade(req, socket, head, ws => { if (!sockets.has(run.runId)) sockets.set(run.runId, new Set()); sockets.get(run.runId).add(ws); ws.send(JSON.stringify({ type: 'snapshot', sequence: run.sequence, revision: run.revision, state: snapshot(run) })); ws.on('close', () => sockets.get(run.runId)?.delete(ws)); }); });
    let last = performance.now(); const accumulator = new Map(); const ticker = setInterval(() => { const now = performance.now(), delta = Math.min(1, (now - last) / 1000); last = now; for (const run of runs.values()) { if (!run.playing) continue; const budget = (accumulator.get(run.runId) || 0) + delta * run.timeScale, seconds = Math.floor(budget); accumulator.set(run.runId, budget - seconds); if (seconds) { advance(run, seconds); broadcast(run); } } }, 200);
    const saver = setInterval(() => { for (const run of runs.values()) persist(run).catch(err => console.error('Persistence failed:', err.message)); }, 10000);
    const port = Number(process.env.PORT || 4000); await new Promise(resolve => server.listen(port, '0.0.0.0', resolve)); console.log(`VEIL simulation service http://0.0.0.0:${port}`);
    const close = async () => {
        clearInterval(ticker);
        clearInterval(saver);
        for (const run of runs.values()) await persist(run);
        await closeStorage(); wss.close(); server.close();
    };
    process.once('SIGTERM', () => close().finally(() => process.exit(0))); process.once('SIGINT', () => close().finally(() => process.exit(0)));
    return { server, close, runs };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) startServer().catch(error => { console.error(error); process.exitCode = 1; });
