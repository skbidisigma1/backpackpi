const CACHE_NAME = 'bp-shell-v3';
// Paths relative to scope (assumes scope at /frontend/)
const ASSETS = [
  './index.html',
  './assets/styles.css',
  './assets/fonts/Miracode.woff2',
  './js/app.js',
  './js/store.js'
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async c => {
      await c.addAll(ASSETS);
    })
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    // Normalize to relative path under scope
    const relative = url.pathname.startsWith('/frontend/') ? '.' + url.pathname.substring('/frontend'.length) : null;
    if (relative && ASSETS.includes(relative)) {
      e.respondWith(
        caches.match(relative).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(relative, resp.clone()));
            return resp;
          });
        })
      );
      return;
    }
  }
  // passthrough
});
