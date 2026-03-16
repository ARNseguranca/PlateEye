class FCMManager {
  async init() {
    if (!('serviceWorker' in navigator)) return;
    
    const permission = Notification.permission;
    if (permission === 'granted') {
      await this.getToken();
      this.listenMessages();
    } else if (permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        await this.getToken();
        this.listenMessages();
      }
    }
  }

  async getToken() {
    try {
      const token = await messaging.getToken({
        vapidKey: 'BCF-hIsTD6zvzbq-zHlyXuwFIgI8v4qgVd-fmPBypv14w4UaXRGe08vNlN3e-7zgan3DPcxshaHCHnFq7P9TYjk' // Substitua
      });

      if (token) {
        console.log('[FCM] Token:', token.substring(0, 30) + '...');
        localStorage.setItem('fcm_token', token);
      }
    } catch (error) {
      console.error('[FCM] Erro ao obter token:', error);
    }
  }

  listenMessages() {
    messaging.onMessage((payload) => {
      console.log('[FCM] Mensagem:', payload);
      const { title, body, image } = payload.notification || {};

      new Notification(title || 'Zecure LPR', {
        body: body || 'Nova notificação',
        icon: image || '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [200, 100, 200],
        tag: 'zecure-notification'
      });
    });
  }
}

const fcmManager = new FCMManager();