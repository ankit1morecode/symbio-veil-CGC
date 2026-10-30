import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WebSocket } from 'ws';

test('Local HTTP, WebSocket, command validation, export and durable journal integration', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'veil-api-'));
    process.env.PORT = '0'; process.env.DATA_DIRECTORY = dir; process.env.MONGODB_URI = ''; process.env.REQUIRE_MONGODB = 'false';
    process.env.ALLOWED_ORIGINS = 'https://veil.example, https://another.example';
    const { startServer } = await import('../server/index.js'); const service = await startServer(), port = service.server.address().port, base = `http://127.0.0.1:${port}`;
    t.after(async () => { await service.close(); await fs.rm(dir, { recursive: true, force: true }); });
    async function request(route, body) { const response = await fetch(`${base}/api/v1${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
    const health = await request('/health'); assert.equal(health.status, 200); assert.ok(health.data.storage.includes('Local JSON'));
    const allowed = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://veil.example' } });
    assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://veil.example');
    const local = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(local.status, 200); assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const preflight = await fetch(`${base}/api/v1/runs`, { method: 'OPTIONS', headers: { Origin: 'https://another.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://another.example');
    const denied = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://veil.example.attacker.invalid' } });
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error.code, 'ORIGIN_DENIED');
    const scenarios = await request('/scenarios'); assert.equal(scenarios.data.length, 8);
    const created = await request('/runs', { scenarioId: 'E2', seed: 20261029 }); assert.equal(created.status, 201); let state = created.data; assert.equal(state.spacecraft.length, 2);
    const current = await request('/runs/current'); assert.equal(current.data.runId, state.runId);
    const unsupported = await request(`/runs/${state.runId}/faults`, { commandId: 'bad-fault', expectedRevision: state.revision, spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-03' }); assert.equal(unsupported.status, 400); assert.equal(unsupported.data.error.code, 'UNSUPPORTED_FAULT');
    const stepped = await request(`/runs/${state.runId}/control`, { commandId: 'step-1400', expectedRevision: state.revision, action: 'step', seconds: 1400 }); assert.equal(stepped.status, 200); state = stepped.data; assert.equal(state.connections[0].mechanicalState, 'RELEASED'); assert.equal(state.metrics.missionSuccess, 1);
    const stale = await request(`/runs/${state.runId}/control`, { commandId: 'stale', expectedRevision: 0, action: 'play' }); assert.equal(stale.status, 409);
    const beforeCheckpoint = state.revision;
    const saved = await request(`/runs/${state.runId}/checkpoints`, { commandId: 'save', expectedRevision: state.revision, name: 'Integration checkpoint' }); assert.equal(saved.status, 201); assert.ok(saved.data.checkpoint.checksum); state = saved.data;
    const staleAfterCheckpoint = await request(`/runs/${state.runId}/control`, { commandId: 'stale-after-checkpoint', expectedRevision: beforeCheckpoint, action: 'play' }); assert.equal(staleAfterCheckpoint.status, 409);
    const events = await request(`/runs/${state.runId}/events?limit=2&spacecraftId=SAT-A`); assert.equal(events.data.events.length, 2); assert.ok(events.data.total > 2);
    const bundle = await request(`/exports/${state.runId}`); assert.equal(bundle.data.kind, 'VEIL_REPLAY_BUNDLE'); assert.ok(bundle.data.ledger.some(x => x.type === 'power_transfer'));
    const journal = JSON.parse(await fs.readFile(path.join(dir, `${state.runId}.json`), 'utf8')); assert.equal(journal.state.time, 1400); assert.ok(journal.checksum);
    const replay = await request('/imports', bundle.data); assert.equal(replay.status, 201); assert.equal(replay.data.time, 1400);
    const { advance } = await import('../server/engine.js'); const beforeTick = state.revision; advance(service.runs.get(state.runId), 1);
    const pause = { commandId: 'pause-after-tick', expectedRevision: beforeTick, action: 'pause' };
    const paused = await request(`/runs/${state.runId}/control`, pause); assert.equal(paused.status, 200); state = paused.data;
    const competing = await request(`/runs/${state.runId}/control`, { commandId: 'competing', expectedRevision: beforeTick, action: 'play' }); assert.equal(competing.status, 409);
    const duplicate = await request(`/runs/${state.runId}/control`, pause); assert.equal(duplicate.status, 200); assert.equal(duplicate.data.revision, state.revision);
    const matched = await request('/experiments', { scenarioId: 'E1', seed: 42, durationS: 200 }); assert.equal(matched.status, 200); assert.equal(matched.data.results.length, 4);
    const six = await request('/runs', { scenarioId: 'VEIL-REF-01', spacecraftCount: 6, faultMode: 'MANUAL' });
    assert.equal(six.status, 201); assert.equal(six.data.spacecraft.length, 6); assert.equal(six.data.communications.enabled, true);
    const sixStep = await request(`/runs/${six.data.runId}/control`, { commandId: 'network-step', expectedRevision: six.data.revision, action: 'step', seconds: 1 });
    assert.equal(sixStep.status, 200); assert.equal(sixStep.data.communications.totalExchanges, 3);
    assert.equal(new Set(sixStep.data.communications.links.flatMap(link => link.participants)).size, 6);
    assert.ok(sixStep.data.communications.links.every(link => link.status === 'PAUSED'));
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runs/${state.runId}/stream`);
    const first = await new Promise((resolve, reject) => { socket.once('message', raw => resolve(JSON.parse(raw))); socket.once('error', reject); }); assert.equal(first.type, 'snapshot'); assert.equal(first.state.runId, state.runId);
    const browserSocket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runs/${state.runId}/stream`, { origin: 'https://veil.example' });
    const browserFirst = await new Promise((resolve, reject) => { browserSocket.once('message', raw => resolve(JSON.parse(raw))); browserSocket.once('error', reject); });
    assert.equal(browserFirst.state.runId, state.runId); browserSocket.close(); await new Promise(resolve => browserSocket.once('close', resolve));
    const rejectedStatus = await new Promise((resolve, reject) => {
        const rejectedSocket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runs/${state.runId}/stream`, { origin: 'https://veil.example.attacker.invalid' });
        rejectedSocket.once('unexpected-response', (req, res) => { resolve(res.statusCode); res.resume(); req.destroy(); });
        rejectedSocket.once('open', () => { rejectedSocket.close(); reject(new Error('Unapproved WebSocket origin connected.')); });
        rejectedSocket.once('error', () => {});
    });
    assert.equal(rejectedStatus, 403);
    const waiting = new Promise(resolve => socket.once('message', raw => resolve(JSON.parse(raw))));
    const controlled = await request(`/runs/${state.runId}/control`, { commandId: 'ws-command', expectedRevision: state.revision, action: 'time_scale', value: 100 }); assert.equal(controlled.status, 200); const pushed = await waiting; assert.equal(pushed.state.timeScale, 100); socket.close();
    await new Promise(resolve => socket.once('close', resolve));
});

test('Required MongoDB fails closed without a usable URI and does not create local fallback storage', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'veil-required-mongo-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const localFallback = path.join(dir, 'must-not-exist');
    const execFileAsync = promisify(execFile);
    const run = uri => execFileAsync(process.execPath, ['--input-type=module', '-e', "import { connectStorage } from './server/storage.js'; await connectStorage();"], {
        cwd: process.cwd(), env: { ...process.env, REQUIRE_MONGODB: 'true', MONGODB_URI: uri, DATA_DIRECTORY: localFallback }, timeout: 10000,
    });
    await assert.rejects(run(''), error => { assert.match(error.stderr, /MongoDB is required but MONGODB_URI is not configured/); return true; });
    await assert.rejects(run('mongodb://user:example-sensitive-value@%/'), error => { assert.match(error.stderr, /MongoDB is required but the connection failed/); assert.doesNotMatch(error.stderr, /example-sensitive-value/); return true; });
    await assert.rejects(fs.access(localFallback), { code: 'ENOENT' });
});
