// ============================================================
// BOLAMU — Contrôleur Patients (Complet)
// ============================================================
const pool = require('../config/db');
const { sendAutoMessage } = require('../services/whatsapp-web.service');
const bcrypt = require('bcrypt');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');

// ─── INSCRIPTION PATIENT ──────────────────────────────────────────────────────
async function registerPatient(req, res) {
    const { phone: rawPhone, full_name, birth_date, gender, city, momo_number, cgu_accepted } = req.body;
    const phone = normalizePhone(rawPhone || '');

    if (!phone || !full_name) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, full_name' });
    }

    if (!/^\+242[0-9]{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Ce numéro est déjà enregistré.' });
        }

        const idRes = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 1000) + 1 AS next
             FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
        );
        const bolamuId = `BLM-${idRes.rows[0].next}`;

        const newUser = await client.query(
            `INSERT INTO users
                (phone, full_name, birth_date, gender, role, bolamu_id, is_active,
                 momo_number, cgu_accepted, cgu_accepted_at, onboarding_completed, created_at)
             VALUES ($1,$2,$3,$4,'patient',$5,TRUE,$6,$7,NOW(),TRUE,NOW())
             RETURNING id, phone, full_name, bolamu_id, created_at`,
            [
                phone, full_name, birth_date || null, gender || null,
                bolamuId, momo_number || phone,
                cgu_accepted === 'true' || cgu_accepted === true
            ]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('patient.registered', $1, 'users', $2, $3::jsonb)`,
            [phone, newUser.rows[0].id, JSON.stringify({ full_name, bolamu_id: bolamuId })]
        ).catch((err) => logger.error('[patient.registered] Audit log error:', err.message));

        await client.query('COMMIT');

        try {
            await sendAutoMessage(phone, 'bolamu_inscription_patient_id', [full_name, bolamuId]);
        } catch (e) { console.log('WhatsApp non envoyé'); }

        return res.status(201).json({
            success: true,
            message: 'Inscription réussie !',
            data: {
                bolamu_id: bolamuId,
                full_name: newUser.rows[0].full_name,
                phone: newUser.rows[0].phone,
                auto_validated: true,
                trust_score: 85,
                member_code: bolamuId
            }
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[registerPatient]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

// ─── ABONNEMENT ACTIF ─────────────────────────────────────────────────────────
async function getSubscription(req, res) {
    const phone = normalizePhone(req.user?.phone || req.query.phone || '');
    if (!phone) return res.status(400).json({ success: false, message: 'Paramètre phone manquant.' });

    try {
        const result = await pool.query(
            `SELECT plan, amount_fcfa, status, started_at, expires_at, next_billing_date
             FROM subscriptions
             WHERE patient_phone = $1 AND status = 'active' AND is_active = TRUE AND expires_at > NOW()
             ORDER BY started_at DESC LIMIT 1`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Aucun abonnement actif trouvé.' });
        }

        return res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('[getSubscription]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── CRÉER UN ABONNEMENT (POST /api/v1/patients/subscription) ─────────────────────
async function createSubscription(req, res) {
    const { phone } = req.user;
    const { plan } = req.body;

    if (!plan) {
        return res.status(400).json({ success: false, message: 'Plan requis (Bronze, Silver, Gold).' });
    }

    if (!['Bronze', 'Silver', 'Gold'].includes(plan)) {
        return res.status(400).json({ success: false, message: 'Plan invalide. Options : Bronze, Silver, Gold.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Récupérer le montant depuis platform_config
        const configRes = await client.query(
            `SELECT config_value FROM platform_config WHERE config_key = $1`,
            [`price_${plan.toLowerCase()}`]
        );
        if (!configRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Plan invalide ou configuration manquante.' });
        }
        const amount = parseInt(configRes.rows[0].config_value);

        // Désactiver les anciens abonnements
        await client.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE`,
            [phone]
        );

        // Créer le nouvel abonnement
        const subRes = await client.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', TRUE)
             RETURNING id, plan, expires_at`,
            [phone, plan, amount]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('subscription.created', $1, 'subscriptions', $2, $3::jsonb)`,
            [phone, subRes.rows[0].id, JSON.stringify({ plan, amount })]
        ).catch((err) => logger.error('[subscription.created] Audit log error:', err.message));

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Abonnement créé avec succès',
            data: {
                subscription_id: subRes.rows[0].id,
                plan: subRes.rows[0].plan,
                expires_at: subRes.rows[0].expires_at,
                amount_fcfa: amount
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[createSubscription]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── MODIFIER MOT DE PASSE (PATCH /api/v1/patients/password) ───────────────────────
async function changePassword(req, res) {
    const { phone } = req.user;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
        return res.status(400).json({ success: false, message: 'Ancien et nouveau mot de passe requis.' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Vérifier l'ancien mot de passe
        const userRes = await client.query(
            `SELECT password_hash FROM users WHERE phone = $1`,
            [phone]
        );
        if (!userRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Compte introuvable.' });
        }

        const valid = await bcrypt.compare(old_password, userRes.rows[0].password_hash);
        if (!valid) {
            await client.query('ROLLBACK');
            return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect.' });
        }

        // Hasher le nouveau mot de passe
        const newHash = await bcrypt.hash(new_password, 10);

        // Mettre à jour
        await client.query(
            `UPDATE users SET password_hash = $1 WHERE phone = $2`,
            [newHash, phone]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('password_changed', $1, 'users', NULL, $2::jsonb)`,
            [phone, JSON.stringify({ timestamp: new Date().toISOString() })]
        ).catch((err) => logger.error('[password_changed] Audit log error:', err.message));

        await client.query('COMMIT');

        return res.json({ success: true, message: 'Mot de passe modifié avec succès.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[changePassword]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

module.exports = { registerPatient, getSubscription, createSubscription, changePassword };