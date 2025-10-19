// Central API helper using same-origin relative /api paths
const API_PREFIX = (window.__BACKPACK_API_PREFIX || '/api').replace(/\/$/, '');

export async function apiFetch(path, options = {}) {
  const p = path.startsWith('/') ? path : '/' + path;
  const url = API_PREFIX + p;
  const res = await fetch(url, options);
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    
    // Handle auth errors
    if (res.status === 401) {
      console.warn('[api] 401 Unauthorized, redirecting to login');
      window.location.reload(); // Will trigger auth check and redirect to login
      throw new Error('Authentication required');
    }
    
    if (res.status === 403) {
      console.warn('[api] 403 Forbidden');
      throw new Error('Insufficient permissions');
    }
    
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res;
}

export async function apiJSON(path, options = {}) {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (res.status === 204) return null;
  return res.json();
}

export async function waitForHealth(timeoutMs = 4000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    try {
      await apiFetch('/health');
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  return false;
}

export { API_PREFIX };