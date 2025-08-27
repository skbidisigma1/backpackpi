import { store } from './store.js';
import './components/toast.js';

const mainEl = document.getElementById('main');
const themeToggle = document.querySelector('[data-theme-toggle]');
const navToggle = document.querySelector('[data-nav-toggle]');
const navItems = document.querySelector('.nav-items');

// Theme init
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme(){
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.classList.add('theme-transition');
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  setTimeout(()=> root.classList.remove('theme-transition'), 400);
  store.set('theme', next);
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (navToggle) navToggle.addEventListener('click', () => navItems.classList.toggle('is-open'));

async function loadView(view){
  mainEl.innerHTML = '<div class="placeholder">Loading...</div>';
  try {
    const mapping = {
      dashboard: () => import('./modules/dashboard.js'),
      files: () => import('./modules/files.js'),
      games: () => import('./modules/games.js'),
      proxy: () => import('./modules/proxy.js'),
      settings: () => import('./modules/settings.js')
    };
    const loader = mapping[view] || mapping['dashboard'];
    const mod = await loader();
    await mod.render(mainEl);
  } catch (e) {
    console.error(e);
    mainEl.innerHTML = '<div class="card"><h2>Error</h2><p>'+ (e?.message || 'Failed to load.') +'</p></div>';
  }
  mainEl.focus();
  document.querySelectorAll('[data-view]').forEach(btn => {
    if (btn.getAttribute('data-view') === view) btn.classList.add('is-active'); else btn.classList.remove('is-active');
  });
}

navItems.addEventListener('click', e => {
  const target = e.target.closest('[data-view]');
  if (!target) return;
  const view = target.getAttribute('data-view');
  loadView(view);
  if (navItems.classList.contains('is-open')) navItems.classList.remove('is-open');
});

// Initial view
loadView('dashboard');

// Expose / detect API base (supports separate backend host/port)
// Resolution order:
// 1. Pre-set window.API_BASE (e.g. injected script tag)
// 2. If page served without an explicit port (80/443) assume backend at :3000 on same host
// 3. Fallback: same-origin ''
(function(){
  if (typeof window === 'undefined') return;
  if (!window.API_BASE) {
    const loc = window.location;
    const port = loc.port;
    if (!port || port === '80' || port === '443') {
      // Assume backend on 3000 unless overridden
      window.API_BASE = `${loc.protocol}//${loc.hostname}:3000`;
    } else {
      window.API_BASE = '';
    }
  }
  console.log('[app] API_BASE (initial) =', window.API_BASE || '(same-origin)');
  // Light async health probe to detect wrong assumption
  (async () => {
    try {
      const url = (window.API_BASE||'') + '/api/health';
      const ctrl = new AbortController();
      const t = setTimeout(()=> ctrl.abort(), 2500);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      const ct = res.headers.get('content-type')||'';
      if (!res.ok || !ct.includes('application/json')) throw new Error('Unexpected response');
      console.log('[app] Backend health OK');
    } catch (e){
      console.warn('[app] Backend health probe failed for', window.API_BASE, e.message);
      // If we assumed :3000 but failed, fall back to same-origin (maybe backend is reverse proxied)
      if (window.API_BASE && /:3000$/.test(window.API_BASE)) {
        window.API_BASE = '';
        console.warn('[app] Falling back to same-origin API_BASE = (same-origin)');
      }
    }
  })();
})();

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}

// Store subscription example
store.subscribe('theme', val => console.log('Theme changed', val));
