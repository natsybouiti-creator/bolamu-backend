// ============================================================
// BOLAMU — Contrôleur médecins
// ============================================================

const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');

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

function calculateTrustScore(data) {
    let score = 0;
    const details = [];
    if (/^\+242(06|05)[0-9]{7}$/.test(data.phone)) { score += 20; details.push({ check: 'phone_valid', points: 20 }); }
    if (data.registration_number && /^[A-Z0-9\-\/]{4,20}$/i.test(data.registration_number)) { score += 25; details.push({ check: 'registration_number_format', points: 25 }); }
    if (data.document_url) { score += 30; details.push({ check: 'document_uploaded', points: 30 }); }
    if (data.full_name && data.full_name.trim().split(' ').length >= 2) { score += 10; details.push({ check: 'full_name_valid', points: 10 }); }
    if (data.specialty && data.specialty.length > 3) { score += 10; details.push({ check: 'specialty_valid', points: 10 }); }
    if (data.city) { score += 5; details.push({ check: 'city_valid', points: 5 }); }
    return { score, details };
}

function generateMedCode(phone) {
    const digits = phone.replace(/\D/g, '').slice(-8);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 2) { const n = parseInt(digits.slice(i, i + 2)); code += chars[n % chars.length]; }
    return 'MED-' + code.slice(0, 4);
}

async function registerDoctor(req, res) {
    const phone = req.body?.phone;
    const full_name = req.body?.full_name;
    const specialty = req.body?.specialty;
    const registration_number = req.body?.registration_number;
    const city = req.body?.city;
    const neighborhood = req.body?.neighborhood;
    const bio = req.body?.bio;
    const momo_number = req.body?.momo_number;

    if (!phone || !full_name || !specialty || !registration_number || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires manquants : phone, full_name, specialty, registration_number, city' });
    }
    if (!/^\+242[0-9]{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingDoctor = await client.query('SELECT id FROM doctors WHERE phone = $1', [phone]);
        if (existingDoctor.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un médecin avec ce numéro existe déjà.' });
        }
        const existingReg = await client.query('SELECT id FROM doctors WHERE registration_number = $1', [registration_number]);
        if (existingReg.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Ce numéro d\'ordre est déjà enregistré.' });
        }

        let documentUrl = null;
        let documentPublicId = null;
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, 'bolamu/doctors/documents');
                documentUrl = result.secure_url;
                documentPublicId = result.public_id;
            } catch (e) { console.error('[Cloudinary doctor]', e.message); }
        }

        const { score, details } = calculateTrustScore({ phone, full_name, specialty, registration_number, city, document_url: documentUrl });
        const autoStatus = score >= 80 ? 'verified' : 'pending';
        const memberCode = generateMedCode(phone);

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(
                `INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'doctor', TRUE) RETURNING id`,
                [phone, full_name]
            );
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET full_name = $1, role = 'doctor' WHERE id = $2`, [full_name, userId]);
        }

        const newDoctor = await client.query(
            `INSERT INTO doctors
                (phone, user_id, full_name, specialty, registration_number,
                 city, neighborhood, bio, status, is_active, member_code,
                 document_url, document_public_id, trust_score, momo_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12,$13,$14)
             RETURNING id, phone, full_name, specialty, city, status, member_code, trust_score, created_at`,
            [phone, userId, full_name, specialty, registration_number, city, neighborhood || null, bio || null,
             autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || phone]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('doctor.registered', $1, 'doctors', $2, $3)`,
            [phone, newDoctor.rows[0].id, JSON.stringify({ full_name, specialty, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            const msg = autoStatus === 'verified'
                ? `Bolamu : Bienvenue Dr. ${full_name} ! Compte validé. Code : ${memberCode}. Connectez-vous sur bolamu-backend.onrender.com`
                : `Bolamu : Inscription reçue Dr. ${full_name}. Vérification en cours (score: ${score}/100). Réponse sous 24h.`;
            await sendBolamuSms(phone, msg);
        } catch (e) { console.log('⚠️ SMS non envoyé'); }

        return res.status(201).json({
            success: true,
            message: autoStatus === 'verified' ? '✅ Compte validé automatiquement !' : '📋 Inscription reçue. Vérification sous 24h.',
            data: { phone: newDoctor.rows[0].phone, full_name: newDoctor.rows[0].full_name, status: newDoctor.rows[0].status, member_code: newDoctor.rows[0].member_code, trust_score: newDoctor.rows[0].trust_score, auto_validated: autoStatus === 'verified' }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerDoctor]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

async function getDoctors(req, res) {
    const { specialty, city, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const conditions = [`d.is_active = TRUE`, `d.status = 'verified'`];
        const params = [];
        if (specialty) { params.push(`%${specialty}%`); conditions.push(`d.specialty ILIKE $${params.length}`); }
        if (city) { params.push(`%${city}%`); conditions.push(`d.city ILIKE $${params.length}`); }
        const whereClause = conditions.join(' AND ');
        params.push(parseInt(limit));
        params.push(offset);
        const result = await pool.query(
            `SELECT d.id, d.full_name, d.specialty, d.city, d.neighborhood, d.bio, d.availability_schedule, d.total_consultations, d.member_code
             FROM doctors d WHERE ${whereClause} ORDER BY d.total_consultations DESC, d.created_at ASC
             LIMIT $${params.length - 1} OFFSET $${params.length}`, params
        );
        const countResult = await pool.query(`SELECT COUNT(*) FROM doctors d WHERE ${whereClause}`, params.slice(0, params.length - 2));
        return res.json({ success: true, data: { doctors: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)) } } });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function updateDoctorStatus(req, res) {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const result = await pool.query(`UPDATE doctors SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`, [status, status === 'verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        const doc = result.rows[0];
        try {
            const messages = {
                verified: `Bolamu : Félicitations Dr. ${doc.full_name} ! Compte validé. Code : ${doc.member_code}.`,
                rejected: `Bolamu : Inscription non validée. Motif : ${reason || 'Dossier incomplet'}.`,
                suspended: `Bolamu : Compte suspendu. Motif : ${reason || 'Activité suspecte'}.`
            };
            if (messages[status]) await sendBolamuSms(doc.phone, messages[status]);
        } catch (e) {}
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1, $2, 'doctors', $3, $4)`,
            [`doctor.status_${status}`, doc.phone, parseInt(id), JSON.stringify({ reason })]
        ).catch(() => {});
        return res.json({ success: true, message: `Statut mis à jour : ${status}`, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerDoctor, getDoctors, updateDoctorStatus };