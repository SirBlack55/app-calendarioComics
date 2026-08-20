// Service Worker - Comic Release Tracker
// Sube este número cada vez que cambies index.html/manifest para forzar la actualización de caché.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `comic-tracker-${CACHE_VERSION}`;

// Archivos del "app shell" que se guardan para que la app funcione offline.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Instalación: precachear el app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés antiguas de versiones previas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('comic-tracker-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Estrategia de fetch:
// - Para navegación (HTML): network-first, con fallback a caché si no hay conexión.
// - Para el resto (CDN de Tailwind/Lucide, iconos, etc.): cache-first, y si no está, se pide
//   a la red y se guarda para la próxima vez.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo gestionamos peticiones GET
  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // No cacheamos respuestas erróneas o de tipo opaco problemáticas
          if (!response || response.status !== 200) return response;

          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Sin red y sin caché: no hay mucho que hacer para recursos externos
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});
