const pool = require('../config/db');

// ─── CRÉER UNE CONVENTION ─────────────────────────────────────────────────────
async function createConvention(req, res) {
    const { partner_phone, partner_type } = req.body;
    const adminPhone = req.user.phone;

    if (!partner_phone || !partner_type) {
        return res.status(400).json({ success: false, message: 'partner_phone et partner_type requis.' });
    }

    // Seuls pharmacie et laboratoire peuvent avoir des conventions
    if (partner_type !== 'pharmacie' && partner_type !== 'laboratoire') {
        return res.status(400).json({ success: false, message: 'Seuls pharmacie et laboratoire peuvent avoir des conventions tiers payant.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que le partenaire existe dans sa table spécifique et is_active = true
        let partnerCheck;
        if (partner_type === 'pharmacie') {
            partnerCheck = await client.query(
                `SELECT phone, name FROM pharmacies WHERE phone = $1 AND is_active = true`,
                [partner_phone]
            );
        } else if (partner_type === 'laboratoire') {
            partnerCheck = await client.query(
                `SELECT phone, name FROM laboratories WHERE phone = $1 AND is_active = true`,
                [partner_phone]
            );
        }

        if (!partnerCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Partenaire introuvable ou inactif.' });
        }

        const partnerName = partnerCheck.rows[0].name;

        // 2. Vérifier qu'il n'existe pas déjà une convention active ou pending
        const existingConv = await client.query(
            `SELECT id FROM partner_conventions 
             WHERE partner_phone = $1 AND status_new IN ('pending', 'actif')`,
            [partner_phone]
        );

        if (existingConv.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Une convention existe déjà pour ce partenaire.' });
        }

        // 3. Lire discount_rate depuis platform_config
        const rateKey = `discount_rate_${partner_type}`;
        const rateRes = await client.query(
            `SELECT config_value FROM platform_config WHERE config_key = $1`,
            [rateKey]
        );

        if (!rateRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false, message: `Taux de réduction non configuré : ${rateKey}` });
        }

        const discountRate = parseFloat(rateRes.rows[0].config_value);

        // 4. INSERT dans partner_conventions
        const insertRes = await client.query(
            `INSERT INTO partner_conventions 
                (partner_phone, partner_type, partner_name, discount_rate, status_new)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING *`,
            [partner_phone, partner_type, partnerName, discountRate]
        );

        const convention = insertRes.rows[0];

        // 5. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('CONVENTION_CREATED', $1, 'partner_conventions', $2, $3::jsonb)`,
            [adminPhone, convention.id.toString(), JSON.stringify({
                partner_phone,
                partner_type,
                discount_rate: discountRate
            })]
        );

        await client.query('COMMIT');

        return res.status(201).json({ success: true, data: convention });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('createConvention error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── ACTIVER UNE CONVENTION ───────────────────────────────────────────────────
async function activateConvention(req, res) {
    const { id } = req.params;
    const adminPhone = req.user.phone;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que la convention existe et status_new = 'pending'
        const convRes = await client.query(
            `SELECT * FROM partner_conventions WHERE id = $1 AND status_new = 'pending'`,
            [id]
        );

        if (!convRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Convention introuvable ou non en attente.' });
        }

        // 2. UPDATE status_new = 'actif'
        const updateRes = await client.query(
            `UPDATE partner_conventions 
             SET status_new = 'actif', started_at = NOW(), validated_by = $1, validated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [adminPhone, id]
        );

        const convention = updateRes.rows[0];

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('CONVENTION_ACTIVATED', $1, 'partner_conventions', $2, $3::jsonb)`,
            [adminPhone, id, JSON.stringify({ partner_phone: convention.partner_phone })]
        );

        await client.query('COMMIT');

        return res.json({ success: true, data: convention });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('activateConvention error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── SUSPENDRE UNE CONVENTION ───────────────────────────────────────────────────
async function suspendConvention(req, res) {
    const { id } = req.params;
    const adminPhone = req.user.phone;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que status_new = 'actif'
        const convRes = await client.query(
            `SELECT * FROM partner_conventions WHERE id = $1 AND status_new = 'actif'`,
            [id]
        );

        if (!convRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Convention introuvable ou non active.' });
        }

        // 2. UPDATE status_new = 'suspendu'
        const updateRes = await client.query(
            `UPDATE partner_conventions 
             SET status_new = 'suspendu'
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        const convention = updateRes.rows[0];

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('CONVENTION_SUSPENDED', $1, 'partner_conventions', $2, $3::jsonb)`,
            [adminPhone, id, JSON.stringify({ partner_phone: convention.partner_phone })]
        );

        await client.query('COMMIT');

        return res.json({ success: true, data: convention });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('suspendConvention error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── RÉSILIER UNE CONVENTION ───────────────────────────────────────────────────
async function terminateConvention(req, res) {
    const { id } = req.params;
    const adminPhone = req.user.phone;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que status_new != 'resilie'
        const convRes = await client.query(
            `SELECT * FROM partner_conventions WHERE id = $1 AND status_new != 'resilie'`,
            [id]
        );

        if (!convRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Convention introuvable ou déjà résiliée.' });
        }

        // 2. UPDATE status_new = 'resilie', expires_at = NOW()
        const updateRes = await client.query(
            `UPDATE partner_conventions 
             SET status_new = 'resilie', expires_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        const convention = updateRes.rows[0];

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('CONVENTION_TERMINATED', $1, 'partner_conventions', $2, $3::jsonb)`,
            [adminPhone, id, JSON.stringify({ partner_phone: convention.partner_phone })]
        );

        await client.query('COMMIT');

        return res.json({ success: true, data: convention });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('terminateConvention error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── LISTER LES CONVENTIONS ────────────────────────────────────────────────────
async function listConventions(req, res) {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * limit;

    try {
        // Requête principale avec filtre optionnel
        let query = `
            SELECT pc.*, u.full_name, u.validated_at
            FROM partner_conventions pc
            LEFT JOIN users u ON u.phone = pc.partner_phone
        `;
        const params = [];

        if (status) {
            query += ` WHERE pc.status_new = $1`;
            params.push(status);
        }

        query += ` ORDER BY pc.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        // Compte total
        let countQuery = `SELECT COUNT(*) FROM partner_conventions`;
        const countParams = [];

        if (status) {
            countQuery += ` WHERE status_new = $1`;
            countParams.push(status);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('listConventions error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createConvention,
    activateConvention,
    suspendConvention,
    terminateConvention,
    listConventions
};
