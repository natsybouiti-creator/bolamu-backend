const pool = require('../config/db');

// ─── INITIER UNE TRANSACTION TIERS PAYANT ───────────────────────────────────────
async function initiateTransaction(req, res) {
    const { patient_phone, montant_total } = req.body;
    const partnerPhone = req.user.phone;
    const partnerRole = req.user.role;

    if (!patient_phone || !montant_total) {
        return res.status(400).json({ success: false, message: 'patient_phone et montant_total requis.' });
    }

    // Seuls pharmacie et laboratoire peuvent initier des transactions
    if (partnerRole !== 'pharmacie' && partnerRole !== 'laboratoire') {
        return res.status(403).json({ success: false, message: 'Seuls pharmacie et laboratoire peuvent initier des transactions tiers payant.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que l'adhérent a un abonnement actif
        const subCheck = await client.query(
            `SELECT id, plan FROM subscriptions 
             WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW()`,
            [patient_phone]
        );

        if (!subCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Adhérent sans abonnement actif.' });
        }

        // 2. Vérifier que le partenaire a une convention active
        const convCheck = await client.query(
            `SELECT id, discount_rate FROM partner_conventions 
             WHERE partner_phone = $1 AND status_new = 'actif'`,
            [partnerPhone]
        );

        if (!convCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Votre établissement n\'a pas de convention active.' });
        }

        const convention = convCheck.rows[0];

        // 3. Lire discount_rate depuis platform_config selon le type du partenaire
        const rateKey = `discount_rate_${partnerRole}`;
        const rateRes = await client.query(
            `SELECT config_value FROM platform_config WHERE config_key = $1`,
            [rateKey]
        );

        if (!rateRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false, message: `Taux de réduction non configuré : ${rateKey}` });
        }

        const discountRate = parseFloat(rateRes.rows[0].config_value);

        // 4. Calculer les montants
        const montantRemise = Math.round(montant_total * discountRate);
        const montantPatient = montant_total - montantRemise;

        // 5. INSERT dans transactions_tiers_payant
        const insertRes = await client.query(
            `INSERT INTO transactions_tiers_payant 
                (partner_phone, patient_phone, convention_id, montant_total, montant_remise, montant_patient, discount_rate_used, status_new)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
             RETURNING id`,
            [partnerPhone, patient_phone, convention.id, montant_total, montantRemise, montantPatient, discountRate]
        );

        const transactionId = insertRes.rows[0].id;

        // 6. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('TIERS_PAYANT_INITIATED', $1, 'transactions_tiers_payant', $2, $3::jsonb)`,
            [partnerPhone, transactionId.toString(), JSON.stringify({
                patient_phone,
                montant_total,
                montant_remise: montantRemise,
                montant_patient: montantPatient,
                discount_rate: discountRate
            })]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            data: {
                transaction_id: transactionId,
                montant_total,
                montant_remise: montantRemise,
                montant_patient: montantPatient,
                discount_rate: discountRate
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('initiateTransaction error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── VALIDER UNE TRANSACTION ───────────────────────────────────────────────────
async function validateTransaction(req, res) {
    const { id } = req.params;
    const partnerPhone = req.user.phone;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que la transaction appartient au partenaire connecté
        const transCheck = await client.query(
            `SELECT * FROM transactions_tiers_payant 
             WHERE id = $1 AND partner_phone = $2 AND status_new = 'pending'`,
            [id, partnerPhone]
        );

        if (!transCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Transaction introuvable ou non autorisée.' });
        }

        // 2. UPDATE status_new = 'validated'
        const updateRes = await client.query(
            `UPDATE transactions_tiers_payant 
             SET status_new = 'validated'
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        const transaction = updateRes.rows[0];

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('TIERS_PAYANT_VALIDATED', $1, 'transactions_tiers_payant', $2, $3::jsonb)`,
            [partnerPhone, id, JSON.stringify({ patient_phone: transaction.patient_phone })]
        );

        await client.query('COMMIT');

        return res.json({ success: true, data: transaction });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('validateTransaction error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── LISTER LES TRANSACTIONS DU PARTENAIRE ────────────────────────────────────
async function listTransactionsPartenaire(req, res) {
    const partnerPhone = req.user.phone;
    const { mois, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * limit;

    try {
        let query = `
            SELECT ttp.*, u.full_name as patient_name
            FROM transactions_tiers_payant ttp
            LEFT JOIN users u ON u.phone = ttp.patient_phone
            WHERE ttp.partner_phone = $1
        `;
        const params = [partnerPhone];

        // Filtre par mois si spécifié
        if (mois) {
            query += ` AND DATE_TRUNC('month', ttp.created_at) = $2::date`;
            params.push(`${mois}-01`);
        }

        query += ` ORDER BY ttp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        // Compte total
        let countQuery = `SELECT COUNT(*) FROM transactions_tiers_payant WHERE partner_phone = $1`;
        const countParams = [partnerPhone];

        if (mois) {
            countQuery += ` AND DATE_TRUNC('month', created_at) = $2::date`;
            countParams.push(`${mois}-01`);
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
        console.error('listTransactionsPartenaire error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LISTER LES TRANSACTIONS (ADMIN) ───────────────────────────────────────────
async function listTransactionsAdmin(req, res) {
    const { status, partner_phone, mois, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * limit;

    try {
        let query = `
            SELECT ttp.*, u.full_name as patient_name, p.name as partner_name
            FROM transactions_tiers_payant ttp
            LEFT JOIN users u ON u.phone = ttp.patient_phone
            LEFT JOIN (
                SELECT phone, name, 'pharmacie' as type FROM pharmacies
                UNION ALL
                SELECT phone, name, 'laboratoire' as type FROM laboratories
            ) p ON p.phone = ttp.partner_phone
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND ttp.status_new = $${params.length + 1}`;
            params.push(status);
        }

        if (partner_phone) {
            query += ` AND ttp.partner_phone = $${params.length + 1}`;
            params.push(partner_phone);
        }

        if (mois) {
            query += ` AND DATE_TRUNC('month', ttp.created_at) = $${params.length + 1}::date`;
            params.push(`${mois}-01`);
        }

        query += ` ORDER BY ttp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        // Compte total
        let countQuery = `
            SELECT COUNT(*) FROM transactions_tiers_payant
            WHERE 1=1
        `;
        const countParams = [];

        if (status) {
            countQuery += ` AND status_new = $${countParams.length + 1}`;
            countParams.push(status);
        }

        if (partner_phone) {
            countQuery += ` AND partner_phone = $${countParams.length + 1}`;
            countParams.push(partner_phone);
        }

        if (mois) {
            countQuery += ` AND DATE_TRUNC('month', created_at) = $${countParams.length + 1}::date`;
            countParams.push(`${mois}-01`);
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
        console.error('listTransactionsAdmin error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCONCILIER UNE TRANSACTION ───────────────────────────────────────────────
async function reconcileTransaction(req, res) {
    const { id } = req.params;
    const adminPhone = req.user.phone;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que la transaction existe
        const transCheck = await client.query(
            `SELECT * FROM transactions_tiers_payant WHERE id = $1`,
            [id]
        );

        if (!transCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
        }

        // 2. UPDATE status_new = 'reconciling'
        const updateRes = await client.query(
            `UPDATE transactions_tiers_payant 
             SET status_new = 'reconciling', reconciled_at = NOW(), reconciled_by = $1
             WHERE id = $2
             RETURNING *`,
            [adminPhone, id]
        );

        const transaction = updateRes.rows[0];

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('TIERS_PAYANT_RECONCILED', $1, 'transactions_tiers_payant', $2, $3::jsonb)`,
            [adminPhone, id, JSON.stringify({ partner_phone: transaction.partner_phone })]
        );

        await client.query('COMMIT');

        return res.json({ success: true, data: transaction });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('reconcileTransaction error:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

module.exports = {
    initiateTransaction,
    validateTransaction,
    listTransactionsPartenaire,
    listTransactionsAdmin,
    reconcileTransaction
};
