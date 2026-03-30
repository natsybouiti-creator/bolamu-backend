// ============================================================
// BOLAMU — Routes Crédits
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');
const { sendBolamuSms } = require('../services/sms.service');

// ─── RÈGLES D'ATTRIBUTION ─────────────────────────────────────────────────────
const CREDIT_RULES = {
    patient:     { monthly: 100, loyal_bonus: 50 },
    doctor:      { monthly: 200 },
    pharmacie:   { monthly: 150 },
    laboratoire: { monthly: 150 }
};

// ─── OBTENIR LE SOLDE D'UN UTILISATEUR ───────────────────────────────────────
router.get('/balance/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    try {
        let result = await pool.query(`SELECT * FROM credits WHERE phone = $1`, [phone]);
        if (!result.rows.length) {
            // Créer un solde à 0 si inexistant
            const userResult = await pool.query(`SELECT role FROM users WHERE phone = $1`, [phone]);
            const role = userResult.rows[0]?.role || 'patient';
            result = await pool.query(
                `INSERT INTO credits (phone, role, balance, total_earned, total_spent, consecutive_months)
                 VALUES ($1, $2, 0, 0, 0, 0) ON CONFLICT (phone) DO NOTHING RETURNING *`,
                [phone, role]
            );
            result = await pool.query(`SELECT * FROM credits WHERE phone = $1`, [phone]);
        }
        const credit = result.rows[0];

        // Historique récent
        const history = await pool.query(
            `SELECT * FROM credit_transactions WHERE phone = $1 ORDER BY created_at DESC LIMIT 20`,
            [phone]
        );

        // Partenaires actifs
        const partners = await pool.query(`SELECT * FROM credit_partners WHERE is_active = TRUE ORDER BY category`);

        return res.json({
            success: true,
            data: {
                ...credit,
                transactions: history.rows,
                partners: partners.rows
            }
        });
    } catch (e) {
        console.error('[credits/balance]', e.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── ATTRIBUTION MANUELLE (admin) ────────────────────────────────────────────
router.post('/grant', authMiddleware, async (req, res) => {
    const { phone, amount, reason } = req.body;
    if (!phone || !amount || !reason) {
        return res.status(400).json({ success: false, message: 'phone, amount, reason requis.' });
    }

    try {
        await ensureCreditAccount(phone);
        const credit = await addCredits(phone, parseInt(amount), reason, 'earn');

        try {
            await sendBolamuSms(phone, `Bolamu Credits : +${amount} crédits ajoutés ! Solde : ${credit.balance} crédits. Motif : ${reason}`);
        } catch(e) {}

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('credits.granted', $1, 'credits', NULL, $2)`,
            [phone, JSON.stringify({ amount, reason, new_balance: credit.balance })]
        ).catch(() => {});

        return res.json({ success: true, message: `${amount} crédits ajoutés.`, data: credit });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + e.message });
    }
});

// ─── ATTRIBUTION AUTOMATIQUE MENSUELLE (tous les utilisateurs actifs) ─────────
router.post('/distribute-monthly', authMiddleware, async (req, res) => {
    try {
        const results = { distributed: 0, errors: 0, details: [] };

        // Patients abonnés actifs
        const patients = await pool.query(
            `SELECT DISTINCT u.phone, u.role FROM users u
             JOIN subscriptions s ON s.patient_phone = u.phone
             WHERE s.status = 'active' AND s.expires_at > NOW() AND u.role = 'patient'`
        );

        for (const p of patients.rows) {
            try {
                await ensureCreditAccount(p.phone, p.role);
                const credit = await getCreditAccount(p.phone);
                let amount = CREDIT_RULES.patient.monthly;
                let reason = 'Attribution mensuelle — abonnement actif';

                // Bonus fidélité 3 mois consécutifs
                if ((credit.consecutive_months || 0) >= 2) {
                    amount += CREDIT_RULES.patient.loyal_bonus;
                    reason += ` + bonus fidélité (${credit.consecutive_months + 1} mois)`;
                }

                await addCredits(p.phone, amount, reason, 'earn');
                await pool.query(
                    `UPDATE credits SET consecutive_months = consecutive_months + 1, last_credited_at = NOW() WHERE phone = $1`,
                    [p.phone]
                );

                try { await sendBolamuSms(p.phone, `Bolamu Credits : +${amount} crédits ce mois ! Utilisez-les chez nos partenaires santé. Voir sur votre dashboard.`); } catch(e) {}
                results.distributed++;
                results.details.push({ phone: p.phone, amount, role: 'patient' });
            } catch(e) { results.errors++; }
        }

        // Médecins actifs (ayant eu au moins 1 RDV ce mois)
        const doctors = await pool.query(
            `SELECT DISTINCT d.phone FROM doctors d
             JOIN appointments a ON a.doctor_id = d.id
             WHERE d.status = 'verified' AND d.is_active = TRUE
               AND a.created_at > NOW() - INTERVAL '30 days' AND a.status = 'termine'`
        );

        for (const d of doctors.rows) {
            try {
                await ensureCreditAccount(d.phone, 'doctor');
                await addCredits(d.phone, CREDIT_RULES.doctor.monthly, 'Attribution mensuelle — médecin actif', 'earn');
                await pool.query(`UPDATE credits SET last_credited_at = NOW() WHERE phone = $1`, [d.phone]);
                results.distributed++;
                results.details.push({ phone: d.phone, amount: CREDIT_RULES.doctor.monthly, role: 'doctor' });
            } catch(e) { results.errors++; }
        }

        // Pharmacies et labos Pro
        const pros = await pool.query(
            `SELECT phone, 'pharmacie' as role FROM pharmacies WHERE status = 'verified' AND is_active = TRUE
             UNION
             SELECT phone, 'laboratoire' as role FROM laboratories WHERE status = 'verified' AND is_active = TRUE`
        );

        for (const p of pros.rows) {
            try {
                await ensureCreditAccount(p.phone, p.role);
                await addCredits(p.phone, CREDIT_RULES[p.role]?.monthly || 150, 'Attribution mensuelle — partenaire Pro actif', 'earn');
                await pool.query(`UPDATE credits SET last_credited_at = NOW() WHERE phone = $1`, [p.phone]);
                results.distributed++;
                results.details.push({ phone: p.phone, amount: 150, role: p.role });
            } catch(e) { results.errors++; }
        }

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('credits.monthly_distribution', 'system', 'credits', NULL, $1)`,
            [JSON.stringify({ distributed: results.distributed, errors: results.errors })]
        ).catch(() => {});

        return res.json({ success: true, message: `Distribution effectuée : ${results.distributed} comptes crédités.`, data: results });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur distribution : ' + e.message });
    }
});

// ─── DÉPENSER DES CRÉDITS ─────────────────────────────────────────────────────
router.post('/spend', authMiddleware, async (req, res) => {
    const { phone, amount, partner_id, reason } = req.body;
    if (!phone || !amount || !partner_id) {
        return res.status(400).json({ success: false, message: 'phone, amount, partner_id requis.' });
    }

    try {
        const credit = await getCreditAccount(phone);
        if (!credit) return res.status(404).json({ success: false, message: 'Compte crédits introuvable.' });
        if (credit.balance < amount) return res.status(400).json({ success: false, message: `Solde insuffisant. Disponible : ${credit.balance} crédits.` });

        const partner = await pool.query(`SELECT * FROM credit_partners WHERE id = $1 AND is_active = TRUE`, [partner_id]);
        if (!partner.rows.length) return res.status(404).json({ success: false, message: 'Partenaire introuvable.' });

        const updated = await spendCredits(phone, parseInt(amount), reason || `Dépense chez ${partner.rows[0].name}`, partner_id);

        try {
            const discount = Math.floor(amount / 100) * partner.rows[0].discount_per_100_credits;
            await sendBolamuSms(phone, `Bolamu Credits : -${amount} crédits chez ${partner.rows[0].name}. Réduction obtenue : ${discount}%. Solde restant : ${updated.balance} crédits.`);
        } catch(e) {}

        return res.json({ success: true, message: `${amount} crédits dépensés.`, data: updated });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur : ' + e.message });
    }
});

// ─── LISTE DES PARTENAIRES ────────────────────────────────────────────────────
router.get('/partners', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM credit_partners WHERE is_active = TRUE ORDER BY category, name`);
        return res.json({ success: true, data: result.rows });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

// ─── ADMIN : TOUS LES COMPTES CRÉDITS ─────────────────────────────────────────
router.get('/admin/all', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, 
                    COALESCE(u.full_name, d.full_name, ph.name, l.name) as display_name
             FROM credits c
             LEFT JOIN users u ON u.phone = c.phone AND u.role = 'patient'
             LEFT JOIN doctors d ON d.phone = c.phone
             LEFT JOIN pharmacies ph ON ph.phone = c.phone
             LEFT JOIN laboratories l ON l.phone = c.phone
             ORDER BY c.balance DESC`
        );
        return res.json({ success: true, data: result.rows });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

// ─── ADMIN : GÉRER LES PARTENAIRES ────────────────────────────────────────────
router.post('/partners', authMiddleware, async (req, res) => {
    const { name, category, description, discount_per_100_credits, min_credits, city, partner_phone } = req.body;
    if (!name || !category) return res.status(400).json({ success: false, message: 'name et category requis.' });
    try {
        const result = await pool.query(
            `INSERT INTO credit_partners (name, category, description, discount_per_100_credits, min_credits, city, partner_phone)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [name, category, description||null, discount_per_100_credits||5, min_credits||100, city||'Brazzaville', partner_phone||null]
        );
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

router.patch('/partners/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { is_active, discount_per_100_credits } = req.body;
    try {
        const result = await pool.query(
            `UPDATE credit_partners SET is_active = COALESCE($1, is_active), discount_per_100_credits = COALESCE($2, discount_per_100_credits) WHERE id = $3 RETURNING *`,
            [is_active, discount_per_100_credits, id]
        );
        return res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

// ─── HELPERS INTERNES ─────────────────────────────────────────────────────────
async function ensureCreditAccount(phone, role) {
    if (!role) {
        const u = await pool.query(`SELECT role FROM users WHERE phone = $1`, [phone]);
        role = u.rows[0]?.role || 'patient';
    }
    await pool.query(
        `INSERT INTO credits (phone, role, balance, total_earned, total_spent, consecutive_months)
         VALUES ($1, $2, 0, 0, 0, 0) ON CONFLICT (phone) DO NOTHING`,
        [phone, role]
    );
}

async function getCreditAccount(phone) {
    const result = await pool.query(`SELECT * FROM credits WHERE phone = $1`, [phone]);
    return result.rows[0] || null;
}

async function addCredits(phone, amount, reason, type) {
    const updated = await pool.query(
        `UPDATE credits SET 
            balance = balance + $1,
            total_earned = CASE WHEN $3 = 'earn' THEN total_earned + $1 ELSE total_earned END,
            total_spent = CASE WHEN $3 = 'spend' THEN total_spent + $1 ELSE total_spent END,
            updated_at = NOW()
         WHERE phone = $2 RETURNING *`,
        [amount, phone, type]
    );
    const newBalance = updated.rows[0]?.balance || 0;
    await pool.query(
        `INSERT INTO credit_transactions (phone, type, amount, reason, balance_after) VALUES ($1, $2, $3, $4, $5)`,
        [phone, type, amount, reason, newBalance]
    );
    return updated.rows[0];
}

async function spendCredits(phone, amount, reason, partner_id) {
    const updated = await pool.query(
        `UPDATE credits SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW() WHERE phone = $2 RETURNING *`,
        [amount, phone]
    );
    const newBalance = updated.rows[0]?.balance || 0;
    await pool.query(
        `INSERT INTO credit_transactions (phone, type, amount, reason, partner_id, balance_after) VALUES ($1, 'spend', $2, $3, $4, $5)`,
        [phone, amount, reason, partner_id, newBalance]
    );
    return updated.rows[0];
}

module.exports = router;