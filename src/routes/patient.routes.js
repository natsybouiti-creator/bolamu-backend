const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');

const cheminCerveau = path.join(__dirname, '..', 'controllers', 'patient.controller.js');
const { registerPatient, getSubscription } = require(cheminCerveau);

router.post('/register', registerPatient);
router.get('/subscription', getSubscription);

router.get('/profil', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis' });
    const result = await pool.query(
      `SELECT phone, full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at
       FROM users WHERE phone = $1 AND role = 'patient'`,
      [phone]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Patient introuvable' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/check-subscription', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis' });
    const result = await pool.query(
      `SELECT status, plan, expires_at FROM subscriptions
       WHERE phone = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [phone]
    );
    res.json({
      success: true,
      has_active_subscription: result.rows.length > 0,
      subscription: result.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;