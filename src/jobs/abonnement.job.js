const cron = require('node-cron');
const db = require('../config/db');
const { notify } = require('../services/notification.service');
const { buildWameLink } = require('../services/wame.service');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { normalizePhone } = require('../utils/phone');
const { computeWeeklyLeaderboard } = require('../services/leaderboard.service');

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
      for (const row of rappelsResult.rows) {
        try {
          const phone = normalizePhone(row.patient_phone);
          await sendWhatsAppTemplate(phone, 'abonnement_expire', []);
          nb_traites++;
          allDetails.push(`Rappel J-30 envoyé : ${phone}`);
        } catch (err) {
          nb_erreurs++;
          allDetails.push(`Erreur rappel J-30 ${row.patient_phone}`);
        }
      }
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

    // 3. Expiration — tous les abonnements expirés (MoMo annuel ou standard mensuel)
    const expiresResult = await db.query(
      `SELECT s.patient_phone, u.first_name
       FROM subscriptions s
       JOIN users u ON u.phone = s.patient_phone
       WHERE s.expires_at < NOW()
       AND s.is_active = TRUE`
    );

    if (expiresResult.rows.length > 0) {
      const phones = expiresResult.rows.map(row => row.patient_phone);

      // Suspendre les utilisateurs en une seule requête
      await db.query(
        `UPDATE users SET is_active = FALSE WHERE phone = ANY($1)`,
        [phones]
      );

      // Mettre à jour les abonnements en une seule requête (tous canaux confondus)
      await db.query(
        `UPDATE subscriptions
         SET statut_collecte = 'expire', is_active = FALSE, status = 'expired', updated_at = NOW()
         WHERE patient_phone = ANY($1) AND is_active = TRUE AND expires_at < NOW()`,
        [phones]
      );

      // Log audit en une seule requête
      for (const phone of phones) {
        await db.query(
          `INSERT INTO audit_log
           (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('abonnement_expire', 'system', 'subscriptions', $1, $2::jsonb)`,
          [phone, JSON.stringify({ raison: 'expiration_abonnement' })]
        );
      }
      
      // Notification WhatsApp en batch
      for (const phone of phones) {
        try {
          const normalizedPhone = normalizePhone(phone);
          await sendWhatsAppTemplate(normalizedPhone, 'abonnement_expire', []);
          nb_traites++;
          allDetails.push(`Notification expiration envoyée : ${normalizedPhone}`);
        } catch (err) {
          nb_erreurs++;
          allDetails.push(`Erreur notification expiration ${phone}`);
        }
      }
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
           VALUES ('beneficiaire_suspendu', 'system', 'users', $1, $2::jsonb)`,
          [row.beneficiaire_phone, JSON.stringify({ payeur: row.payeur_phone, raison: 'payeur_suspendu' })]
        );
      }
      
      nb_traites += beneficiaires.length;
      allDetails.push(`Bénéficiaires suspendus : ${beneficiaires.length}`);
    }

    // 5. Nettoyage événements Elonga — Sprint 5
    // Marquer les événements terminés comme 'completed'
    const eventsCompletedResult = await db.query(
      `UPDATE elonga_events 
       SET status = 'completed', updated_at = NOW()
       WHERE status = 'published' AND ends_at < NOW()
       RETURNING id`
    );
    
    if (eventsCompletedResult.rows.length > 0) {
      nb_traites += eventsCompletedResult.rows.length;
      allDetails.push(`Événements terminés : ${eventsCompletedResult.rows.length}`);
    }
    
    // Marquer les inscriptions non check-in comme 'no_show'
    const noShowResult = await db.query(
      `UPDATE elonga_registrations 
       SET status = 'no_show'
       WHERE status = 'registered' 
       AND event_id IN (SELECT id FROM elonga_events WHERE status = 'completed')
       RETURNING id`
    );
    
    if (noShowResult.rows.length > 0) {
      nb_traites += noShowResult.rows.length;
      allDetails.push(`No-shows marqués : ${noShowResult.rows.length}`);
    }

    // 6. Rappels événements Elonga 24h avant — Sprint 6A
    const eventsReminderResult = await db.query(
      `SELECT er.phone, u.first_name, e.title, e.starts_at, e.location_name
       FROM elonga_registrations er
       JOIN elonga_events e ON er.event_id = e.id
       JOIN users u ON u.phone = er.phone
       WHERE er.status = 'registered'
       AND e.starts_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'`
    );
    
    for (const row of eventsReminderResult.rows) {
      try {
        const heure = new Date(row.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        await sendWhatsAppTemplate(row.phone, 'rappel_evenement', [
          row.first_name,
          row.title,
          heure,
          row.location_name
        ]);
        nb_traites++;
        allDetails.push(`Rappel événement envoyé : ${row.phone}`);
      } catch (err) {
        nb_erreurs++;
        allDetails.push(`Erreur rappel événement ${row.phone}`);
      }
    }

    // 7. Vouchers expirant 48h avant — Sprint 6A
    const vouchersExpiringResult = await db.query(
      `SELECT v.patient_phone, u.first_name, v.title, v.partner_name, v.expires_at
       FROM zora_vouchers v
       JOIN users u ON u.phone = v.patient_phone
       WHERE v.is_active = TRUE
       AND v.expires_at BETWEEN NOW() + INTERVAL '47 hours' AND NOW() + INTERVAL '49 hours'`
    );
    
    for (const row of vouchersExpiringResult.rows) {
      try {
        const date = new Date(row.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        await sendWhatsAppTemplate(row.patient_phone, 'voucher_expirant', [
          row.title,
          row.partner_name,
          date
        ]);
        nb_traites++;
        allDetails.push(`Rappel voucher expirant envoyé : ${row.patient_phone}`);
      } catch (err) {
        nb_erreurs++;
        allDetails.push(`Erreur rappel voucher ${row.patient_phone}`);
      }
    }

    // 8. Rappels RDV 24h avant — Sprint 6A
    const rdvReminderResult = await db.query(
      `SELECT a.patient_phone, u.first_name, a.appointment_date, a.appointment_time, d.full_name as doctor_name, d.address
       FROM appointments a
       JOIN users u ON u.patient_phone = u.phone
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.status = 'confirme'
       AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'`
    );
    
    for (const row of rdvReminderResult.rows) {
      try {
        const heure = row.appointment_time;
        await sendWhatsAppTemplate(row.patient_phone, 'rappel_rdv_24h', [
          heure,
          row.doctor_name,
          row.address || 'Cabinet médical'
        ]);
        nb_traites++;
        allDetails.push(`Rappel RDV envoyé : ${row.patient_phone}`);
      } catch (err) {
        nb_erreurs++;
        allDetails.push(`Erreur rappel RDV ${row.patient_phone}`);
      }
    }

    // 9. Calculer classement hebdo — Sprint 6A
    try {
      const leaderboardResult = await computeWeeklyLeaderboard();
      nb_traites += leaderboardResult.count;
      allDetails.push(`Classement hebdo calculé : ${leaderboardResult.count} joueurs`);
    } catch (leaderboardErr) {
      nb_erreurs++;
      allDetails.push(`Erreur classement hebdo : ${leaderboardErr.message}`);
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
