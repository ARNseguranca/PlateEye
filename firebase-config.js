const firebaseConfig = {
  apiKey: "AIzaSyBf5V1yAmk_X6mN8nR7KjwGH6EO9XalQJ8",
  authDomain: "lpr-arn.firebaseapp.com",
  databaseURL: "https://lpr-arn-default-rtdb.firebaseio.com",
  projectId: "lpr-arn",
  storageBucket: "lpr-arn.firebasestorage.app",
  messagingSenderId: "496945379067",
  appId: "1:496945379067:web:754badd4d6e431e308625e",
  measurementId: "G-58BYD2KNQ5"
};

const PLATEEYE_VAPID_KEY = "BCF-hIsTD6zvzbq-zHlyXuwFIgI8v4qgVd-fmPBypv14w4UaXRGe08vNlN3e-7zgan3DPcxshaHCHnFq7P9TYjk";

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('[Firebase] ✓ Inicializado');
  }
} catch (error) {
  console.error('[Firebase] Erro ao inicializar:', error);
}

window.auth = firebase.auth();
window.db = firebase.firestore();
window.messaging = firebase.messaging();

try {
  window.db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
  });
  console.log('[Firestore] ✓ Cache configurado');
} catch (error) {
  console.warn('[Firestore] Configuração já aplicada ou ignorada:', error);
}

window.db.enablePersistence()
  .then(() => {
    console.log('[Firestore] ✓ Persistência offline ativada');
  })
  .catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn('[Firestore] Múltiplas abas abertas; persistência offline indisponível');
    } else if (error.code === 'unimplemented') {
      console.warn('[Firestore] Navegador sem suporte a persistência offline');
    } else {
      console.warn('[Firestore] Falha ao ativar persistência:', error);
    }
  });

window.registerServiceWorker = async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker não suportado');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    console.log('[SW] ✓ Registrado');
    return registration;
  } catch (error) {
    console.error('[SW] Erro ao registrar:', error);
    return null;
  }
};

window.getCurrentUserSafe = function getCurrentUserSafe() {
  return firebase.auth().currentUser || null;
};

window.saveDeviceToken = async function saveDeviceToken(token) {
  try {
    const user = window.getCurrentUserSafe();
    if (!user || !token) return;

    const deviceId = localStorage.getItem('plateeye_device_id') || crypto.randomUUID();
    localStorage.setItem('plateeye_device_id', deviceId);

    await window.db.collection('users').doc(user.uid).set({
      email: user.email || '',
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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

    localStorage.setItem('plateeye_fcm_token', token);
    console.log('[FCM] ✓ Token salvo no Firestore');
  } catch (error) {
    console.error('[FCM] Erro ao salvar token:', error);
  }
};

window.requestPushPermissionAndToken = async function requestPushPermissionAndToken() {
  try {
    if (!window.messaging) {
      console.warn('[FCM] Messaging indisponível');
      return null;
    }

    window.registerMessagingServiceWorker = async function registerMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Worker não suportado');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    console.log('[FCM] ✓ Service Worker do messaging registrado');
    return registration;
  } catch (error) {
    console.error('[FCM] Erro ao registrar service worker do messaging:', error);
    return null;
  }
};

window.requestPushPermissionAndToken = async function requestPushPermissionAndToken() {
  try {
    if (!window.messaging) {
      console.warn('[FCM] Messaging indisponível');
      return null;
    }

    const swRegistration = await window.registerMessagingServiceWorker();
    if (!swRegistration) return null;

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] Permissão de notificação não concedida');
      return null;
    }

    const token = await window.messaging.getToken({
      vapidKey: PLATEEYE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (!token) {
      console.warn('[FCM] Token não retornado');
      return null;
    }

    console.log('[FCM] ✓ Token obtido');
    await window.saveDeviceToken(token);
    return token;
  } catch (error) {
    console.error('[FCM] Erro ao obter token:', error);
    return null;
  }
};

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] Permissão de notificação não concedida');
      return null;
    }

    const token = await window.messaging.getToken({
      vapidKey: PLATEEYE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (!token) {
      console.warn('[FCM] Token não retornado');
      return null;
    }

    console.log('[FCM] ✓ Token obtido');
    await window.saveDeviceToken(token);
    return token;
  } catch (error) {
    console.error('[FCM] Erro ao obter token:', error);
    return null;
  }
};

window.startForegroundNotifications = function startForegroundNotifications() {
  if (!window.messaging) return;

  window.messaging.onMessage((payload) => {
    console.log('[FCM] Mensagem foreground:', payload);

    const title = payload.notification?.title || 'PlateEye';
    const body = payload.notification?.body || 'Novo alerta recebido';
    const icon = payload.notification?.icon || './icon-192.png';
    const image = payload.notification?.image || '';

    try {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon,
          image,
          vibrate: [200, 100, 200],
          tag: 'plateeye-foreground'
        });
      }
    } catch (error) {
      console.warn('[FCM] Falha ao exibir notificação foreground:', error);
    }

    try {
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play().catch(() => {});
    } catch (error) {
      console.warn('[FCM] Falha ao tocar som:', error);
    }
  });
};

window.ensureAuth = function ensureAuth() {
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.includes('login.html') || path.endsWith('/');

  window.auth.onAuthStateChanged((user) => {
    if (user) {
      document.body.style.display = 'block';
    } else if (!isLoginPage) {
      window.location.href = './login.html';
    } else {
      document.body.style.display = 'block';
    }
  });
};

console.log('[Config] ✓ Projeto ativo:', firebaseConfig.projectId);
console.log('[Config] ✓ App:', 'PlateEye');
window.plateEyeAuth = {
  async login(email, password) {
    const credential = await window.auth.signInWithEmailAndPassword(email, password);

    try {
      const user = credential.user;
      if (user) {
        const userDoc = await window.db.collection('users').doc(user.uid).get();

        if (!userDoc.exists) {
          await window.auth.signOut();
          throw new Error('Perfil do usuário não encontrado no Firestore.');
        }

        const userData = userDoc.data() || {};

        if (userData.is_active === false) {
          await window.auth.signOut();
          throw new Error('Usuário desativado.');
        }

        await window.db.collection('users').doc(user.uid).set({
          last_access_at: firebase.firestore.FieldValue.serverTimestamp(),
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      throw error;
    }

    return credential;
  },

  async logout() {
    localStorage.removeItem('plateeye_fcm_token');
    await window.auth.signOut();
    window.location.href = './login.html';
  }
};

window.logout = async function logout() {
  try {
    await window.plateEyeAuth.logout();
  } catch (error) {
    console.error('[Logout] Erro:', error);
    alert('Erro ao deslogar. Tente novamente.');
  }
};