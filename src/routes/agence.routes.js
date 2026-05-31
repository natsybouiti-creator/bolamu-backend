// ============================================================
// BOLAMU — Routes Agent Bolamu (Réseau national)
// ============================================================
const express = require('express');
const router  = express.Router();
const pool     = require('../config/db');
const bcrypt   = require('bcrypt');
const jwt       = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';

// Libellés commerciaux -> plan réel (enum subscription_plan)
const PLAN_MAP = { moto: 'essentiel', ndeko: 'standard', libota: 'premium' };

// Middleware : agent Bolamu uniquement
const requireAgent = [authMiddleware, (req, res, next) => {
  if (!req.user || req.user.role !== 'agent_bolamu') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux agents Bolamu' });
  }
  next();
}];

// ─── POST /login ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis' });
    }
    const result = await pool.query(
      `SELECT id, full_name, phone, password_hash, role
       FROM users WHERE phone = $1 AND role = 'agent_bolamu' AND is_active = true`,
      [phone]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Compte agent introuvable' });
    }
    const user  = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ success: true, token, agent: { id: user.id, full_name: user.full_name, phone: user.phone } });
  } catch (err) {
    console.error('[AGENCE LOGIN]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /stats-globales ─────────────────────────────────────────────────────
router.get('/stats-globales', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'patient' AND is_active = true) AS total_abonnes,
        (SELECT COUNT(DISTINCT patient_phone) FROM subscriptions
           WHERE status = 'active' AND expires_at >= NOW()) AS abonnes_actifs,
        (
          (SELECT COUNT(*) FROM pharmacies WHERE is_active = true)
          + (SELECT COUNT(*) FROM laboratories WHERE is_active = true)
          + (SELECT COUNT(*) FROM doctors WHERE is_active = true)
        ) AS partenaires_actifs,
        (SELECT COUNT(*) FROM appointments
           WHERE appointment_date = CURRENT_DATE
           AND status NOT IN ('annule','refuse')) AS rdv_aujourd_hui
    `);
    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    console.error('[AGENCE STATS]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /verifier-adherent?q= ───────────────────────────────────────────────
router.get('/verifier-adherent', requireAgent, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.status(400).json({ success: false, message: 'Requête trop courte' });
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone,
              s.plan AS plan_nom,
              s.amount_fcfa AS plan_prix,
              s.expires_at AS date_fin,
              CASE
                WHEN s.id IS NOT NULL THEN 'actif'
                WHEN EXISTS (
                  SELECT 1 FROM payments p
                  WHERE p.patient_phone = u.phone AND p.status = 'pending' AND p.plan IS NOT NULL
                ) THEN 'en_attente'
                ELSE 'inactif'
              END AS statut_abonnement
       FROM users u
       LEFT JOIN subscriptions s ON s.patient_phone = u.phone
         AND s.status = 'active' AND s.is_active = TRUE AND s.expires_at >= NOW()
       WHERE u.role = 'patient' AND u.is_active = true
         AND (u.phone ILIKE $1 OR u.full_name ILIKE $1)
       ORDER BY s.expires_at DESC NULLS LAST
       LIMIT 1`,
      [`%${q}%`]
    );
    res.json({ success: true, patient: result.rows[0] || null });
  } catch (err) {
    console.error('[AGENCE VERIFIER]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /client?phone= ──────────────────────────────────────────────────────
router.get('/client', requireAgent, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Numéro requis' });
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.statut_abonnement,
              s.plan, s.expires_at, s.status AS sub_status
       FROM users u
       LEFT JOIN subscriptions s ON s.patient_phone = u.phone
         AND s.status = 'active' AND s.expires_at >= NOW()
       WHERE u.phone = $1 AND u.role = 'patient'
       LIMIT 1`,
      [phone]
    );
    res.json({ success: true, client: result.rows[0] || null });
  } catch (err) {
    console.error('[AGENCE CLIENT]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /souscrire ─────────────────────────────────────────────────────────
// Prix lus depuis platform_config (Règle 14). Plan stocké en enum essentiel/standard/premium.
router.post('/souscrire', requireAgent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { patient_phone, plan, payment_mode, nom, prenom } = req.body;
    if (!patient_phone || !plan) {
      return res.status(400).json({ success: false, message: 'patient_phone et plan requis' });
    }
    const planEnum = PLAN_MAP[String(plan).toLowerCase()] || String(plan).toLowerCase();
    if (!['essentiel', 'standard', 'premium'].includes(planEnum)) {
      return res.status(400).json({ success: false, message: 'Plan invalide' });
    }

    // Prix depuis platform_config (jamais hardcodé)
    const cfg = await client.query(
      `SELECT config_value FROM platform_config WHERE config_key = $1`,
      [`price_${planEnum}`]
    );
    if (!cfg.rows.length) {
      return res.status(400).json({ success: false, message: 'Tarif introuvable dans platform_config' });
    }
    const amount = parseInt(cfg.rows[0].config_value, 10);

    await client.query('BEGIN');

    // Créer le patient s'il n'existe pas (member_code via MAX+1)
    const existing = await client.query(
      `SELECT phone FROM users WHERE phone = $1`,
      [patient_phone]
    );
    if (!existing.rows.length) {
      const codeRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
         FROM users WHERE member_code ~ '^BLM-[0-9]+$'`
      );
      const memberCode = `BLM-${String(codeRes.rows[0].next).padStart(5, '0')}`;
      const fullName = `${prenom || ''} ${nom || ''}`.trim() || patient_phone;
      await client.query(
        `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, statut_abonnement, member_code)
         VALUES ($1, $2, $3, $4, 'patient', true, 'en_attente', $5)`,
        [patient_phone, fullName, prenom || null, nom || null, memberCode]
      );
    }

    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);

    const sub = await client.query(
      `INSERT INTO subscriptions (patient_phone, plan, status, amount_fcfa, started_at, expires_at, payment_reference)
       VALUES ($1, $2, 'active', $3, NOW(), $4, $5)
       RETURNING id`,
      [patient_phone, planEnum, amount, expires, `AGENT-${(payment_mode || 'especes').toUpperCase()}-${Date.now()}`]
    );

    await client.query(
      `UPDATE users SET statut_abonnement = 'actif' WHERE phone = $1`,
      [patient_phone]
    );

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.souscription', $1, 'subscriptions', $2, $3::jsonb)`,
      [req.user.phone, sub.rows[0].id, JSON.stringify({ patient_phone, plan: planEnum, amount, payment_mode: payment_mode || 'especes' })]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      subscription_id: sub.rows[0].id,
      plan: planEnum,
      amount_fcfa: amount,
      expires_at: expires.toISOString().split('T')[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AGENCE SOUSCRIRE]', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ─── GET /partenaires?ville=&type=&q= ────────────────────────────────────────
// Réseau complet : cliniques + pharmacies + laboratoires (tables distinctes)
router.get('/partenaires', requireAgent, async (req, res) => {
  try {
    const { ville, type, q } = req.query;
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;
    if (ville) { conditions.push(`p.city ILIKE $${idx++}`); params.push(`%${ville}%`); }
    if (type)  { conditions.push(`p.type = $${idx++}`); params.push(String(type).toLowerCase()); }
    if (q)     { conditions.push(`(p.name ILIKE $${idx} OR p.address ILIKE $${idx})`); params.push(`%${q}%`); idx++; }

    const result = await pool.query(
      `WITH partenaires AS (
         SELECT id, name, 'clinique'    AS type, city, address, phone, TRUE      AS is_active FROM clinics
         UNION ALL
         SELECT id, name, 'pharmacie'   AS type, city, address, phone, is_active           FROM pharmacies
         UNION ALL
         SELECT id, name, 'laboratoire' AS type, city, address, phone, is_active           FROM laboratories
       )
       SELECT p.id, p.name, p.type, p.city, p.address, p.phone, p.is_active
       FROM partenaires p
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.city, p.name`,
      params
    );
    res.json({ success: true, partenaires: result.rows });
  } catch (err) {
    console.error('[AGENCE PARTENAIRES]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /medecins?ville= ────────────────────────────────────────────────────
router.get('/medecins', requireAgent, async (req, res) => {
  try {
    const { ville } = req.query;
    let query = `
      SELECT d.id, d.full_name, d.specialty, d.is_active,
             c.name AS clinic_name, c.city, c.address
      FROM doctors d
      JOIN clinics c ON c.id = d.clinic_id
      WHERE d.is_active = true
    `;
    const params = [];
    if (ville) { query += ` AND c.city ILIKE $1`; params.push(`%${ville}%`); }
    query += ` ORDER BY c.city, d.full_name`;
    const result = await pool.query(query, params);
    res.json({ success: true, medecins: result.rows });
  } catch (err) {
    console.error('[AGENCE MEDECINS]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /rdv ───────────────────────────────────────────────────────────────
router.post('/rdv', requireAgent, async (req, res) => {
  try {
    const { patient_phone, doctor_id, date, time, motif } = req.body;
    if (!patient_phone || !doctor_id || !date || !time) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }
    const existing = await pool.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3
       AND status NOT IN ('annule','refuse')`,
      [doctor_id, date, time]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Ce créneau est déjà réservé' });
    }
    const result = await pool.query(
      `INSERT INTO appointments
        (patient_phone, doctor_id, appointment_date, appointment_time, status, motif, is_urgent, created_by)
       VALUES ($1, $2, $3, $4, 'confirme', $5, false, 'agent_bolamu')
       RETURNING id`,
      [patient_phone, doctor_id, date, time, motif || null]
    );
    res.json({ success: true, appointment_id: result.rows[0].id });
  } catch (err) {
    console.error('[AGENCE RDV]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
