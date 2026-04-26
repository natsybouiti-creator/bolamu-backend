const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/role.middleware');

// ─── CALCULER LES VERSEMENTS À FAIRE ─────────────────────────────────────────
// GET /api/v1/payouts/preview
// Retourne la liste des médecins avec leurs consultations non payées sur la période
router.get('/preview', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { period_start, period_end } = req.query;
        if (!period_start || !period_end) {
            return res.status(400).json({ success: false, message: 'period_start et period_end requis (YYYY-MM-DD).' });
        }

        // Récupérer les tarifs depuis platform_config
        const feeRes = await db.query(
            `SELECT config_key, config_value FROM platform_config 
             WHERE config_key IN ('fee_infirmier', 'fee_generaliste', 'fee_specialiste')`
        );
        const fees = {};
        feeRes.rows.forEach(r => { fees[r.config_key] = parseInt(r.config_value); });

        // Calculer les consultations par médecin sur la période
        const result = await db.query(
            `SELECT 
                d.phone,
                d.full_name,
                d.specialty,
                d.momo_number,
                COUNT(a.id) AS consultations_count,
                SUM(
                    CASE 
                        WHEN d.specialty ILIKE '%infirmier%' THEN $3
                        WHEN d.specialty ILIKE '%spécialiste%' OR d.specialty ILIKE '%specialiste%' THEN $4
                        ELSE $5
                    END
                ) AS amount_fcfa
             FROM doctors d
             LEFT JOIN appointments a 
                ON a.doctor_phone = d.phone
                AND a.status = 'completed'
                AND a.updated_at BETWEEN $1 AND $2
             WHERE d.is_active = TRUE
             GROUP BY d.phone, d.full_name, d.specialty, d.momo_number
             HAVING COUNT(a.id) > 0`,
            [period_start, period_end, 
             fees['fee_infirmier'] || 5000,
             fees['fee_specialiste'] || 15000,
             fees['fee_generaliste'] || 8000]
        );

        res.json({ success: true, period_start, period_end, doctors: result.rows });
    } catch (e) {
        console.error('GET /payouts/preview error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── INITIER UN VERSEMENT ─────────────────────────────────────────────────────
// POST /api/v1/payouts/initiate
router.post('/initiate', authMiddleware, adminOnly, async (req, res) => {
    const { doctor_phone, period_start, period_end, amount_fcfa, consultations_count, note } = req.body;
    if (!doctor_phone || !period_start || !period_end || !amount_fcfa) {
        return res.status(400).json({ success: false, message: 'doctor_phone, period_start, period_end, amount_fcfa requis.' });
    }
    try {
        // Vérifier que le médecin existe et a un momo_number
        const docRes = await db.query(
            `SELECT phone, full_name, momo_number FROM doctors WHERE phone = $1 AND is_active = TRUE`,
            [doctor_phone]
        );
        if (!docRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        }
        const doctor = docRes.rows[0];
        if (!doctor.momo_number) {
            return res.status(400).json({ success: false, message: 'Ce médecin n\'a pas de numéro MoMo enregistré.' });
        }

        // Vérifier qu'un versement n'existe pas déjà pour cette période
        const existRes = await db.query(
            `SELECT id FROM doctor_payouts 
             WHERE doctor_phone = $1 AND period_start = $2 AND period_end = $3 AND status != 'failed'`,
            [doctor_phone, period_start, period_end]
        );
        if (existRes.rows.length) {
            return res.status(400).json({ success: false, message: 'Un versement existe déjà pour cette période.' });
        }

        // Créer le versement en statut pending
        const payout = await db.query(
            `INSERT INTO doctor_payouts 
                (doctor_phone, amount_fcfa, consultations_count, period_start, period_end, status, momo_number, initiated_by, note)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
             RETURNING *`,
            [doctor_phone, amount_fcfa, consultations_count || 0, period_start, period_end, 
             doctor.momo_number, req.user.phone, note || null]
        );

        // Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payout.initiated', $1, 'doctor_payouts', $2, $3)`,
            [req.user.phone, payout.rows[0].id.toString(), JSON.stringify({
                doctor_phone, amount_fcfa, period_start, period_end
            })]
        ).catch(() => {});

        res.json({ success: true, message: 'Versement initié.', payout: payout.rows[0] });
    } catch (e) {
        console.error('POST /payouts/initiate error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── CONFIRMER UN VERSEMENT ───────────────────────────────────────────────────
// PATCH /api/v1/payouts/:id/confirm
router.patch('/:id/confirm', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { momo_reference } = req.body;
    try {
        const result = await db.query(
            `UPDATE doctor_payouts 
             SET status = 'paid', momo_reference = $1, updated_at = NOW()
             WHERE id = $2 AND status = 'pending'
             RETURNING *`,
            [momo_reference || null, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Versement introuvable ou déjà traité.' });
        }

        // Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payout.confirmed', $1, 'doctor_payouts', $2, $3)`,
            [req.user.phone, id, JSON.stringify({ momo_reference })]
        ).catch(() => {});

        res.json({ success: true, message: 'Versement confirmé.', payout: result.rows[0] });
    } catch (e) {
        console.error('PATCH /payouts/:id/confirm error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── HISTORIQUE DES VERSEMENTS ────────────────────────────────────────────────
// GET /api/v1/payouts/history
router.get('/history', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT dp.*, d.full_name, d.specialty
             FROM doctor_payouts dp
             JOIN doctors d ON d.phone = dp.doctor_phone
             ORDER BY dp.created_at DESC
             LIMIT 100`
        );
        res.json({ success: true, payouts: result.rows });
    } catch (e) {
        console.error('GET /payouts/history error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
