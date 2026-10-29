// Browser-visible API endpoint only. Never place secrets in VITE_ variables.
const configuredBase = import.meta.env?.VITE_API_BASE_URL || '';

export function normalizeApiBase(value = configuredBase, pageOrigin = globalThis.location?.origin) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let endpoint;
  try { endpoint = new URL(raw); }
  catch { throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) URL for the simulation server.'); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('VITE_API_BASE_URL must use HTTP(S) and must not contain credentials, a query, or a fragment.');
  }
  if (pageOrigin && new URL(pageOrigin).protocol === 'https:' && endpoint.protocol !== 'https:') {
    throw new Error('An HTTPS frontend requires an HTTPS simulation server URL.');
  }
  return endpoint.origin + endpoint.pathname.replace(/\/+$/, '');
}

export function apiUrl(path, base = configuredBase, pageOrigin = globalThis.location?.origin) {
  if (typeof path !== 'string' || !path.startsWith('/api/v1/')) {
    throw new Error('Invalid simulation API path.');
  }
  return normalizeApiBase(base, pageOrigin) + path;
}

export function streamUrl(runId, base = configuredBase, pageOrigin = globalThis.location?.origin) {
  if (!pageOrigin && !base) throw new Error('The browser origin is unavailable for the simulation stream.');
  const httpUrl = apiUrl('/api/v1/runs/' + encodeURIComponent(runId) + '/stream', base, pageOrigin);
  const url = new URL(httpUrl, pageOrigin || undefined);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export const hasConfiguredBackend = Boolean(configuredBase.trim());
