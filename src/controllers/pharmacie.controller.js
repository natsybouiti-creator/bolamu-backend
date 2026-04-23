// ============================================================
// BOLAMU — Contrôleur Pharmacies
// ============================================================

const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const { uploadToCloudinary } = require('../utils/cloudinary');

function generatePhmCode(phone) {
    const digits = phone.replace(/\D/g, '').slice(-8);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 2) { const n = parseInt(digits.slice(i, i + 2)); code += chars[n % chars.length]; }
    return 'PHM-' + code.slice(0, 4);
}

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

    if (!phone || !name || !responsible_name || !rccm_number || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, name, responsible_name, rccm_number, city' });
    }
    if (!/^\+242[0-9]{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM pharmacies WHERE phone = $1', [phone]);
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

        const score = calculateTrustScore({ phone, name, rccm_number, autorisation_number, city, document_url: documentUrl });
        const autoStatus = score >= 80 ? 'verified' : 'pending';
        const memberCode = generatePhmCode(phone);

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(`INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'pharmacie', FALSE) RETURNING id`, [phone, name]);
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET role = 'pharmacie' WHERE id = $1`, [userId]);
        }

        const newPharma = await client.query(
            `INSERT INTO pharmacies (phone, user_id, name, responsible_name, rccm_number, autorisation_number, city, neighborhood, status, is_active, member_code, document_url, document_public_id, trust_score, momo_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11,$12,$13,$14)
             RETURNING id, phone, name, status, member_code, trust_score`,
            [phone, userId, name, responsible_name, rccm_number, autorisation_number || null, city, neighborhood || null, autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || phone]
        );

        if (documentUrl) {
            await client.query(
                `UPDATE users SET document_url = $1 WHERE phone = $2`,
                [documentUrl, phone]
            );
        }

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('pharmacie.registered', $1, 'pharmacies', $2, $3)`,
            [phone, newPharma.rows[0].id, JSON.stringify({ name, rccm_number, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            const msg = autoStatus === 'verified'
                ? `Bolamu : Bienvenue ${name} ! Pharmacie validée. Code : ${memberCode}. Connectez-vous sur bolamu-backend.onrender.com`
                : `Bolamu : Inscription ${name} reçue (score: ${score}/100). Vérification sous 24h.`;
            await sendBolamuSms(phone, msg);
        } catch (e) { console.log('⚠️ SMS non envoyé'); }

        return res.status(201).json({
            success: true,
            message: autoStatus === 'verified' ? '✅ Pharmacie validée automatiquement !' : '📋 Inscription reçue. Vérification sous 24h.',
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
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });
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
            [phone]
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
            const msgs = {
                verified: `Bolamu : ${p.name} validée ! Code : ${p.member_code}.`,
                rejected: `Bolamu : Inscription ${p.name} non validée. Motif : ${reason || 'Dossier incomplet'}.`,
                suspended: `Bolamu : Compte ${p.name} suspendu.`
            };
            if (msgs[status]) await sendBolamuSms(p.phone, msgs[status]);
        } catch (e) {}
        return res.json({ success: true, data: p });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerPharmacie, getPharmacieProfile, updatePharmacieStatus };