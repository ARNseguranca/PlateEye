const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

exports.onNewAlertPush = functions.firestore
  .document('alerts/{alertId}')
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const alertId = context.params.alertId;
    const plate = alertData.plate || 'SEM PLACA';
    const camera = alertData.camera_name || 'Câmera não identificada';

    console.log('[Push] Novo alerta:', alertId, plate);

    // 1. Busca usuários com permissão
    const usersSnap = await db.collection('users')
      .where('is_active', '==', true)
      .where('allowed_menus', 'array-contains', 'alerts')
      .get();

    if (usersSnap.empty) {
      console.log('[Push] Nenhum usuário com permissão');
      return null;
    }

    // 2. Coleta tokens (suporta array ou string)
    const tokens = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcm_tokens && Array.isArray(data.fcm_tokens)) {
        tokens.push(...data.fcm_tokens.filter(t => t));
      } else if (data.fcm_token && typeof data.fcm_token === 'string') {
        tokens.push(data.fcm_token);
      }
    });

    if (tokens.length === 0) {
      console.log('[Push] Nenhum token válido');
      return null;
    }

    // 3. Payload com webpush para background
    const message = {
      data: {
        alert_id: alertId,
        plate: plate,
        camera_name: camera,
        title: `🚨 ALERTA LPR: ${plate}`,
        body: `Veículo identificado na ${camera}`,
        url: '/alerts.html'
      },
      webpush: {
        notification: {
          title: `🚨 ALERTA LPR: ${plate}`,
          body: `Veículo identificado na ${camera}`,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          requireInteraction: 'true',
          vibrate: [300, 120, 300, 120, 300],
          tag: `alert-${alertId}`,
          sound: '/alert-sound.mp3'
        },
        fcmOptions: {
          link: '/alerts.html'
        },
        headers: {
          Urgency: 'high',
          TTL: '3600'
        }
      }
    };

    // 4. Envia com sendMulticast (não deprecated)
    try {
      const response = await messaging.sendMulticast({
        ...message,
        tokens: tokens
      });

      console.log(`[Push] ✓ ${response.successCount} enviadas`);
      console.log(`[Push] ✗ ${response.failureCount} falharam`);

      // 5. Remove tokens inválidos
      if (response.failureCount > 0) {
        const badTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            badTokens.push(tokens[idx]);
            console.log(`[Push] Token inválido:`, tokens[idx], resp.error?.code);
          }
        });

        // Remove tokens ruins do Firestore
        for (const badToken of badTokens) {
          await db.collectionGroup('users')
            .where('fcm_tokens', 'array-contains', badToken)
            .get()
            .then(snap => {
              snap.docs.forEach(doc => {
                doc.ref.update({
                  fcm_tokens: admin.firestore.FieldValue.arrayRemove(badToken)
                });
              });
            })
            .catch(err => console.error('[Push] Erro ao remover token:', err));
        }
      }

      return { success: true, sent: response.successCount };
    } catch (error) {
      console.error('[Push] Erro ao disparar:', error);
      throw error;
    }
  });