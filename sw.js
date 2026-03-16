const CACHE_NAME = 'plateeye-v2.0.0';

const STATIC_ASSETS = [
  './',
  './login.html',
  './index.html',
  './alerts.html',
  './cameras.html',
  './monitoring.html',
  './reports.html',
  './users.html',
  './config.html',
  './premium.css',
  './firebase-config.js',
  './firestore-sync.js',
  './firebaseRegistro.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin) return;

  const isNavigationRequest =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigationRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return networkResponse;
        });
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      notification: {
        title: 'PlateEye',
        body: 'Novo alerta recebido'
      },
      data: {
        url: './alerts.html'
      }
    };
  }

  const title = payload.notification?.title || 'PlateEye';
  const body = payload.notification?.body || 'Novo alerta recebido';
  const icon = payload.notification?.icon || './icon-192.png';
  const image = payload.notification?.image || '';
  const badge = payload.notification?.badge || './icon-192.png';
  const url = payload.data?.url || './alerts.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      image,
      badge,
      vibrate: [200, 100, 200, 100, 300],
      tag: 'plateeye-alert',
      renotify: true,
      requireInteraction: true,
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './alerts.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);

        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});