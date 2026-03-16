(function () {
  // ============================================
  // VALIDAÇÃO E INICIALIZAÇÃO FIREBASE
  // ============================================

  function ensureFirebaseReady() {
    if (!window.firebase) {
      throw new Error('Firebase SDK não carregado.');
    }

    if (!firebase.apps || !firebase.apps.length) {
      throw new Error('Firebase não inicializado. Verifique o firebase-config.js');
    }

    if (!window.db) {
      window.db = firebase.firestore();
    }
  }

  function ensureAuth() {
    ensureFirebaseReady();
    return firebase.auth();
  }

  // ============================================
  // MESSAGING E PUSH NOTIFICATIONS
  // ============================================

  let messagingInstance = null;
  const VAPID_KEY = window.PLATEEYE_VAPID_KEY || 'BCF-hIsTD6zvzbq-zHlyXuwFIgI8v4qgVd-fmPBypv14w4UaXRGe08vNlN3e-7zgan3DPcxshaHCHnFq7P9TYjk';

  async function initMessaging() {
    try {
      ensureFirebaseReady();

      if (!firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
        console.warn('[Push] Messaging não suportado neste navegador.');
        return null;
      }

      if (!messagingInstance) {
        messagingInstance = firebase.messaging();
        console.log('[Firebase] ✓ Messaging inicializado');
      }

      return messagingInstance;
    } catch (error) {
      console.error('[Firebase] Erro ao inicializar Messaging:', error);
      return null;
    }
  }

  async function registerMessagingServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[FCM] Service Worker não suportado');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      console.log('[FCM] ✓ Service Worker do messaging registrado');
      return registration;
    } catch (error) {
      console.error('[FCM] Erro ao registrar service worker:', error);
      return null;
    }
  }

  async function requestPushPermissionAndToken() {
    try {
      const messaging = await initMessaging();
      if (!messaging) return null;

      // Valida VAPID Key
      if (!VAPID_KEY || VAPID_KEY === 'SUA_CHAVE_VAPID_AQUI') {
        console.error('[Push] ❌ VAPID_KEY não configurada. Defina em firebase-config.js');
        return null;
      }

      // Registra Service Worker
      const swRegistration = await registerMessagingServiceWorker();
      if (!swRegistration) return null;

      // Solicita permissão
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        console.warn('[Push] Permissão de notificação não concedida pelo usuário.');
        return null;
      }

      // Obtém token
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration
      });

      if (!token) {
        console.warn('[Push] Token não retornado pelo Firebase');
        return null;
      }

      // Salva token no Firestore
      const user = firebase.auth().currentUser;
      if (user) {
        const deviceId = localStorage.getItem('plateeye_device_id') || crypto.randomUUID();
        localStorage.setItem('plateeye_device_id', deviceId);

        // Salva em subcoleção devices (modelo recomendado)
        await window.db.collection('users').doc(user.uid).collection('devices').doc(deviceId).set({
          token,
          user_uid: user.uid,
          email: user.email || '',
          device_id: deviceId,
          platform: 'web',
          userAgent: navigator.userAgent,
          language: navigator.language || 'pt-BR',
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
          updated_at: firebase.firestore.FieldValue.serverTimestamp(),
          active: true
        }, { merge: true });

        // Também salva no array fcm_tokens do documento principal (compatibilidade)
        await window.db.collection('users').doc(user.uid).set({
          fcm_tokens: firebase.firestore.FieldValue.arrayUnion(token),
          last_active: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        localStorage.setItem('plateeye_fcm_token', token);
        console.log('[Push] ✓ Token registrado e sincronizado');
      }

      return token;
    } catch (error) {
      console.error('[Push] Erro ao obter token:', error);
      return null;
    }
  }

  function startForegroundNotifications() {
    initMessaging().then((messaging) => {
      if (!messaging) return;

      messaging.onMessage((payload) => {
        console.log('[Push] Mensagem recebida em foreground:', payload);

        const title = payload.notification?.title || 'PlateEye';
        const body = payload.notification?.body || 'Novo alerta recebido';
        const icon = payload.notification?.icon || './icon-192.png';
        const image = payload.notification?.image || '';

        // Exibe notificação nativa
        try {
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon,
              image,
              vibrate: [200, 100, 200],
              tag: 'plateeye-foreground',
              requireInteraction: false
            });
          }
        } catch (error) {
          console.warn('[Push] Falha ao exibir notificação:', error);
        }

        // Toca som de alerta
        try {
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(() => {});
        } catch (error) {
          console.warn('[Push] Falha ao tocar som:', error);
        }

        // Callback customizado se existir
        if (window.notifyLocal && body) {
          window.notifyLocal(body);
        }
      });
    });
  }

  // ============================================
  // AUTENTICAÇÃO
  // ============================================

  async function login(email, password) {
    ensureFirebaseReady();

    const credential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const user = credential.user;

    if (user) {
      try {
        // Valida se usuário existe no Firestore
        const userDoc = await window.db.collection('users').doc(user.uid).get();

        if (!userDoc.exists) {
          await firebase.auth().signOut();
          throw new Error('Perfil do usuário não encontrado no Firestore.');
        }

        const userData = userDoc.data() || {};

        // Valida se usuário está ativo
        if (userData.is_active === false) {
          await firebase.auth().signOut();
          throw new Error('Usuário desativado.');
        }

        // Atualiza last_access_at
        await window.db.collection('users').doc(user.uid).set({
          last_access_at: firebase.firestore.FieldValue.serverTimestamp(),
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('[Auth] ✓ Login bem-sucedido:', user.email);
      } catch (syncError) {
        console.error('[Auth] Erro ao sincronizar usuário:', syncError);
        throw syncError;
      }
    }

    return credential;
  }

  async function logout() {
    try {
      ensureFirebaseReady();

      const user = firebase.auth().currentUser;
      if (user) {
        // Marca dispositivo como inativo
        const deviceId = localStorage.getItem('plateeye_device_id');
        if (deviceId) {
          await window.db.collection('users').doc(user.uid).collection('devices').doc(deviceId).set({
            active: false,
            last_active: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }

      localStorage.removeItem('plateeye_fcm_token');
      localStorage.removeItem('plateeye_device_id');
      await firebase.auth().signOut();

      console.log('[Auth] ✓ Logout bem-sucedido');
      window.location.href = './login.html';
    } catch (error) {
      console.error('[Logout] Erro:', error);
      alert('Erro ao deslogar. Tente novamente.');
    }
  }

  // ============================================
  // EXPOSIÇÃO GLOBAL
  // ============================================

  window.ensureAuth = ensureAuth;

  window.plateEyeAuth = {
    login,
    logout,
    requestPushPermissionAndToken,
    startForegroundNotifications
  };

  window.requestPushPermissionAndToken = requestPushPermissionAndToken;
  window.startForegroundNotifications = startForegroundNotifications;
  window.logout = logout;

  // Inicializa Messaging ao carregar
  try {
    initMessaging();
    startForegroundNotifications();
  } catch (e) {
    console.error('[Init] Falha ao iniciar recursos Firebase:', e);
  }

  console.log('[Auth] ✓ Módulo de autenticação carregado');
})();