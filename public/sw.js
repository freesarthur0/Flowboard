const CACHE_NAME = 'flowboard-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
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

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const path = url.pathname;
  return path === '/' || path.endsWith('/') || path.endsWith('/index.html');
}

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // HTML (navegação / index.html): Network First, com fallback ao cache.
  // Garante que mudanças de UI cheguem ao usuário no próximo load,
  // sem precisar bumpar CACHE_NAME a cada deploy.
  if (isHtmlRequest(event.request, requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Demais estáticos: Cache First, fallback para Network
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {});
    })
  );
});
