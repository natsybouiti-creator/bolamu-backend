const cron = require('node-cron');
const db = require('../config/db');
const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = at.SMS;

// Cron quotidien à 02h00 heure Brazzaville (UTC+1 = 01h00 UTC)
const jobAbonnement = cron.schedule('0 1 * * *', async () => {
  const maintenant = new Date();
  console.log(`[CRON ABONNEMENT] Démarrage — ${maintenant.toISOString()}`);

  let nb_traites = 0;
  let nb_erreurs = 0;
  const details = [];

  try {
    // 1. Rappels SMS — adhérents MoMo expirant dans 30 jours
    const rappels = await db.query(
      `SELECT s.patient_phone, u.first_name, s.expires_at, s.plan
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       AND s.is_active = TRUE`
    );

    for (const row of rappels.rows) {
      try {
        const dateExp = new Date(row.expires_at)
          .toLocaleDateString('fr-FR');
        await sms.send({
          to: [row.patient_phone],
          message: `Bonjour ${row.first_name}, votre abonnement Bolamu expire le ${dateExp}. Renouvelez pour 24 000 FCFA via MTN MoMo pour rester couvert. Bolamu - Votre santé, notre priorité.` 
        });
        nb_traites++;
        details.push(`SMS rappel envoyé : ${row.patient_phone}`);
      } catch (smsErr) {
        nb_erreurs++;
        details.push(`Erreur SMS ${row.patient_phone} : ${smsErr.message}`);
      }
    }

    // 2. Expiration — adhérents MoMo dont l'abonnement est expiré
    const expires = await db.query(
      `SELECT s.patient_phone, u.first_name
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.canal_paiement = 'momo_annuel'
       AND s.statut_collecte = 'actif'
       AND s.expires_at < NOW()
       AND s.is_active = TRUE`
    );

    for (const row of expires.rows) {
      try {
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
          [row.patient_phone, 
           JSON.stringify({ raison: 'expiration_momo_annuel' })]
        );

        // SMS notification
        try {
          await sms.send({
            to: [row.patient_phone],
            message: `Bonjour ${row.first_name}, votre abonnement Bolamu a expiré. Renouvelez pour 24 000 FCFA via MTN MoMo pour retrouver l'accès à vos soins. Bolamu.` 
          });
        } catch (smsErr) {
          details.push(`Erreur SMS expiration ${row.patient_phone}`);
        }

        nb_traites++;
        details.push(`Expiré : ${row.patient_phone}`);
      } catch (err) {
        nb_erreurs++;
        details.push(`Erreur expiration ${row.patient_phone} : ${err.message}`);
      }
    }

    // 3. Suspension cascade — bénéficiaires dont le payeur est suspendu
    const payeursSuspendus = await db.query(
      `SELECT DISTINCT bf.beneficiaire_phone, bf.payeur_phone
       FROM beneficiaires_familiaux bf
       JOIN users payeur ON payeur.phone = bf.payeur_phone
       JOIN users ben ON ben.phone = bf.beneficiaire_phone
       WHERE payeur.is_active = FALSE
       AND ben.is_active = TRUE
       AND bf.actif = TRUE`
    );

    for (const row of payeursSuspendus.rows) {
      try {
        await db.query(
          `UPDATE users SET is_active = FALSE WHERE phone = $1`,
          [row.beneficiaire_phone]
        );
        await db.query(
          `INSERT INTO audit_log 
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('beneficiaire_suspendu', 'system', 'users', $1, $2)`,
          [row.beneficiaire_phone, 
           JSON.stringify({ payeur: row.payeur_phone, raison: 'payeur_suspendu' })]
        );
        nb_traites++;
        details.push(`Bénéficiaire suspendu : ${row.beneficiaire_phone}`);
      } catch (err) {
        nb_erreurs++;
        details.push(`Erreur suspension bénéficiaire ${row.beneficiaire_phone}`);
      }
    }

  } catch (globalErr) {
    nb_erreurs++;
    details.push(`Erreur globale : ${globalErr.message}`);
  }

  // Log dans cron_logs
  try {
    await db.query(
      `INSERT INTO cron_logs 
       (job_name, nb_traites, nb_erreurs, details)
       VALUES ('abonnement_quotidien', $1, $2, $3)`,
      [nb_traites, nb_erreurs, details.join(' | ')]
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
