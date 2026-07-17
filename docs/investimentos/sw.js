const CACHE_NAME = 'wingene-investimentos-v1.0.8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=1.0.8',
  './app.js?v=1.0.8',
  './drive-sync.js?v=1.0.8',
  './manifest.json',
  './icon.svg'
];

// Instalação do Service Worker e forçar ativação imediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo do PWA:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de Fetch: Network-First para a própria aplicação (garante atualização automática online)
// e fallback para Cache quando estiver offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercetar APIs externas do Google ou Cotações
  if (url.origin.includes('google') || url.origin.includes('googleapis') || url.origin.includes('brapi')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se estiver offline, entrega a versão em cache
        return caches.match(event.request);
      })
  );
});
