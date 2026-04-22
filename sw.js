const CACHE_NAME = 'flowboard-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/mobile.css',
  './css/reminders.css',
  './css/timeline.css',
  './js/api.js',
  './js/boards.js',
  './js/config.js',
  './js/custom-dialogs.js',
  './js/init.js',
  './js/modal.js',
  './js/realtime.js',
  './js/reminders.js',
  './js/render-desktop.js',
  './js/render-mobile.js',
  './js/search.js',
  './js/state.js',
  './js/timeline.js',
  './js/ui.js',
  './js/utils.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Supabase API: Network First, com fallback silencioso para falhas offline
  if (requestUrl.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(err => {
        // Retorna erro para o api.js fazer fallback para os dados locais (localStorage)
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Estáticos: Cache First, fallback para Network
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // Opcional: retornar fallback genérico se falhar
      });
    })
  );
});
