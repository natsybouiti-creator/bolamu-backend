// ============================================================
// BOLAMU — Contrôleur Pharmacies
// ============================================================

const pool = require('../config/db');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { sendAutoMessage } = require('../services/whatsapp-web.service');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');
const { getOrdonnancesEnAttente, dispenserOrdonnance, getStats } = require('../services/pharmacie.service');

function calculateTrustScore(data) {
    let score = 0;
    if (/^\+242(06|05)[0-9]{7}$/.test(data.phone)) score += 20;
    if (data.rccm_number && data.rccm_number.length >= 4) score += 25;
    if (data.autorisation_number && data.autorisation_number.length >= 4) score += 10;
    if (data.document_url) score += 30;
    if (data.name && data.name.length > 2) score += 10;
    if (data.city) score += 5;
    return Math.min(score, 100);
}

async function registerPharmacie(req, res) {
    const phone = req.body?.phone;
    const name = req.body?.name;
    const responsible_name = req.body?.responsible_name;
    const rccm_number = req.body?.rccm_number;
    const autorisation_number = req.body?.autorisation_number;
    const city = req.body?.city;
    const neighborhood = req.body?.neighborhood;
    const momo_number = req.body?.momo_number;

    const normalizedPhone = normalizePhone(phone || '');
    if (!normalizedPhone || !name || !responsible_name || !rccm_number || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, name, responsible_name, rccm_number, city' });
    }
    if (!/^\+242[0-9]{9}$/.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM pharmacies WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Une pharmacie avec ce numéro existe déjà.' });
        }

        let documentUrl = null;
        let documentPublicId = null;
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, 'bolamu/pharmacies/documents');
                documentUrl = result.secure_url;
                documentPublicId = result.public_id;
            } catch (e) { console.error('[Cloudinary pharmacie]', e.message); }
        }

        const score = calculateTrustScore({ phone: normalizedPhone, name, rccm_number, autorisation_number, city, document_url: documentUrl });
        const autoStatus = score >= 80 ? 'verified' : 'pending';
        const codeRes = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
             FROM users WHERE role = 'pharmacie' AND member_code ~ '^PHM-[0-9]+$'`
        );
        const memberCode = `PHM-${codeRes.rows[0].next.toString().padStart(5, '0')}`;

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(`INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'pharmacie', FALSE) RETURNING id`, [normalizedPhone, name]);
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET role = 'pharmacie' WHERE id = $1`, [userId]);
        }

        const newPharma = await client.query(
            `INSERT INTO pharmacies (phone, user_id, name, responsible_name, rccm_number, autorisation_number, city, neighborhood, status, is_active, member_code, document_url, document_public_id, trust_score, momo_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11,$12,$13,$14)
             RETURNING id, phone, name, status, member_code, trust_score`,
            [normalizedPhone, userId, name, responsible_name, rccm_number, autorisation_number || null, city, neighborhood || null, autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || normalizedPhone]
        );

        if (documentUrl) {
            await client.query(
                `UPDATE users SET document_url = $1 WHERE phone = $2`,
                [documentUrl, normalizedPhone]
            );
        }

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('pharmacie.registered', $1, 'pharmacies', $2, $3::jsonb)`,
            [normalizedPhone, newPharma.rows[0].id, JSON.stringify({ name, rccm_number, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            if (autoStatus === 'verified') {
                await sendAutoMessage(normalizedPhone, 'bolamu_bienvenue_pharmacie', [name, memberCode]);
            } else {
                await sendAutoMessage(normalizedPhone, 'bolamu_inscription_pharmacie_pending', [name, score.toString()]);
            }
        } catch (e) { console.error('[Pharmacie] WhatsApp non envoyé:', e.message); }

        return res.status(201).json({
            success: true,
            message: autoStatus === 'verified' ? 'Pharmacie validée automatiquement !' : 'Inscription reçue. Vérification sous 24h.',
            data: { phone: newPharma.rows[0].phone, name: newPharma.rows[0].name, status: newPharma.rows[0].status, member_code: newPharma.rows[0].member_code, trust_score: newPharma.rows[0].trust_score, auto_validated: autoStatus === 'verified' }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerPharmacie]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

async function getPharmacieProfile(req, res) {
    const phone = req.user.phone;
    const normalizedPhone = normalizePhone(phone);
    try {
        const result = await pool.query(
            `SELECT p.id, p.phone, p.name, p.responsible_name, p.rccm_number,
                    p.city, p.neighborhood, p.status, p.member_code,
                    p.trust_score, p.momo_number, p.is_active,
                    p.document_url, p.abonnement_actif, p.abonnement_fin,
                    p.created_at, u.validated_at
             FROM pharmacies p
             LEFT JOIN users u ON u.phone = p.phone
             WHERE p.phone = $1`,
            [normalizedPhone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Pharmacie introuvable.' });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function updatePharmacieStatus(req, res) {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const result = await pool.query(`UPDATE pharmacies SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`, [status, status === 'verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Pharmacie introuvable.' });
        const p = result.rows[0];
        try {
            if (status === 'verified') {
                await sendWhatsAppTemplate(p.phone, 'bolamu_pharmacie_validee', [p.name, p.member_code]);
            } else if (status === 'rejected') {
                await sendWhatsAppTemplate(p.phone, 'bolamu_pharmacie_rejetee', [p.name, reason || 'Dossier incomplet']);
            } else if (status === 'suspended') {
                await sendWhatsAppTemplate(p.phone, 'bolamu_pharmacie_suspendue', [p.name]);
            }
        } catch (e) {
            logger.error('[updatePharmacieStatus] WhatsApp error:', e.message);
        }
        return res.json({ success: true, data: p });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function getOrdonnancesEnAttenteHandler(req, res) {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });
    try {
        const ordonnances = await getOrdonnancesEnAttente(phone);
        return res.json({ success: true, data: ordonnances });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function dispenserOrdonnanceHandler(req, res) {
    const phone = req.user?.phone;
    const { ordonnance_id } = req.body;
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });
    if (!ordonnance_id) return res.status(400).json({ success: false, message: 'ordonnance_id requis.' });
    try {
        const result = await dispenserOrdonnance(ordonnance_id, phone);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

async function getStatsHandler(req, res) {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });
    try {
        const stats = await getStats(phone);
        return res.json({ success: true, data: stats });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerPharmacie, getPharmacieProfile, updatePharmacieStatus, getOrdonnancesEnAttenteHandler, dispenserOrdonnanceHandler, getStatsHandler };
