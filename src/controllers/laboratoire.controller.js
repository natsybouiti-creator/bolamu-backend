// ============================================================
// BOLAMU — Contrôleur Laboratoires
// ============================================================

const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const { normalizePhoneNumber } = require('../utils/phoneHelper');

async function uploadToCloudinary(fileBuffer, folder) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto' },
            (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(fileBuffer);
    });
}

function generateLabCode(phone) {
    const digits = phone.replace(/\D/g, '').slice(-8);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 2) { const n = parseInt(digits.slice(i, i + 2)); code += chars[n % chars.length]; }
    return 'LAB-' + code.slice(0, 4);
}

function calculateTrustScore(data) {
    let score = 0;
    if (/^\+242(06|05)[0-9]{7}$/.test(data.phone)) score += 20;
    if (data.rccm_number && data.rccm_number.length >= 4) score += 25;
    if (data.agrement_number && data.agrement_number.length >= 4) score += 10;
    if (data.document_url) score += 30;
    if (data.name && data.name.length > 2) score += 10;
    if (data.city) score += 5;
    return Math.min(score, 100);
}

async function registerLaboratoire(req, res) {
    const phone = req.body?.phone;
    const name = req.body?.name;
    const director_name = req.body?.director_name;
    const rccm_number = req.body?.rccm_number;
    const agrement_number = req.body?.agrement_number;
    const city = req.body?.city;
    const neighborhood = req.body?.neighborhood;
    const momo_number = req.body?.momo_number;

    if (!phone || !name || !director_name || !rccm_number || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, name, director_name, rccm_number, city' });
    }
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!/^\+242[0-9]{9}$/.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM laboratories WHERE phone = $1', [normalizedPhone]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un laboratoire avec ce numéro existe déjà.' });
        }

        let documentUrl = null;
        let documentPublicId = null;
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, 'bolamu/laboratories/documents');
                documentUrl = result.secure_url;
                documentPublicId = result.public_id;
            } catch (e) { console.error('[Cloudinary labo]', e.message); }
        }

        const score = calculateTrustScore({ phone: normalizedPhone, name, rccm_number, agrement_number, city, document_url: documentUrl });
        const autoStatus = score >= 80 ? 'verified' : 'pending';
        const memberCode = generateLabCode(normalizedPhone);

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(`INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'laboratoire', TRUE) RETURNING id`, [normalizedPhone, name]);
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET role = 'laboratoire' WHERE id = $1`, [userId]);
        }

        const newLab = await client.query(
            `INSERT INTO laboratories (phone, user_id, name, director_name, rccm_number, agrement_number, city, neighborhood, status, is_active, member_code, document_url, document_public_id, trust_score, momo_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12,$13,$14)
             RETURNING id, phone, name, status, member_code, trust_score`,
            [normalizedPhone, userId, name, director_name, rccm_number, agrement_number || null, city, neighborhood || null, autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || normalizedPhone]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('laboratoire.registered', $1, 'laboratories', $2, $3)`,
            [normalizedPhone, newLab.rows[0].id, JSON.stringify({ name, rccm_number, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            const msg = autoStatus === 'verified'
                ? `Bolamu : Bienvenue ${name} ! Laboratoire validé. Code : ${memberCode}. Connectez-vous sur bolamu-backend.onrender.com`
                : `Bolamu : Inscription ${name} reçue (score: ${score}/100). Vérification sous 24h.`;
            await sendBolamuSms(normalizedPhone, msg);
        } catch (e) { console.log('⚠️ SMS non envoyé'); }

        return res.status(201).json({
            success: true,
            message: autoStatus === 'verified' ? '✅ Laboratoire validé automatiquement !' : '📋 Inscription reçue. Vérification sous 24h.',
            data: { phone: newLab.rows[0].phone, name: newLab.rows[0].name, status: newLab.rows[0].status, member_code: newLab.rows[0].member_code, trust_score: newLab.rows[0].trust_score, auto_validated: autoStatus === 'verified' }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerLaboratoire]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

async function getLaboratoireProfile(req, res) {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhoneNumber(phone);
    
    try {
        const result = await pool.query(
            `SELECT id, name, phone, director_name, rccm_number, agrement_number, city, neighborhood, status, member_code, trust_score, momo_number, created_at FROM laboratories WHERE phone = $1`,
            [normalizedPhone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Laboratoire introuvable.' });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function updateLaboratoireStatus(req, res) {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const result = await pool.query(`UPDATE laboratories SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`, [status, status === 'verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Laboratoire introuvable.' });
        const l = result.rows[0];
        try {
            const msgs = {
                verified: `Bolamu : ${l.name} validé ! Code : ${l.member_code}.`,
                rejected: `Bolamu : Inscription ${l.name} non validée. Motif : ${reason || 'Dossier incomplet'}.`,
                suspended: `Bolamu : Compte ${l.name} suspendu.`
            };
            if (msgs[status]) await sendBolamuSms(l.phone, msgs[status]);
        } catch (e) {}
        return res.json({ success: true, data: l });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerLaboratoire, getLaboratoireProfile, updateLaboratoireStatus };