const { Worker } = require('bullmq');
const db = require('../config/db');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { connection } = require('../config/redis');

let smsWorker = null;

if (!connection) {
  console.warn('[SMS WORKER] Redis indisponible - worker SMS désactivé');
} else {
  smsWorker = new Worker('bolamu', async (job) => {
  const { phones, message } = job.data;
  const startedAt = new Date();
  let itemsProcessed = 0;
  let errorsCount = 0;

  console.log(`[SMS WORKER] Traitement batch ${job.id} - ${phones.length} SMS`);

  for (const phone of phones) {
    try {
      await sendWhatsAppTemplate(phone, 'bolamu_batch_notification', [message]);
      itemsProcessed++;
    } catch (err) {
      errorsCount++;
      console.error(`[SMS WORKER] Erreur envoi WhatsApp ${phone}:`, err.message);
    }
  }

  const completedAt = new Date();

  // Log dans cron_logs
  try {
    await db.query(
      `INSERT INTO cron_logs 
       (job_name, started_at, completed_at, items_processed, errors_count)
       VALUES ($1, $2, $3, $4, $5)`,
      ['send-sms-batch', startedAt, completedAt, itemsProcessed, errorsCount]
    );
  } catch (logErr) {
    console.error('[SMS WORKER] Erreur log:', logErr.message);
  }

  console.log(`[SMS WORKER] Batch terminé - ${itemsProcessed} envoyés, ${errorsCount} erreurs`);

  return { itemsProcessed, errorsCount };
}, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000
  }
});

  smsWorker.on('completed', (job) => {
    console.log(`[SMS WORKER] Job ${job.id} terminé avec succès`);
  });

  smsWorker.on('failed', (job, err) => {
    console.error(`[SMS WORKER] Job ${job?.id} échoué:`, err.message);
  });

  smsWorker.on('error', (err) => {
    console.warn('[SMS WORKER] Erreur Redis (ignorée):', err.message);
  });

  console.log('[SMS WORKER] Worker SMS démarré');
}

module.exports = smsWorker;
