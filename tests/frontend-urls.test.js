import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, normalizeApiBase, streamUrl } from '../src/api-config.js';

test('same-origin local REST, exports, and WebSocket paths remain compatible', () => {
  assert.equal(apiUrl('/api/v1/scenarios', '', 'http://127.0.0.1:5173'), '/api/v1/scenarios');
  assert.equal(apiUrl('/api/v1/exports/run-1', '', 'http://127.0.0.1:4000'), '/api/v1/exports/run-1');
  assert.equal(streamUrl('run-1', '', 'http://127.0.0.1:5173'), 'ws://127.0.0.1:5173/api/v1/runs/run-1/stream');
  assert.equal(streamUrl('run-1', '', 'https://veil.example'), 'wss://veil.example/api/v1/runs/run-1/stream');
});

test('hosted backend origin and optional path prefix consistently route REST and WSS', () => {
  const backend='https://veil-api.onrender.com/service///';
  assert.equal(normalizeApiBase(backend, 'https://veil.vercel.app'), 'https://veil-api.onrender.com/service');
  assert.equal(apiUrl('/api/v1/exports/r-1', backend, 'https://veil.vercel.app'), 'https://veil-api.onrender.com/service/api/v1/exports/r-1');
  assert.equal(streamUrl('run 1', backend, 'https://veil.vercel.app'), 'wss://veil-api.onrender.com/service/api/v1/runs/run%201/stream');
});

test('invalid, credential-bearing, or insecure production endpoint is rejected before network use', () => {
  for (const value of ['relative/backend', 'ws://example.com', 'https://name:password@example.com', 'https://example.com/?token=secret', 'https://example.com/#frag']) {
    assert.throws(() => normalizeApiBase(value, 'https://veil.vercel.app'), /VITE_API_BASE_URL/);
  }
  assert.throws(() => normalizeApiBase('http://api.example', 'https://veil.vercel.app'), /HTTPS frontend requires/);
  assert.throws(() => apiUrl('/not-an-api', '', 'http://localhost:5173'), /Invalid simulation API path/);
  assert.throws(() => streamUrl('id', '', undefined), /browser origin is unavailable/);
});
