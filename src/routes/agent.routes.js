// ============================================================
// BOLAMU — Routes Agent Bolamu (inscription terrain patients/partenaires)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');

const { registerPatient } = require('../controllers/patient.controller');
const { registerDoctor } = require('../controllers/doctor.controller');
const { registerPharmacie } = require('../controllers/pharmacie.controller');
const { registerLaboratoire } = require('../controllers/laboratoire.controller');

// Middleware : agent Bolamu uniquement (pas de données médicales, pas de routes admin)
function requireAgent(req, res, next) {
  if (!req.user || req.user.role !== 'agent_bolamu') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux agents Bolamu' });
  }
  next();
}

// ─── GET /dashboard — stats de l'agent connecté ──────────────────────────────
router.get('/dashboard', authMiddleware, requireAgent, async (req, res) => {
  try {
    const agentPhone = normalizePhone(req.user.phone);

    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE agent_phone = $1 AND role = 'patient') AS patients_total,
        (SELECT COUNT(*) FROM users WHERE agent_phone = $1 AND role = 'patient'
           AND created_at >= date_trunc('month', NOW())) AS patients_ce_mois,
        (SELECT COUNT(*) FROM users WHERE agent_phone = $1 AND role = 'patient'
           AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND created_at < date_trunc('month', NOW())) AS patients_mois_precedent,
        (
          (SELECT COUNT(*) FROM doctors WHERE agent_phone = $1)
          + (SELECT COUNT(*) FROM pharmacies WHERE agent_phone = $1)
          + (SELECT COUNT(*) FROM laboratories WHERE agent_phone = $1)
        ) AS partenaires_total,
        (
          (SELECT COUNT(*) FROM doctors WHERE agent_phone = $1 AND created_at >= date_trunc('month', NOW()))
          + (SELECT COUNT(*) FROM pharmacies WHERE agent_phone = $1 AND created_at >= date_trunc('month', NOW()))
          + (SELECT COUNT(*) FROM laboratories WHERE agent_phone = $1 AND created_at >= date_trunc('month', NOW()))
        ) AS partenaires_ce_mois,
        (
          (SELECT COUNT(*) FROM doctors WHERE agent_phone = $1
             AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
             AND created_at < date_trunc('month', NOW()))
          + (SELECT COUNT(*) FROM pharmacies WHERE agent_phone = $1
             AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
             AND created_at < date_trunc('month', NOW()))
          + (SELECT COUNT(*) FROM laboratories WHERE agent_phone = $1
             AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
             AND created_at < date_trunc('month', NOW()))
        ) AS partenaires_mois_precedent
      `,
      [agentPhone]
    );

    const derniers = await pool.query(
      `SELECT full_name AS nom, 'patient' AS role, created_at FROM users
         WHERE agent_phone = $1 AND role = 'patient'
       UNION ALL
       SELECT full_name AS nom, 'doctor' AS role, created_at FROM doctors WHERE agent_phone = $1
       UNION ALL
       SELECT name AS nom, 'pharmacie' AS role, created_at FROM pharmacies WHERE agent_phone = $1
       UNION ALL
       SELECT name AS nom, 'laboratoire' AS role, created_at FROM laboratories WHERE agent_phone = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [agentPhone]
    );

    res.json({ success: true, stats: result.rows[0], derniers_inscrits: derniers.rows });
  } catch (err) {
    console.error('[AGENT DASHBOARD]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /inscrire-patient — inscription patient + abonnement optionnel ─────
router.post('/inscrire-patient', authMiddleware, requireAgent, async (req, res) => {
  // Réutilise la logique existante de patient.controller.js (validation, INSERT,
  // audit_log, WhatsApp) sans la dupliquer : on capture sa réponse via un res factice.
  let captured = null;
  const fakeRes = {
    status(code) { this._status = code; return this; },
    json(body) { captured = { status: this._status || 200, body }; return this; }
  };

  await registerPatient(req, fakeRes);

  if (!captured || !captured.body.success) {
    return res.status(captured?.status || 500).json(captured?.body || { success: false, message: 'Erreur inscription patient' });
  }

  // Abonnement optionnel si un plan a été choisi dans le formulaire agent
  const { plan } = req.body;
  const PLAN_MAP = { moto: 'essentiel', ndeko: 'standard', libota: 'premium' };
  const planEnum = plan ? (PLAN_MAP[String(plan).toLowerCase()] || String(plan).toLowerCase()) : null;

  if (planEnum && ['essentiel', 'standard', 'premium'].includes(planEnum)) {
    try {
      const cfg = await pool.query(
        `SELECT config_value FROM platform_config WHERE config_key = $1`,
        [`price_${planEnum}`]
      );
      if (cfg.rows.length) {
        const amount = parseInt(cfg.rows[0].config_value, 10);
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);
        const patientPhone = captured.body.data.phone;

        await pool.query(
          `INSERT INTO subscriptions (patient_phone, plan, status, amount_fcfa, started_at, expires_at, payment_reference)
           VALUES ($1, $2, 'active', $3, NOW(), $4, $5)`,
          [patientPhone, planEnum, amount, expires, `AGENT-${normalizePhone(req.user.phone)}-${Date.now()}`]
        );
        await pool.query(`UPDATE users SET statut_abonnement = 'actif' WHERE phone = $1`, [patientPhone]);
        captured.body.data.plan = planEnum;
        captured.body.data.abonnement_actif = true;
      }
    } catch (subErr) {
      console.error('[AGENT inscrire-patient] Erreur abonnement:', subErr.message);
      // Non bloquant : le patient est inscrit même si l'abonnement échoue
    }
  }

  res.status(captured.status).json(captured.body);
});

// ─── POST /inscrire-partenaire — pharmacie / laboratoire / clinique (médecin) ─
router.post('/inscrire-partenaire', authMiddleware, requireAgent, async (req, res) => {
  const { type } = req.body;
  const handlers = {
    pharmacie: registerPharmacie,
    laboratoire: registerLaboratoire,
    clinique: registerDoctor // Pas de table "cliniques" dédiée — mappé sur doctors (cf. anomalies)
  };

  const handler = handlers[type];
  if (!handler) {
    return res.status(400).json({ success: false, message: 'Type invalide. Attendu : pharmacie, laboratoire ou clinique' });
  }

  return handler(req, res);
});

// ─── GET /mes-inscrits — liste paginée des inscrits par cet agent ────────────
router.get('/mes-inscrits', authMiddleware, requireAgent, async (req, res) => {
  try {
    const agentPhone = normalizePhone(req.user.phone);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM (
         SELECT phone, full_name AS nom, 'patient' AS role, created_at FROM users
           WHERE agent_phone = $1 AND role = 'patient'
         UNION ALL
         SELECT phone, full_name AS nom, 'doctor' AS role, created_at FROM doctors WHERE agent_phone = $1
         UNION ALL
         SELECT phone, name AS nom, 'pharmacie' AS role, created_at FROM pharmacies WHERE agent_phone = $1
         UNION ALL
         SELECT phone, name AS nom, 'laboratoire' AS role, created_at FROM laboratories WHERE agent_phone = $1
       ) inscrits
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentPhone, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT (
         (SELECT COUNT(*) FROM users WHERE agent_phone = $1 AND role = 'patient')
         + (SELECT COUNT(*) FROM doctors WHERE agent_phone = $1)
         + (SELECT COUNT(*) FROM pharmacies WHERE agent_phone = $1)
         + (SELECT COUNT(*) FROM laboratories WHERE agent_phone = $1)
       ) AS total`,
      [agentPhone]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].total, 10) }
    });
  } catch (err) {
    console.error('[AGENT MES-INSCRITS]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
