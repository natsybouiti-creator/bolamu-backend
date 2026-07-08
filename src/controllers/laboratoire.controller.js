// ============================================================
// BOLAMU — Contrôleur Laboratoires
// ============================================================

const pool = require('../config/db');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { normalizePhone } = require('../utils/phone');
const { uploadToCloudinary } = require('../utils/cloudinary');
const logger = require('../config/logger');


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
    const normalizedPhone = normalizePhone(phone);
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
        const codeRes = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
             FROM users WHERE role = 'laboratoire' AND member_code ~ '^LAB-[0-9]+$'`
        );
        const memberCode = `LAB-${codeRes.rows[0].next.toString().padStart(5, '0')}`;

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(`INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'laboratoire', FALSE) RETURNING id`, [normalizedPhone, name]);
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET role = 'laboratoire' WHERE id = $1`, [userId]);
        }

        const agentPhone = req.user?.role === 'agent_bolamu' ? normalizePhone(req.user.phone) : null;

        const newLab = await client.query(
            `INSERT INTO laboratories (phone, user_id, name, director_name, rccm_number, agrement_number, city, neighborhood, status, is_active, member_code, document_url, document_public_id, trust_score, momo_number, agent_phone)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11,$12,$13,$14,$15)
             RETURNING id, phone, name, status, member_code, trust_score`,
            [normalizedPhone, userId, name, director_name, rccm_number, agrement_number || null, city, neighborhood || null, autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || normalizedPhone, agentPhone]
        );

        if (documentUrl) {
            await client.query(
                `UPDATE users SET document_url = $1 WHERE phone = $2`,
                [documentUrl, normalizedPhone]
            );
        }

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('laboratoire.registered', $1, 'laboratories', $2, $3::jsonb)`,
            [normalizedPhone, newLab.rows[0].id, JSON.stringify({ name, rccm_number, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            if (autoStatus === 'verified') {
                await sendAutoMessage(normalizedPhone, 'bolamu_bienvenue_laboratoire', [name, memberCode]);
            } else {
                await sendAutoMessage(normalizedPhone, 'bolamu_inscription_labo_pending', [name, score.toString()]);
            }
            // TODO: supprimer sendBolamuSms après validation WhatsApp
            // const msg = autoStatus === 'verified'
            //     ? `Bolamu : Bienvenue ${name} ! Laboratoire validé. Code : ${memberCode}. Connectez-vous sur api.bolamu.co`
            //     : `Bolamu : Inscription ${name} reçue (score: ${score}/100). Vérification sous 24h.`;
            // await sendBolamuSms(normalizedPhone, msg);
        } catch (e) { console.log('⚠️ WhatsApp non envoyé'); }

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
    const phone = req.user.phone;
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);
    
    try {
        const result = await pool.query(
            `SELECT l.id, l.phone, l.name, l.director_name, l.rccm_number,
                    l.agrement_number, l.city, l.neighborhood, l.status,
                    l.is_active, l.member_code, l.trust_score, l.momo_number,
                    l.abonnement_actif, l.abonnement_fin, l.document_url, l.photo_url,
                    l.created_at, u.validated_at
             FROM laboratories l
             LEFT JOIN users u ON u.phone = l.phone
             WHERE l.phone = $1`,
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
            const templateMap = {
                verified:  ['bolamu_labo_valide',    [l.name, l.member_code]],
                rejected:  ['bolamu_labo_rejete',    [reason || 'Dossier incomplet']],
                suspended: ['bolamu_compte_suspendu',[reason || 'Activité suspecte']]
            };
            if (templateMap[status]) {
                await sendAutoMessage(l.phone, templateMap[status][0], templateMap[status][1]);
            }
        } catch (e) {
            logger.error('[updateLaboratoireStatus] WhatsApp error:', e.message);
        }
        return res.json({ success: true, data: l });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RECHERCHER LABORATOIRES AVEC FILTRES ET PAGINATION ─────────────────────
async function getLaboratoires(req, res) {
    const { search, city, page = 1, per_page = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(per_page);

    try {
        const conditions = [`l.is_active = TRUE`, `l.status = 'verified'`];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`l.name ILIKE $${params.length}`);
        }
        if (city) {
            params.push(`%${city}%`);
            conditions.push(`l.city ILIKE $${params.length}`);
        }

        const whereClause = conditions.join(' AND ');
        params.push(parseInt(per_page));
        params.push(offset);

        const result = await pool.query(
            `SELECT l.id, l.phone, l.name, l.city, l.neighborhood, l.member_code, l.trust_score
             FROM laboratories l
             WHERE ${whereClause}
             ORDER BY l.name ASC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM laboratories l WHERE ${whereClause}`,
            params.slice(0, params.length - 2)
        );
        const total = parseInt(countResult.rows[0].count);

        return res.json({
            success: true,
            data: {
                laboratories: result.rows,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    per_page: parseInt(per_page),
                    pages: Math.ceil(total / parseInt(per_page))
                }
            }
        });
    } catch (error) {
        console.error('[getLaboratoires]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── MODIFIER LE PROFIL LABORATOIRE (PATCH /api/v1/laboratoires/profil) ─────────────
async function updateLaboratoireProfile(req, res) {
    const labPhone = req.user.phone;
    const { name, director_name, city, neighborhood, momo_number } = req.body;

    // Champs modifiables : name, director_name, city, neighborhood, momo_number
    // Champs NON modifiables : phone (identifiant), is_active, role, created_at, rccm_number, agrement_number

    try {
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (director_name) {
            updates.push(`director_name = $${paramCount++}`);
            values.push(director_name);
        }
        if (city) {
            updates.push(`city = $${paramCount++}`);
            values.push(city);
        }
        if (neighborhood !== undefined) {
            updates.push(`neighborhood = $${paramCount++}`);
            values.push(neighborhood || null);
        }
        if (momo_number !== undefined) {
            updates.push(`momo_number = $${paramCount++}`);
            values.push(momo_number || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucun champ à modifier.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(labPhone);

        const query = `UPDATE laboratories SET ${updates.join(', ')} WHERE phone = $${paramCount} RETURNING *`;
        const result = await pool.query(query, values);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Laboratoire introuvable.' });
        }

        // Mettre à jour aussi la table users pour full_name
        if (name) {
            await pool.query(`UPDATE users SET full_name = $1 WHERE phone = $2`, [name, labPhone]);
        }

        // Audit log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('laboratoire.profile_updated', $1, 'laboratories', $2, $3::jsonb)`,
            [labPhone, result.rows[0].id, JSON.stringify({ updated_fields: Object.keys(req.body) })]
        ).catch((err) => logger.error('[updateLaboratoireProfile] Audit log error:', err.message));

        return res.json({ success: true, message: 'Profil mis à jour avec succès.', data: result.rows[0] });

    } catch (error) {
        console.error('[updateLaboratoireProfile]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerLaboratoire, getLaboratoireProfile, updateLaboratoireStatus, getLaboratoires, updateLaboratoireProfile };