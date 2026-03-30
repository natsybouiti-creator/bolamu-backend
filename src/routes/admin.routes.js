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
        const result = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (e) { res.status(500).json({ success: false, count: 0 }); }
});

// Stats appointments
router.get('/stats/appointments', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Tous les utilisateurs par rôle
router.get('/users', authMiddleware, async (req, res) => {
    const { role } = req.query;
    try {
        const conditions = role ? `WHERE role = '${role}'` : '';
        const result = await pool.query(`SELECT id, phone, full_name, role, bolamu_id, city, is_active, created_at FROM users ${conditions} ORDER BY created_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Tous les RDV
router.get('/appointments', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Toutes les prescriptions
router.get('/prescriptions', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM prescriptions ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Signaux fraude
router.get('/fraud', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM fraud_signals ORDER BY created_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// Journal audit
router.get('/audit', authMiddleware, async (req, res) => {
    const { event_type, limit = 200 } = req.query;
    try {
        let query = `SELECT * FROM audit_log`;
        const params = [];
        if (event_type) { query += ` WHERE event_type = $1`; params.push(event_type); }
        query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

module.exports = router;