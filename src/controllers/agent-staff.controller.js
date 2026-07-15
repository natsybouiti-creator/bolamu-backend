// ============================================================
// BOLAMU — Contrôleur création de comptes staff par l'agent
// (animateur, rh, secretaire, partenaire_commercial)
// Comptes actifs immédiatement (is_active=true), pas de validation
// admin différée — à la différence du flux inscrire-partenaire
// existant (pharmacie/laboratoire/clinique). Connexion via lien
// magique sendOnboardingLink(), sauf partenaire_commercial qui a
// un système de connexion séparé (POST /api/v1/partenaire/login,
// phone+password) ne supportant pas le lien magique.
// ============================================================

const pool = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { sendOnboardingLink } = require('../utils/sendOnboardingLink');

function isValidPhone(phone) {
    return /^\+242[0-9]{9}$/.test(phone);
}

// ─── ANIMATEUR ──────────────────────────────────────────────────────────────
async function registerAnimateur(req, res) {
    const { phone, full_name, city, specialite } = req.body;
    const normalizedPhone = normalizePhone(phone || '');

    if (!normalizedPhone || !full_name || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, full_name, city' });
    }
    if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    let animateurId;
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec ce numéro.' });
        }

        const agentPhone = normalizePhone(req.user.phone);

        await client.query(
            `INSERT INTO users (phone, full_name, role, city, is_active, agent_phone) VALUES ($1,$2,'animateur',$3,TRUE,$4)`,
            [normalizedPhone, full_name, city, agentPhone]
        );

        const newAnimateur = await client.query(
            `INSERT INTO animateurs (phone, full_name, specialite, is_active) VALUES ($1,$2,$3,TRUE) RETURNING id`,
            [normalizedPhone, full_name, specialite || null]
        );
        animateurId = newAnimateur.rows[0].id;

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('animateur_cree', $1, 'animateurs', $2, $3::jsonb)`,
            [agentPhone, animateurId, JSON.stringify({ phone: normalizedPhone, full_name, city })]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerAnimateur]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }

    try {
        await sendAutoMessage(normalizedPhone, 'bolamu_notification_fallback', [
            `Bienvenue sur Bolamu, ${full_name} ! Votre compte animateur a été créé.`
        ]);
        await sendOnboardingLink(normalizedPhone, full_name, 'animateur');
    } catch (e) {
        console.error('[registerAnimateur] notification non envoyée (non bloquant):', e.message);
    }

    return res.status(201).json({
        success: true,
        message: 'Compte animateur créé. Lien de connexion envoyé par WhatsApp.',
        data: { phone: normalizedPhone, full_name, role: 'animateur' }
    });
}

// ─── RH ──────────────────────────────────────────────────────────────────────
async function registerRH(req, res) {
    const { phone, full_name, contract_id } = req.body;
    const normalizedPhone = normalizePhone(phone || '');

    if (!normalizedPhone || !full_name) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, full_name' });
    }
    if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }
    if (!contract_id) {
        return res.status(400).json({ success: false, message: 'Le RH doit être rattaché à un contrat entreprise existant.' });
    }

    const client = await pool.connect();
    let userId;
    let companyName;
    try {
        await client.query('BEGIN');

        const contract = await client.query('SELECT id, company_name FROM company_contracts WHERE id = $1', [contract_id]);
        if (contract.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Contrat entreprise introuvable.' });
        }
        companyName = contract.rows[0].company_name;

        const existing = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec ce numéro.' });
        }

        const agentPhone = normalizePhone(req.user.phone);

        const newUser = await client.query(
            `INSERT INTO users (phone, full_name, role, is_active, agent_phone) VALUES ($1,$2,'rh',TRUE,$3) RETURNING id`,
            [normalizedPhone, full_name, agentPhone]
        );
        userId = newUser.rows[0].id;

        await client.query(
            `UPDATE company_contracts SET rh_phone = $1 WHERE id = $2`,
            [normalizedPhone, contract_id]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('rh_cree', $1, 'users', $2, $3::jsonb)`,
            [agentPhone, userId, JSON.stringify({ phone: normalizedPhone, full_name, contract_id, company_name: companyName })]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerRH]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }

    try {
        await sendAutoMessage(normalizedPhone, 'bolamu_notification_fallback', [
            `Bienvenue sur Bolamu, ${full_name} ! Votre compte RH pour ${companyName} a été créé.`
        ]);
        await sendOnboardingLink(normalizedPhone, full_name, 'rh');
    } catch (e) {
        console.error('[registerRH] notification non envoyée (non bloquant):', e.message);
    }

    return res.status(201).json({
        success: true,
        message: 'Compte RH créé. Lien de connexion envoyé par WhatsApp.',
        data: { phone: normalizedPhone, full_name, role: 'rh', company_name: companyName }
    });
}

// ─── SECRÉTAIRE (création par un agent, partenaire_phone explicite) ─────────
async function registerSecretaireAgent(req, res) {
    const { phone, nom, prenom, partenaire_phone } = req.body;
    const normalizedPhone = normalizePhone(phone || '');
    const normalizedPartenairePhone = normalizePhone(partenaire_phone || '');

    if (!normalizedPhone || !nom || !prenom || !normalizedPartenairePhone) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, nom, prenom, partenaire_phone' });
    }
    if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const partner = await client.query('SELECT role, full_name FROM users WHERE phone = $1', [normalizedPartenairePhone]);
        if (partner.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Partenaire de rattachement introuvable.' });
        }
        if (partner.rows[0].role !== 'doctor') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: "Seuls les médecins peuvent avoir une secrétaire rattachée pour l'instant (pharmacies et laboratoires non supportés)."
            });
        }

        const countResult = await client.query(
            `SELECT COUNT(*) as count FROM secretaires WHERE partenaire_phone = $1 AND is_active = TRUE`,
            [normalizedPartenairePhone]
        );
        if (parseInt(countResult.rows[0].count, 10) >= 3) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Maximum 3 secrétaires actifs atteint pour ce partenaire.' });
        }

        const existing = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec ce numéro.' });
        }

        const agentPhone = normalizePhone(req.user.phone);
        const fullName = `${prenom} ${nom}`.trim();

        await client.query(
            `INSERT INTO users (phone, full_name, role, is_active, agent_phone) VALUES ($1,$2,'secretaire',TRUE,$3)`,
            [normalizedPhone, fullName, agentPhone]
        );

        await client.query(
            `INSERT INTO secretaires (phone, partenaire_phone, partenaire_type, nom, prenom, is_active) VALUES ($1,$2,'doctor',$3,$4,TRUE)`,
            [normalizedPhone, normalizedPartenairePhone, nom, prenom]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('secretaire_cree', $1, 'secretaires', NULL, $2::jsonb)`,
            [agentPhone, JSON.stringify({ phone: normalizedPhone, nom, prenom, partenaire_phone: normalizedPartenairePhone })]
        );

        await client.query('COMMIT');

        try {
            await sendAutoMessage(normalizedPhone, 'bolamu_secretaire_bienvenue_v4', [fullName]);
            await sendOnboardingLink(normalizedPhone, fullName, 'secretaire');
        } catch (e) {
            console.error('[registerSecretaireAgent] notification non envoyée (non bloquant):', e.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Compte secrétaire créé. Lien de connexion envoyé par WhatsApp.',
            data: { phone: normalizedPhone, full_name: fullName, role: 'secretaire', partenaire_phone: normalizedPartenairePhone }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerSecretaireAgent]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

// ─── PARTENAIRE COMMERCIAL ───────────────────────────────────────────────────
// Login séparé (POST /api/v1/partenaire/login, phone+password) — public/partenaire/login.html
// ne gère pas de lien magique. Mot de passe temporaire nécessaire ici (pas de contournement possible
// sans modifier ce système de connexion, hors périmètre de ce chantier).
async function registerPartenaireCommercial(req, res) {
    const { phone, full_name, city, secteur } = req.body;
    const normalizedPhone = normalizePhone(phone || '');

    if (!normalizedPhone || !full_name || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, full_name, city' });
    }
    if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    let tempPassword;
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec ce numéro.' });
        }

        tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const agentPhone = normalizePhone(req.user.phone);

        const newUser = await client.query(
            `INSERT INTO users (phone, full_name, role, city, bio, password_hash, is_active, agent_phone)
             VALUES ($1,$2,'partenaire_commercial',$3,$4,$5,TRUE,$6) RETURNING id`,
            [normalizedPhone, full_name, city, secteur || null, hashedPassword, agentPhone]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('partenaire_commercial_cree', $1, 'users', $2, $3::jsonb)`,
            [agentPhone, newUser.rows[0].id, JSON.stringify({ phone: normalizedPhone, full_name, city, secteur: secteur || null })]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerPartenaireCommercial]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }

    try {
        await sendAutoMessage(normalizedPhone, 'bolamu_notification_fallback', [
            `Bienvenue sur Bolamu, ${full_name} ! Votre compte partenaire commercial a été créé. Connectez-vous sur bolamu.co/partenaire/login.html`
        ]);
        await sendAutoMessage(normalizedPhone, 'bolamu_code_acces', [tempPassword]);
    } catch (e) {
        console.error('[registerPartenaireCommercial] notification non envoyée (non bloquant):', e.message);
    }

    return res.status(201).json({
        success: true,
        message: 'Compte partenaire commercial créé. Mot de passe envoyé par WhatsApp.',
        data: { phone: normalizedPhone, full_name, role: 'partenaire_commercial' }
    });
}

module.exports = {
    registerAnimateur,
    registerRH,
    registerSecretaireAgent,
    registerPartenaireCommercial
};
