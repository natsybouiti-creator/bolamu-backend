// ============================================================
// BOLAMU — Routes Agent Bolamu (Réseau national)
// ============================================================
const express = require('express');
const router  = express.Router();
const pool     = require('../config/db');
const bcrypt   = require('bcrypt');
const jwt       = require('jsonwebtoken');
const { normalizePhone } = require('../utils/phone');
const authMiddleware = require('../middleware/auth.middleware');
const crypto = require('crypto');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { sendOnboardingLink } = require('../utils/sendOnboardingLink');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;

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
      `SELECT id, full_name, phone, password_hash, role, company_id
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
      { id: user.id, phone: user.phone, role: user.role, company_id: user.company_id || null },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ success: true, token, agent: { id: user.id, full_name: user.full_name, phone: user.phone, company_id: user.company_id || null } });
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
    const phone = normalizePhone(req.query.phone || '');
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

// ─── GET /plans-config ───────────────────────────────────────────────────────
// Retourne la configuration des plans (prix, membres, description)
router.get('/plans-config', requireAgent, async (req, res) => {
  try {
    const plans = [];
    const planKeys = ['essentiel', 'standard', 'premium'];
    const planNames = { essentiel: 'MOTO', standard: 'NDEKO', premium: 'LIBOTA' };
    const planMembers = { essentiel: 1, standard: 4, premium: 8 };
    const planDescs = {
      essentiel: 'Couverture de base pour une personne',
      standard: 'Pour la famille jusqu\'à 4 personnes',
      premium: 'Famille élargie jusqu\'à 8 personnes'
    };

    for (const key of planKeys) {
      const cfg = await pool.query(
        `SELECT config_value FROM platform_config WHERE config_key = $1`,
        [`price_${key}`]
      );
      if (cfg.rows.length) {
        plans.push({
          id: key,
          name: planNames[key],
          price: parseInt(cfg.rows[0].config_value, 10),
          members: planMembers[key],
          description: planDescs[key]
        });
      }
    }

    res.json({ success: true, plans });
  } catch (err) {
    console.error('[AGENCE PLANS CONFIG]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /souscrire-complet ───────────────────────────────────────────────────
// Version complète du wizard : identité + documents + formule + paiement
router.post('/souscrire-complet', requireAgent, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      phone, nom, prenom, dob, genre, ville, adresse,
      docType, docNumero, niu, rib, email,
      plan, cguAcceptedAt, payment_mode, momo_number, virement_ref, created_by,
      canal, proche_number, photoData
    } = req.body;

    if (!phone || !nom || !prenom || !dob || !genre || !ville || !plan) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const planEnum = PLAN_MAP[String(plan).toLowerCase()] || String(plan).toLowerCase();
    if (!['essentiel', 'standard', 'premium'].includes(planEnum)) {
      return res.status(400).json({ success: false, message: 'Plan invalide' });
    }

    // Prix depuis platform_config
    const cfg = await client.query(
      `SELECT config_value FROM platform_config WHERE config_key = $1`,
      [`price_${planEnum}`]
    );
    if (!cfg.rows.length) {
      return res.status(400).json({ success: false, message: 'Tarif introuvable dans platform_config' });
    }
    const amount = parseInt(cfg.rows[0].config_value, 10);

    await client.query('BEGIN');

    // Générer mot de passe temporaire
    const tempPassword = crypto.randomBytes(6).toString('hex').toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Upload photo sur Cloudinary si fournie
    let photoUrl = null;
    if (photoData) {
      try {
        const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const uploadResult = await uploadToCloudinary(buffer, 'bolamu/photos', {
          public_id: `patient_${phone}_${Date.now()}`,
          transformation: { width: 400, height: 400, crop: 'fill' }
        });
        photoUrl = uploadResult.secure_url;
      } catch (photoErr) {
        console.error('[CLOUDINARY UPLOAD]', photoErr.message);
        // Ne pas bloquer l'inscription si l'upload échoue
      }
    }

    // Créer ou mettre à jour le patient
    const existing = await client.query(
      `SELECT phone, member_code FROM users WHERE phone = $1`,
      [phone]
    );

    let memberCode;
    if (!existing.rows.length) {
      // Nouveau patient : générer member_code via MAX+1
      const codeRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
         FROM users WHERE member_code ~ '^BLM-[0-9]+$'`
      );
      memberCode = `BLM-${String(codeRes.rows[0].next).padStart(5, '0')}`;
      const fullName = `${prenom} ${nom}`.trim();

      await client.query(
        `INSERT INTO users
          (phone, full_name, first_name, last_name, date_of_birth, gender, city, address,
           role, is_active, statut_abonnement, member_code,
           doc_type, doc_numero, niu, rib, email, cgu_accepted_at, created_by, created_at, updated_at,
           password_hash, photo_url, temp_password_must_change, proche_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'patient', true, 'en_attente', $9,
          $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(),
          $17, $18, true, $19)`,
        [phone, fullName, prenom, nom, dob, genre, ville, adresse || null,
         memberCode, docType || null, docNumero || null, niu || null, rib || null, email || null,
         cguAcceptedAt || null, created_by || null, hashedPassword, photoUrl, proche_number || null]
      );
    } else {
      // Patient existant : mettre à jour les informations
      memberCode = existing.rows[0].member_code;
      const fullName = `${prenom} ${nom}`.trim();

      await client.query(
        `UPDATE users SET
          full_name = $1, first_name = $2, last_name = $3, date_of_birth = $4, gender = $5,
          city = $6, address = $7, doc_type = $8, doc_numero = $9, niu = $10, rib = $11, email = $12,
          password_hash = $13, photo_url = COALESCE($14, users.photo_url), temp_password_must_change = true,
          proche_number = $15, updated_at = NOW()
         WHERE phone = $16`,
        [fullName, prenom, nom, dob, genre, ville, adresse || null,
         docType || null, docNumero || null, niu || null, rib || null, email || null,
         hashedPassword, photoUrl, proche_number || null, phone]
      );
    }

    // Créer l'abonnement
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);

    const paymentRef = `AGENT-${(payment_mode || 'especes').toUpperCase()}-${Date.now()}`;
    if (momo_number) paymentRef += `-${momo_number}`;
    if (virement_ref) paymentRef += `-${virement_ref}`;

    const sub = await client.query(
      `INSERT INTO subscriptions (patient_phone, plan, status, amount_fcfa, started_at, expires_at, payment_reference)
       VALUES ($1, $2, 'active', $3, NOW(), $4, $5)
       RETURNING id`,
      [phone, planEnum, amount, expires, paymentRef]
    );

    // Mettre à jour le statut du patient
    await client.query(
      `UPDATE users SET statut_abonnement = 'actif' WHERE phone = $1`,
      [phone]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.souscription_complete', $1, 'subscriptions', $2, $3::jsonb)`,
      [req.user.phone, sub.rows[0].id, JSON.stringify({
        patient_phone: phone,
        plan: planEnum,
        amount,
        payment_mode,
        momo_number,
        virement_ref,
        created_by,
        canal,
        proche_number
      })]
    );

    await client.query('COMMIT');

    // Envoyer bienvenue + magic link par WhatsApp
    try {
      await sendAutoMessage(phone, 'bolamu_bienvenue_patient_v4', [`${prenom} ${nom}`.trim()]);
    } catch (whatsappError) {
      console.warn('[WhatsApp] Envoi bienvenue échoué (non bloquant)', { phone, error: whatsappError.message });
    }
    await sendOnboardingLink(phone, `${prenom} ${nom}`.trim(), 'patient');
    res.json({
      success: true,
      subscription_id: sub.rows[0].id,
      plan: planEnum,
      amount_fcfa: amount,
      expires_at: expires.toISOString().split('T')[0],
      member_code: memberCode,
      temp_password: tempPassword,
      canal: canal || null,
      proche_number: proche_number || null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AGENCE SOUSCRIRE COMPLET]', err.message);
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

// ─── POST /import-employes ───────────────────────────────────────────────────────
// Import en masse d'employés pour Smart Flow (création comptes + abonnements)
router.post('/import-employes', requireAgent, async (req, res) => {
  const client = await pool.connect();
  try {
    const { employes, company_contract_id } = req.body;

    if (!Array.isArray(employes) || employes.length === 0) {
      return res.status(400).json({ success: false, message: 'employes doit être un tableau non vide' });
    }

    // Prix depuis platform_config
    const planPrices = {};
    for (const planKey of ['essentiel', 'standard', 'premium']) {
      const cfg = await client.query(
        `SELECT config_value FROM platform_config WHERE config_key = $1`,
        [`price_${planKey}`]
      );
      if (cfg.rows.length) {
        planPrices[planKey] = parseInt(cfg.rows[0].config_value, 10);
      }
    }

    await client.query('BEGIN');

    const results = [];
    const errors = [];

    for (const emp of employes) {
      const { nom, prenom, phone, categorie_rh, plan, payment_method, company_id: emp_company_id } = emp;
      // company_contract_id peut venir du corps de la requête (niveau lot) ou de chaque employé
      const contractId = company_contract_id || null;
      const companyId = emp_company_id || req.user.company_id || null;

      if (!nom || !prenom || !phone || !plan || !payment_method) {
        errors.push({ phone, error: 'Champs manquants' });
        continue;
      }

      const planEnum = PLAN_MAP[String(plan).toLowerCase()] || String(plan).toLowerCase();
      if (!['essentiel', 'standard', 'premium'].includes(planEnum)) {
        errors.push({ phone, error: 'Plan invalide' });
        continue;
      }

      const amount = planPrices[planEnum];
      if (!amount) {
        errors.push({ phone, error: 'Tarif introuvable pour le plan' });
        continue;
      }

      try {
        // Vérifier si l'utilisateur existe déjà
        const existing = await client.query(
          `SELECT phone, member_code FROM users WHERE phone = $1`,
          [phone]
        );

        let memberCode;
        if (!existing.rows.length) {
          // Nouveau patient : générer member_code via MAX+1
          const codeRes = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
             FROM users WHERE member_code ~ '^BLM-[0-9]+$'`
          );
          memberCode = `BLM-${String(codeRes.rows[0].next).padStart(5, '0')}`;
          const fullName = `${prenom} ${nom}`.trim();

          // Générer mot de passe temporaire
          const tempPassword = crypto.randomBytes(6).toString('hex').toUpperCase();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);

          await client.query(
            `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, statut_abonnement, member_code, password_hash, temp_password_must_change)
             VALUES ($1, $2, $3, $4, 'patient', true, 'en_attente', $5, $6, true)`,
            [phone, fullName, prenom, nom, memberCode, hashedPassword]
          );
        } else {
          memberCode = existing.rows[0].member_code;
        }

        // Créer l'abonnement
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);

        const paymentRef = `AGENT-IMPORT-${payment_method.toUpperCase()}-${Date.now()}-${phone}`;

        const sub = await client.query(
          `INSERT INTO subscriptions (patient_phone, plan, status, amount_fcfa, started_at, expires_at, payment_reference)
           VALUES ($1, $2, 'active', $3, NOW(), $4, $5)
           RETURNING id`,
          [phone, planEnum, amount, expires, paymentRef]
        );

        // Mettre à jour le statut du patient
        await client.query(
          `UPDATE users SET statut_abonnement = 'actif' WHERE phone = $1`,
          [phone]
        );

        // Lier l'employé à l'entreprise si company_contract_id fourni
        if (contractId) {
          await client.query(
            `INSERT INTO company_employees
               (company_contract_id, company_id, patient_phone, subscription_id, categorie_rh, enrolled_at, enrolled_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)
             ON CONFLICT (company_contract_id, patient_phone) DO UPDATE
               SET subscription_id = EXCLUDED.subscription_id, updated_at = NOW()`,
            [contractId, companyId, phone, sub.rows[0].id, categorie_rh || null, req.user.phone]
          );
        }

        // Audit log
        await client.query(
          `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('agent.import_employe', $1, 'subscriptions', $2, $3::jsonb)`,
          [req.user.phone, sub.rows[0].id, JSON.stringify({ patient_phone: phone, plan: planEnum, amount, payment_method, company_contract_id: contractId })]
        );

        results.push({
          phone,
          nom,
          prenom,
          plan: planEnum,
          subscription_id: sub.rows[0].id,
          member_code: memberCode,
          company_contract_id: contractId || undefined
        });
      } catch (empErr) {
        await client.query('ROLLBACK');
        console.error('[AGENCE IMPORT EMPLOYE]', empErr.message);
        return res.status(500).json({ success: false, message: `Erreur pour ${phone}: ${empErr.message}` });
      }
    }

    await client.query('COMMIT');

    // Envoyer les magic links de première connexion (non bloquant)
    for (const r of results) {
      await sendOnboardingLink(r.phone, `${r.prenom} ${r.nom}`.trim(), 'patient');
    }

    res.json({
      success: true,
      imported: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AGENCE IMPORT EMPLOYES]', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ─── RÉCLAMATIONS ────────────────────────────────────────────────────────────

// Réactiver un abonnement expiré ou suspendu
router.post('/reclamation/reactiver', requireAgent, async (req, res) => {
  const { patient_phone, raison } = req.body;
  if (!patient_phone) return res.status(400).json({ success: false, message: 'patient_phone requis.' });
  const phone = normalizePhone(patient_phone);
  try {
    const userRes = await pool.query(`SELECT id, phone, full_name, is_active FROM users WHERE phone = $1`, [phone]);
    if (!userRes.rows.length) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    const userId = userRes.rows[0].id;

    await pool.query(`UPDATE users SET is_active = TRUE WHERE phone = $1`, [phone]);

    // Réactiver le dernier abonnement expiré s'il en existe un récent (< 30 jours)
    await pool.query(
      `UPDATE subscriptions SET is_active = TRUE, status = 'active',
          expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
       WHERE patient_phone = $1
         AND id = (SELECT id FROM subscriptions WHERE patient_phone = $1
                   ORDER BY expires_at DESC LIMIT 1)`,
      [phone]
    );

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.reclamation_reactivation', $1, 'users', $2, $3::jsonb)`,
      [req.user.phone, userId, JSON.stringify({ patient_phone: phone, raison: raison || 'reactivation_agent' })]
    );

    res.json({ success: true, message: `Compte ${phone} réactivé avec succès.` });
  } catch (err) {
    console.error('[AGENCE RECLAMATION REACTIVER]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Changer la formule d'abonnement d'un adhérent
router.post('/reclamation/changer-formule', requireAgent, async (req, res) => {
  const { patient_phone, nouveau_plan, raison } = req.body;
  if (!patient_phone || !nouveau_plan) {
    return res.status(400).json({ success: false, message: 'patient_phone et nouveau_plan requis.' });
  }
  const planEnum = PLAN_MAP[String(nouveau_plan).toLowerCase()] || String(nouveau_plan).toLowerCase();
  if (!['essentiel', 'standard', 'premium'].includes(planEnum)) {
    return res.status(400).json({ success: false, message: 'Plan invalide. Valeurs : essentiel, standard, premium (ou moto, ndeko, libota).' });
  }
  const phone = normalizePhone(patient_phone);
  try {
    const cfgRes = await pool.query(`SELECT config_value FROM platform_config WHERE config_key = $1`, [`price_${planEnum}`]);
    const amount = cfgRes.rows.length ? parseInt(cfgRes.rows[0].config_value, 10) : null;

    const subRes = await pool.query(
      `UPDATE subscriptions SET plan = $1, amount_fcfa = $2, updated_at = NOW()
       WHERE patient_phone = $3 AND is_active = TRUE RETURNING id`,
      [planEnum, amount, phone]
    );
    const subId = subRes.rows[0]?.id || null;

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.reclamation_changement_plan', $1, 'subscriptions', $2, $3::jsonb)`,
      [req.user.phone, subId, JSON.stringify({ patient_phone: phone, nouveau_plan: planEnum, raison: raison || '' })]
    );

    res.json({ success: true, message: `Formule mise à jour vers ${planEnum} pour ${phone}.` });
  } catch (err) {
    console.error('[AGENCE RECLAMATION CHANGER FORMULE]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Corriger les informations d'un adhérent (nom, prénom, date de naissance)
router.post('/reclamation/corriger', requireAgent, async (req, res) => {
  const { patient_phone, corrections, raison } = req.body;
  if (!patient_phone || !corrections || typeof corrections !== 'object') {
    return res.status(400).json({ success: false, message: 'patient_phone et corrections (objet) requis.' });
  }
  const phone = normalizePhone(patient_phone);

  // Colonnes autorisées à corriger par un agent
  const COLONNES_AUTORISEES = ['first_name', 'last_name', 'full_name', 'birth_date', 'email'];
  const champs = Object.keys(corrections).filter(k => COLONNES_AUTORISEES.includes(k));
  if (!champs.length) {
    return res.status(400).json({ success: false, message: `Colonnes autorisées : ${COLONNES_AUTORISEES.join(', ')}.` });
  }

  try {
    const userIdRes = await pool.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
    if (!userIdRes.rows.length) return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    const userId = userIdRes.rows[0].id;

    const sets = champs.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const vals = champs.map(col => corrections[col]);
    await pool.query(`UPDATE users SET ${sets} WHERE phone = $1`, [phone, ...vals]);

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.reclamation_correction', $1, 'users', $2, $3::jsonb)`,
      [req.user.phone, userId, JSON.stringify({ patient_phone: phone, champs_corriges: corrections, raison: raison || '' })]
    );

    res.json({ success: true, message: `Informations corrigées pour ${phone}.`, champs_mis_a_jour: champs });
  } catch (err) {
    console.error('[AGENCE RECLAMATION CORRIGER]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Signaler un problème (log + notification admin)
router.post('/reclamation/signaler', requireAgent, async (req, res) => {
  const { patient_phone, description } = req.body;
  if (!patient_phone || !description) {
    return res.status(400).json({ success: false, message: 'patient_phone et description requis.' });
  }
  const phone = normalizePhone(patient_phone);
  try {
    const sigUserRes = await pool.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
    const sigUserId = sigUserRes.rows[0]?.id || null;

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('agent.reclamation_signalement', $1, 'users', $2, $3::jsonb)`,
      [req.user.phone, sigUserId, JSON.stringify({ patient_phone: phone, description, agent: req.user.phone })]
    );

    res.json({ success: true, message: 'Signalement enregistré. Un administrateur va traiter votre demande.' });
  } catch (err) {
    console.error('[AGENCE RECLAMATION SIGNALER]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
