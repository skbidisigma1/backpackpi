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

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}

// Store subscription example
store.subscribe('theme', val => console.log('Theme changed', val));
