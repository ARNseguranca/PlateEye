importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBf5V1yAmk_X6mN8nR7KjwGH6EO9XalQJ8",
  authDomain: "lpr-arn.firebaseapp.com",
  projectId: "lpr-arn",
  storageBucket: "lpr-arn.firebasestorage.app",
  messagingSenderId: "496945379067",
  appId: "1:496945379067:web:754badd4d6e431e308625e"
});

const messaging = firebase.messaging();

function buildNotificationFromPayload(payload) {
  const data = payload?.data || {};
  const notification = payload?.notification || {};

  const title =
    data.title ||
    notification.title ||
    'PlateEye';

  const body =
    data.body ||
    notification.body ||
    'Novo alerta operacional detectado';

  const alertId =
    data.alert_id ||
    data.alertId ||
    payload?.messageId ||
    String(Date.now());

  const plate =
    data.plate ||
    'sem-placa';

  const camera =
    data.camera_name ||
    data.camera ||
    '';

  const url =
    data.url ||
    '/alerts.html';

  return {
    title,
    options: {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      image: notification.image || data.image || '',
      requireInteraction: true,
      renotify: false,
      silent: false,
      vibrate: [300, 120, 300, 120, 300],
      tag: `alert-${alertId}-${plate}-${Date.now()}`,
      data: {
        ...data,
        alert_id: alertId,
        plate,
        camera,
        url
      },
      actions: [
        {
          action: 'open',
          title: 'Abrir'
        },
        {
          action: 'close',
          title: 'Fechar'
        }
      ]
    }
  };
}

messaging.onBackgroundMessage(async (payload) => {
  try {
    console.log('[SW] Mensagem background recebida:', payload);

    const { title, options } = buildNotificationFromPayload(payload);

    await self.registration.showNotification(title, options);

    console.log('[SW] Notificação exibida com sucesso:', {
      title,
      tag: options.tag,
      alert_id: options.data?.alert_id
    });
  } catch (error) {
    console.error('[SW] Erro ao exibir notificação:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const action = event.action;
  const targetUrl = event.notification?.data?.url || '/alerts.html';

  if (action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes('/alerts.html') || client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notificação fechada:', event.notification?.data || {});
});