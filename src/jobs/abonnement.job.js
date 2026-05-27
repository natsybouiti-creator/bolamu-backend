const cron = require('node-cron');
const db = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const { notify } = require('../services/notification.service');

// Configuration batch
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;

// Fonction helper pour attendre
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction helper pour traiter par batch
async function processBatch(query, processor, batchName) {
  let offset = 0;
  let totalTraites = 0;
  let totalErreurs = 0;
  const details = [];

  while (true) {
    const batch = await db.query(`${query} LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    if (batch.rows.length === 0) break;

    console.log(`[CRON ABONNEMENT] ${batchName} - Batch ${Math.floor(offset / BATCH_SIZE) + 1} - ${batch.rows.length} enregistrements`);

    for (const row of batch.rows) {
      try {
        await processor(row);
        totalTraites++;
      } catch (err) {
        totalErreurs++;
        details.push(`Erreur ${batchName} : ${err.message}`);
        console.error(`[CRON ABONNEMENT] Erreur ${batchName} :`, err.message);
      }
    }

    // Calculer taux d'erreur du batch
    const tauxErreur = (totalErreurs / batch.rows.length) * 100;
    if (tauxErreur > 10) {
      console.warn(`[CRON ABONNEMENT] ALERTE : Taux d'erreur élevé batch ${batchName} - ${tauxErreur.toFixed(1)}%`);
    }

    offset += BATCH_SIZE;
    
    // Attendre entre les batches pour ne pas saturer la base
    if (batch.rows.length === BATCH_SIZE) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { totalTraites, totalErreurs, details };
}

// Cron quotidien à 02h00 heure Brazzaville (UTC+1 = 01h00 UTC)
const jobAbonnement = cron.schedule('0 1 * * *', async () => {
  const maintenant = new Date();
  console.log(`[CRON ABONNEMENT] Démarrage — ${maintenant.toISOString()}`);

  let nb_traites = 0;
  let nb_erreurs = 0;
  const allDetails = [];

  try {
    // 1. Rappels SMS — adhérents MoMo expirant dans 30 jours
    const rappelsResult = await processBatch(
      `SELECT s.patient_phone, u.first_name, s.expires_at, s.plan
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       AND s.is_active = TRUE`,
      async (row) => {
        const dateExp = new Date(row.expires_at).toLocaleDateString('fr-FR');
        await sendBolamuSms(row.patient_phone, `Bonjour ${row.first_name}, votre abonnement Bolamu expire le ${dateExp}. Renouvelez pour 24 000 FCFA via MTN MoMo pour rester couvert. Bolamu - Votre santé, notre priorité.`);
        allDetails.push(`SMS rappel envoyé : ${row.patient_phone}`);
      },
      'Rappels SMS'
    );
    nb_traites += rappelsResult.totalTraites;
    nb_erreurs += rappelsResult.totalErreurs;
    allDetails.push(...rappelsResult.details);

    // 2. Notifications abonnement expirant dans 3 jours (Sprint 7)
    const expire3DaysResult = await processBatch(
      `SELECT s.patient_phone, u.first_name, s.plan, s.expires_at
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.expires_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '3 days'
       AND s.is_active = TRUE`,
      async (row) => {
        try {
          await notify(row.patient_phone, 'abonnement_expire', {
            plan: row.plan,
            expires_at: row.expires_at
          });
          allDetails.push(`Notification expiration J-3 envoyée : ${row.patient_phone}`);
        } catch (notifyErr) {
          allDetails.push(`Erreur notification J-3 ${row.patient_phone}`);
        }
      },
      'Notifications expiration J-3'
    );
    nb_traites += expire3DaysResult.totalTraites;
    nb_erreurs += expire3DaysResult.totalErreurs;
    allDetails.push(...expire3DaysResult.details);

    // 3. Expiration — adhérents MoMo dont l'abonnement est expiré
    const expiresResult = await processBatch(
      `SELECT s.patient_phone, u.first_name
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at < NOW()
       AND s.is_active = TRUE`,
      async (row) => {
        // Suspendre l'adhérent
        await db.query(
          `UPDATE users SET is_active = FALSE WHERE phone = $1`,
          [row.patient_phone]
        );
        await db.query(
          `UPDATE subscriptions 
           SET statut_collecte = 'expire', is_active = FALSE, updated_at = NOW()
           WHERE patient_phone = $1 AND canal_paiement = 'momo_annuel'`,
          [row.patient_phone]
        );

        // Log audit
        await db.query(
          `INSERT INTO audit_log 
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('abonnement_expire', 'system', 'subscriptions', $1, $2)`,
          [row.patient_phone, JSON.stringify({ raison: 'expiration_momo_annuel' })]
        );

        // SMS notification
        try {
          await sendBolamuSms(row.patient_phone, `Bonjour ${row.first_name}, votre abonnement Bolamu a expiré. Renouvelez pour 24 000 FCFA via MTN MoMo pour retrouver l'accès à vos soins. Bolamu.`);
        } catch (smsErr) {
          allDetails.push(`Erreur SMS expiration ${row.patient_phone}`);
        }

        allDetails.push(`Expiré : ${row.patient_phone}`);
      },
      'Expiration abonnements'
    );
    nb_traites += expiresResult.totalTraites;
    nb_erreurs += expiresResult.totalErreurs;
    allDetails.push(...expiresResult.details);

    // 3. Suspension cascade — bénéficiaires dont le payeur est suspendu
    const payeursResult = await processBatch(
      `SELECT DISTINCT bf.beneficiaire_phone, bf.payeur_phone
       FROM beneficiaires_familiaux bf
       JOIN users payeur ON payeur.phone = bf.payeur_phone
       JOIN users ben ON ben.phone = bf.beneficiaire_phone
       WHERE payeur.is_active = FALSE
       AND ben.is_active = TRUE
       AND bf.actif = TRUE`,
      async (row) => {
        await db.query(
          `UPDATE users SET is_active = FALSE WHERE phone = $1`,
          [row.beneficiaire_phone]
        );
        await db.query(
          `INSERT INTO audit_log 
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('beneficiaire_suspendu', 'system', 'users', $1, $2)`,
          [row.beneficiaire_phone, JSON.stringify({ payeur: row.payeur_phone, raison: 'payeur_suspendu' })]
        );
        allDetails.push(`Bénéficiaire suspendu : ${row.beneficiaire_phone}`);
      },
      'Suspension cascade'
    );
    nb_traites += payeursResult.totalTraites;
    nb_erreurs += payeursResult.totalErreurs;
    allDetails.push(...payeursResult.details);

  } catch (globalErr) {
    nb_erreurs++;
    allDetails.push(`Erreur globale : ${globalErr.message}`);
    console.error('[CRON ABONNEMENT] Erreur globale :', globalErr.message);
  }

  // Log dans cron_logs
  try {
    await db.query(
      `INSERT INTO cron_logs 
       (job_name, nb_traites, nb_erreurs, details)
       VALUES ('abonnement_quotidien', $1, $2, $3)`,
      [nb_traites, nb_erreurs, allDetails.join(' | ').substring(0, 5000)] // Limiter à 5000 caractères
    );
  } catch (logErr) {
    console.error('[CRON LOG ERROR]', logErr.message);
  }

  console.log(
    `[CRON ABONNEMENT] Terminé — ${nb_traites} traités, ${nb_erreurs} erreurs`
  );
}, {
  timezone: 'Africa/Brazzaville'
});

module.exports = { jobAbonnement };
