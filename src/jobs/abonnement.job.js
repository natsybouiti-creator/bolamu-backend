const cron = require('node-cron');
const db = require('../config/db');
const { notify } = require('../services/notification.service');
const { buildWameLink } = require('../services/wame.service');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { normalizePhone } = require('../utils/phone');
const { awardZora } = require('../services/zora.service');

// Fonction extraite du scheduler pour rester invocable directement (tests,
// rattrapage manuel) sans dépendre du déclenchement cron.
async function runAbonnementJob() {
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
          await sendAutoMessage(phone, 'abonnement_expire', []);
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
      const updatedSubs = await db.query(
        `UPDATE subscriptions
         SET statut_collecte = 'expire', is_active = FALSE, status = 'expired', updated_at = NOW()
         WHERE patient_phone = ANY($1) AND is_active = TRUE AND expires_at < NOW()
         RETURNING id, patient_phone`,
        [phones]
      );

      // Log audit — isolé dans son propre try/catch (pattern étapes 2/8) : un
      // échec ici ne doit jamais annuler la cascade bénéficiaires/parrainage
      // qui suit. BUG-FIX : target_id (integer) recevait auparavant le phone
      // (varchar) au lieu de l'id numérique de la subscription — provoquait
      // systématiquement "value ... is out of range for type integer" et
      // avortait tout le reste du cron (constaté 6 fois en prod, 23/06→12/07).
      try {
        for (const sub of updatedSubs.rows) {
          await db.query(
            `INSERT INTO audit_log
             (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('abonnement_expire', 'system', 'subscriptions', $1, $2::jsonb)`,
            [sub.id, JSON.stringify({ raison: 'expiration_abonnement', patient_phone: sub.patient_phone })]
          );
        }
      } catch (auditErr) {
        nb_erreurs++;
        allDetails.push(`Erreur audit_log expiration : ${auditErr.message}`);
      }
      
      // Notification WhatsApp en batch
      for (const phone of phones) {
        try {
          const normalizedPhone = normalizePhone(phone);
          await sendAutoMessage(normalizedPhone, 'abonnement_expire', []);
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
        await sendAutoMessage(row.phone, 'bolamu_event_rappel', [
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

    // 8. Rappels RDV 24h avant — Sprint 6A
    try {
      const rdvReminderResult = await db.query(
        `SELECT a.patient_phone, u.first_name, a.appointment_date, a.appointment_time, d.full_name as doctor_name, d.address
         FROM appointments a
         JOIN users u ON u.phone = a.patient_phone
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.status = 'confirme'
         AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'`
      );
      
      for (const row of rdvReminderResult.rows) {
        try {
          const heure = row.appointment_time;
          await sendAutoMessage(row.patient_phone, 'rappel_rdv_24h', [
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
    } catch (rdvErr) {
      nb_erreurs++;
      allDetails.push(`Erreur requête RDV : ${rdvErr.message}`);
    }

    // 9. Calculer classement hebdo — Sprint 6A
    // DÉSACTIVÉ — classement maintenant calculé en live depuis zora_ledger
    // La table leaderboard_weekly est conservée pour historique uniquement
    // Voir src/services/leaderboard.service.js — computeWeeklyLeaderboard()
    // try {
    //   const leaderboardResult = await computeWeeklyLeaderboard();
    //   nb_traites += leaderboardResult.count;
    //   allDetails.push(`Classement hebdo calculé : ${leaderboardResult.count} joueurs`);
    // } catch (leaderboardErr) {
    //   nb_erreurs++;
    //   allDetails.push(`Erreur classement hebdo : ${leaderboardErr.message}`);
    // }

    // 10. Crédit parrainage (carte Gagner > Santé) — le parrain est crédité
    // dès que son filleul (users.referred_by) a un abonnement payant actif.
    // Un seul crédit par filleul, idempotent via zora_ledger.proof_reference =
    // phone du filleul (indépendant des renouvellements ultérieurs).
    try {
      const parrainagesResult = await db.query(
        `SELECT u.phone AS filleul_phone, u.referred_by AS parrain_phone
         FROM users u
         JOIN subscriptions s ON s.patient_phone = u.phone
         WHERE u.referred_by IS NOT NULL
           AND s.is_active = TRUE
           AND s.plan IN ('essentiel', 'standard', 'premium')
           AND NOT EXISTS (
             SELECT 1 FROM zora_ledger zl
             WHERE zl.action_type = 'parrainage' AND zl.proof_reference = u.phone
           )`
      );

      for (const row of parrainagesResult.rows) {
        try {
          const result = await awardZora({
            phone: row.parrain_phone,
            action_type: 'parrainage',
            proof_class: 'system_event',
            proof_source: 'cron_abonnement_parrainage',
            recording_method: null,
            proof_reference: row.filleul_phone
          });
          if (result.success) {
            nb_traites++;
            allDetails.push(`Parrainage crédité : ${row.parrain_phone} (filleul ${row.filleul_phone})`);
          }
        } catch (err) {
          nb_erreurs++;
          allDetails.push(`Erreur crédit parrainage ${row.parrain_phone}: ${err.message}`);
        }
      }
    } catch (parrainageErr) {
      nb_erreurs++;
      allDetails.push(`Erreur requête parrainage : ${parrainageErr.message}`);
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
  return { nb_traites, nb_erreurs, details: allDetails };
}

// Cron quotidien à 02h00 heure Brazzaville (UTC+1 = 01h00 UTC)
const jobAbonnement = cron.schedule('0 1 * * *', runAbonnementJob, {
  timezone: 'Africa/Brazzaville'
});

module.exports = { jobAbonnement, runAbonnementJob };
