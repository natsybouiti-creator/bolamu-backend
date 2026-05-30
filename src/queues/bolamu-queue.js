const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

// Queue optionnelle : null si Redis indisponible
let bolamuQueue = null;

if (connection) {
  try {
    bolamuQueue = new Queue('bolamu', { connection });
    bolamuQueue.on('error', (err) => {
      console.warn('[BULLMQ Queue] Erreur (ignorée):', err.message);
    });
  } catch (e) {
    console.warn('[BULLMQ Queue] Initialisation impossible - queue désactivée:', e.message);
    bolamuQueue = null;
  }
}

// Ajoute un job sans jamais bloquer la route appelante
async function addJob(name, data, opts = {}) {
  if (!bolamuQueue) {
    console.warn(`[BULLMQ Queue] Redis indisponible - job '${name}' ignoré`);
    return null;
  }
  try {
    return await bolamuQueue.add(name, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...opts
    });
  } catch (e) {
    console.warn(`[BULLMQ Queue] Échec ajout job '${name}' (ignoré):`, e.message);
    return null;
  }
}

async function addNotificationJob(type, payload) {
  return addJob('send-notification', { type, payload });
}

module.exports = { bolamuQueue, addJob, addNotificationJob };
