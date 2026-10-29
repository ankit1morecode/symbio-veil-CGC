import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';

test('Local HTTP, WebSocket, command validation, export and durable journal integration', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'veil-api-'));
    process.env.PORT = '0'; process.env.DATA_DIRECTORY = dir; process.env.MONGODB_URI = '';
    const { startServer } = await import('../server/index.js'); const service = await startServer(), port = service.server.address().port, base = `http://127.0.0.1:${port}`;
    t.after(async () => { await service.close(); await fs.rm(dir, { recursive: true, force: true }); });
    async function request(route, body) { const response = await fetch(`${base}/api/v1${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
    const health = await request('/health'); assert.equal(health.status, 200); assert.ok(health.data.storage.includes('Local JSON'));
    const scenarios = await request('/scenarios'); assert.equal(scenarios.data.length, 8);
    const created = await request('/runs', { scenarioId: 'E2', seed: 20261029 }); assert.equal(created.status, 201); let state = created.data; assert.equal(state.spacecraft.length, 2);
    const current = await request('/runs/current'); assert.equal(current.data.runId, state.runId);
    const unsupported = await request(`/runs/${state.runId}/faults`, { commandId: 'bad-fault', expectedRevision: state.revision, spacecraftId: 'SAT-A', componentId: 'SAT-A-alpha', modelId: 'F-03' }); assert.equal(unsupported.status, 400); assert.equal(unsupported.data.error.code, 'UNSUPPORTED_FAULT');
    const stepped = await request(`/runs/${state.runId}/control`, { commandId: 'step-1400', expectedRevision: state.revision, action: 'step', seconds: 1400 }); assert.equal(stepped.status, 200); state = stepped.data; assert.equal(state.connections[0].mechanicalState, 'RELEASED'); assert.equal(state.metrics.missionSuccess, 1);
    const stale = await request(`/runs/${state.runId}/control`, { commandId: 'stale', expectedRevision: 0, action: 'play' }); assert.equal(stale.status, 409);
    const saved = await request(`/runs/${state.runId}/checkpoints`, { commandId: 'save', expectedRevision: state.revision, name: 'Integration checkpoint' }); assert.equal(saved.status, 201); assert.ok(saved.data.checkpoint.checksum); state = saved.data;
    const events = await request(`/runs/${state.runId}/events?limit=2&spacecraftId=SAT-A`); assert.equal(events.data.events.length, 2); assert.ok(events.data.total > 2);
    const bundle = await request(`/exports/${state.runId}`); assert.equal(bundle.data.kind, 'VEIL_REPLAY_BUNDLE'); assert.ok(bundle.data.ledger.some(x => x.type === 'power_transfer'));
    const journal = JSON.parse(await fs.readFile(path.join(dir, `${state.runId}.json`), 'utf8')); assert.equal(journal.state.time, 1400); assert.ok(journal.checksum);
    const replay = await request('/imports', bundle.data); assert.equal(replay.status, 201); assert.equal(replay.data.time, 1400);
    const matched = await request('/experiments', { scenarioId: 'E1', seed: 42, durationS: 200 }); assert.equal(matched.status, 200); assert.equal(matched.data.results.length, 4);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runs/${state.runId}/stream`);
    const first = await new Promise((resolve, reject) => { socket.once('message', raw => resolve(JSON.parse(raw))); socket.once('error', reject); }); assert.equal(first.type, 'snapshot'); assert.equal(first.state.runId, state.runId);
    const waiting = new Promise(resolve => socket.once('message', raw => resolve(JSON.parse(raw))));
    const controlled = await request(`/runs/${state.runId}/control`, { commandId: 'ws-command', expectedRevision: state.revision, action: 'time_scale', value: 100 }); assert.equal(controlled.status, 200); const pushed = await waiting; assert.equal(pushed.state.timeScale, 100); socket.close();
    await new Promise(resolve => socket.once('close', resolve));
});
