// ============================================================
// Connexion Redis optionnelle pour BullMQ
// Redis ne doit JAMAIS faire crasher les routes critiques
// (upload, inscription). Si Redis est indisponible, les queues
// sont simplement désactivées.
// ============================================================
// NOTE : SMS abandonnés pour le lancement (raisons financières)
// WhatsApp direct utilisé en prod. BullMQ désactivé par défaut.
// ============================================================

let connection = null;
let errorLogged = false;

// Connexion SEULEMENT si REDIS_URL explicitement configuré
if (process.env.REDIS_URL) {
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

    connection = new IORedis(process.env.REDIS_URL, baseOptions);

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
} else {
  console.log('[QUEUES] Désactivées (pas de REDIS_URL configuré) — SMS/notifications via queue inactifs');
}

module.exports = { connection };
