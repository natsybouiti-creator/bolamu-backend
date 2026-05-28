const { Worker } = require('bullmq');
const db = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');

const connection = { 
  host: process.env.REDIS_HOST || 'localhost', 
  port: process.env.REDIS_PORT || 6379 
};

const smsWorker = new Worker('bolamu', async (job) => {
  const { phones, message } = job.data;
  const startedAt = new Date();
  let itemsProcessed = 0;
  let errorsCount = 0;

  console.log(`[SMS WORKER] Traitement batch ${job.id} - ${phones.length} SMS`);

  for (const phone of phones) {
    try {
      await sendBolamuSms(phone, message);
      itemsProcessed++;
    } catch (err) {
      errorsCount++;
      console.error(`[SMS WORKER] Erreur envoi SMS ${phone}:`, err.message);
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

console.log('[SMS WORKER] Worker SMS démarré');

module.exports = smsWorker;
