// ============================================================
// BOLAMU — Routes Admin
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');

// Stats patients
router.get('/stats/patients', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
        res.json({ success: true, count: parseInt(r.rows[0].count) });
    } catch (e) { res.status(500).json({ success: false, count: 0 }); }
});

// Stats appointments
router.get('/stats/appointments', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Tous les utilisateurs par rôle
router.get('/users', authMiddleware, async (req, res) => {
    const { role } = req.query;
    try {
        const params = [];
        let where = '';
        if (role) { params.push(role); where = `WHERE role = $1`; }
        const r = await pool.query(
            `SELECT id, phone, full_name, role, bolamu_id, city, is_active, created_at FROM users ${where} ORDER BY created_at DESC`,
            params
        );
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Bannir / Réactiver un utilisateur
router.patch('/users/:phone/toggle', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    const { is_active } = req.body;
    try {
        const r = await pool.query(
            `UPDATE users SET is_active = $1 WHERE phone = $2 RETURNING phone, full_name, is_active`,
            [is_active, decodeURIComponent(phone)]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1, $2, 'users', NULL, $3)`,
            [is_active ? 'user.reactivated' : 'user.banned', decodeURIComponent(phone), JSON.stringify({ is_active })]
        ).catch(() => {});
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Tous les RDV
router.get('/appointments', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Toutes les prescriptions
router.get('/prescriptions', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM prescriptions ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Signaux fraude
router.get('/fraud', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM fraud_signals ORDER BY created_at DESC`);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Journal audit
router.get('/audit', authMiddleware, async (req, res) => {
    const { event_type, limit = 300 } = req.query;
    try {
        const params = [];
        let where = '';
        if (event_type) { params.push(event_type); where = `WHERE event_type = $1`; }
        const r = await pool.query(
            `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)}`,
            params
        );
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Lire la configuration
router.get('/config', authMiddleware, async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM platform_config ORDER BY id`);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Modifier la configuration
router.post('/config', authMiddleware, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ success: false, message: 'key et value requis.' });
    try {
        const r = await pool.query(
            `INSERT INTO platform_config (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2
             RETURNING *`,
            [key, String(value)]
        );
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('config.updated', $1, 'platform_config', NULL, $2)`,
            ['admin', JSON.stringify({ key, value })]
        ).catch(() => {});
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;