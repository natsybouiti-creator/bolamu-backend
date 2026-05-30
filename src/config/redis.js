// ============================================================
// Connexion Redis optionnelle pour BullMQ
// Redis ne doit JAMAIS faire crasher les routes critiques
// (upload, inscription). Si Redis est indisponible, les queues
// sont simplement désactivées.
// ============================================================

let connection = null;
let errorLogged = false;

try {
  const IORedis = require('ioredis');

  const baseOptions = {
    // BullMQ exige maxRetriesPerRequest = null
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Pas de reconnexion infinie : on abandonne après quelques essais
    retryStrategy: (times) => {
      if (times > 5) return null; // stop : queues désactivées
      return Math.min(times * 500, 2000);
    }
  };

  connection = process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, baseOptions)
    : new IORedis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        ...baseOptions
      });

  // Listener obligatoire : sans lui une erreur ECONNREFUSED
  // remonte en exception non gérée et crashe le process
  connection.on('error', (err) => {
    if (!errorLogged) {
      console.warn('[Redis] Indisponible - queues désactivées:', err.message);
      errorLogged = true;
    }
  });

  connection.on('connect', () => {
    errorLogged = false;
    console.log('[Redis] Connecté');
  });
} catch (e) {
  console.warn('[Redis] Module non disponible - queues désactivées:', e.message);
  connection = null;
}

module.exports = { connection };
