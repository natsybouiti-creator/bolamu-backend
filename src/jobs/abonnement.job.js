const cron = require('node-cron');
const db = require('../config/db');
const { notify } = require('../services/notification.service');
const { addJob } = require('../queues/bolamu-queue');
const { buildWameLink } = require('../services/wame.service');

// Fonction helper pour envoyer SMS en batch via BullMQ
// Non bloquant : si Redis est indisponible, le job est simplement ignoré
async function sendSmsBatch(phones, message) {
  if (phones.length === 0) return 0;
  
  await addJob('send-sms-batch', { phones, message });
  
  return phones.length;
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
    const rappelsResult = await db.query(
      `SELECT s.patient_phone, u.first_name, s.expires_at
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       AND s.is_active = TRUE`
    );
    
    if (rappelsResult.rows.length > 0) {
      const phones = rappelsResult.rows.map(row => row.patient_phone);
      const message = `Bonjour, votre abonnement Bolamu expire bientôt. Renouvelez pour 24 000 FCFA via MTN MoMo pour rester couvert. Bolamu - Votre santé, notre priorité.`;
      const sent = await sendSmsBatch(phones, message);
      nb_traites += sent;
      allDetails.push(`SMS rappels envoyés : ${sent} abonnés`);
    }

    // 2. Notifications abonnement expirant dans 3 jours (Sprint 7)
    const expire3DaysResult = await db.query(
      `SELECT s.patient_phone, u.first_name, s.plan, s.expires_at
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.expires_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '3 days'
       AND s.is_active = TRUE`
    );
    
    for (const row of expire3DaysResult.rows) {
      try {
        await notify(row.patient_phone, 'abonnement_expire', {
          plan: row.plan,
          expires_at: row.expires_at
        });

        buildWameLink(row.patient_phone, 'abonnement_expire', {
          prenom: row.first_name,
          date_expiration: new Date(row.expires_at).toLocaleDateString('fr-FR')
        });

        nb_traites++;
        allDetails.push(`Notification expiration J-3 envoyée : ${row.patient_phone}`);
      } catch (notifyErr) {
        nb_erreurs++;
        allDetails.push(`Erreur notification J-3 ${row.patient_phone}`);
      }
    }

    // 3. Expiration — adhérents MoMo dont l'abonnement est expiré
    const expiresResult = await db.query(
      `SELECT s.patient_phone, u.first_name
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at < NOW()
       AND s.is_active = TRUE`
    );
    
    if (expiresResult.rows.length > 0) {
      const phones = expiresResult.rows.map(row => row.patient_phone);
      
      // Suspendre les utilisateurs en une seule requête
      await db.query(
        `UPDATE users SET is_active = FALSE WHERE phone = ANY($1)`,
        [phones]
      );
      
      // Mettre à jour les abonnements en une seule requête
      await db.query(
        `UPDATE subscriptions 
         SET statut_collecte = 'expire', is_active = FALSE, updated_at = NOW()
         WHERE patient_phone = ANY($1) AND canal_paiement = 'momo_annuel'`,
        [phones]
      );
      
      // Log audit en une seule requête
      for (const phone of phones) {
        await db.query(
          `INSERT INTO audit_log 
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('abonnement_expire', 'system', 'subscriptions', $1, $2)`,
          [phone, JSON.stringify({ raison: 'expiration_momo_annuel' })]
        );
      }
      
      // SMS notification en batch
      const message = `Bonjour, votre abonnement Bolamu a expiré. Renouvelez pour 24 000 FCFA via MTN MoMo pour retrouver l'accès à vos soins. Bolamu.`;
      await sendSmsBatch(phones, message);
      
      nb_traites += phones.length;
      allDetails.push(`Expirés : ${phones.length} abonnés`);
    }

    // 4. Suspension cascade — bénéficiaires dont le payeur est suspendu
    const payeursResult = await db.query(
      `SELECT DISTINCT bf.beneficiaire_phone, bf.payeur_phone
       FROM beneficiaires_familiaux bf
       JOIN users payeur ON payeur.phone = bf.payeur_phone
       JOIN users ben ON ben.phone = bf.beneficiaire_phone
       WHERE payeur.is_active = FALSE
       AND ben.is_active = TRUE
       AND bf.actif = TRUE`
    );
    
    if (payeursResult.rows.length > 0) {
      const beneficiaires = payeursResult.rows.map(row => row.beneficiaire_phone);
      
      // Suspendre les bénéficiaires en une seule requête
      await db.query(
        `UPDATE users SET is_active = FALSE WHERE phone = ANY($1)`,
        [beneficiaires]
      );
      
      // Log audit en une seule requête
      for (const row of payeursResult.rows) {
        await db.query(
          `INSERT INTO audit_log 
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('beneficiaire_suspendu', 'system', 'users', $1, $2)`,
          [row.beneficiaire_phone, JSON.stringify({ payeur: row.payeur_phone, raison: 'payeur_suspendu' })]
        );
      }
      
      nb_traites += beneficiaires.length;
      allDetails.push(`Bénéficiaires suspendus : ${beneficiaires.length}`);
    }

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
