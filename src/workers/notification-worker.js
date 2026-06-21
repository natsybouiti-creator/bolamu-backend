const { Worker } = require('bullmq');
const { sendToUser } = require('../services/push.service');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const db = require('../config/db');
const { connection } = require('../config/redis');

let notificationWorker = null;

if (!connection) {
  console.warn('[NOTIFICATION WORKER] Redis indisponible - worker notifications désactivé');
} else {
  notificationWorker = new Worker('bolamu', async (job) => {
  const { type, payload } = job.data;
  const startedAt = new Date();
  let itemsProcessed = 0;
  let errorsCount = 0;

  console.log(`[NOTIFICATION WORKER] Traitement job ${job.id} - type: ${type}`);

  try {
    if (type === 'push') {
      const { user_phone, titre, message, notification_type, data } = payload;
      const result = await sendToUser(user_phone, {
        titre: titre || 'Bolamu',
        message: message || '',
        type: notification_type || 'info',
        data: data || {}
      });
      if (result.success) {
        itemsProcessed = 1;
      } else {
        errorsCount = 1;
      }
    } else if (type === 'sms') {
      const { phones, message } = payload;
      for (const phone of phones) {
        try {
          await sendWhatsAppTemplate(phone, 'bolamu_batch_notification', [message]);
          itemsProcessed++;
        } catch (err) {
          errorsCount++;
          console.error(`[NOTIFICATION WORKER] Erreur envoi WhatsApp ${phone}:`, err.message);
        }
      }
    } else {
      console.error(`[NOTIFICATION WORKER] Type inconnu: ${type}`);
      errorsCount = 1;
    }
  } catch (error) {
    console.error(`[NOTIFICATION WORKER] Erreur job ${job.id}:`, error.message);
    errorsCount = 1;
  }

  const completedAt = new Date();

  // Log dans cron_logs
  try {
    await db.query(
      `INSERT INTO cron_logs 
       (job_name, started_at, completed_at, items_processed, errors_count)
       VALUES ($1, $2, $3, $4, $5)`,
      ['send-notification', startedAt, completedAt, itemsProcessed, errorsCount]
    );
  } catch (logErr) {
    console.error('[NOTIFICATION WORKER] Erreur log:', logErr.message);
  }

  console.log(`[NOTIFICATION WORKER] Job ${job.id} terminé - ${itemsProcessed} envoyés, ${errorsCount} erreurs`);

  return { itemsProcessed, errorsCount };
}, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000
  }
});

  notificationWorker.on('completed', (job) => {
    console.log(`[NOTIFICATION WORKER] Job ${job.id} terminé avec succès`);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`[NOTIFICATION WORKER] Job ${job?.id} échoué:`, err.message);
  });

  notificationWorker.on('error', (err) => {
    console.warn('[NOTIFICATION WORKER] Erreur Redis (ignorée):', err.message);
  });

  console.log('[NOTIFICATION WORKER] Worker notifications démarré');
}

module.exports = notificationWorker;
