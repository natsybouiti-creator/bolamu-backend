const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/v1/map/intervenants — liste tous les intervenants avec coordonnées
router.get('/intervenants', async (req, res) => {
  try {
    // Médecins validés avec GPS
    const doctors = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
             d.specialty, d.consultation_fee, d.is_available,
             'doctor' as type
      FROM users u
      JOIN doctors d ON d.phone = u.phone
      WHERE u.is_active = true AND u.banned = false
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `);

    // Pharmacies validées avec GPS
    const pharmacies = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
             p.opening_hours,
             'pharmacie' as type
      FROM users u
      JOIN pharmacies p ON p.phone = u.phone
      WHERE u.is_active = true AND u.banned = false
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `);

    // Laboratoires validés avec GPS
    const labs = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
             l.examens_disponibles,
      'laboratoire' as type
      FROM users u
      JOIN laboratories l ON l.phone = u.phone
      WHERE u.is_active = true AND u.banned = false
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `);

    res.json({
      success: true,
      data: [...doctors.rows, ...pharmacies.rows, ...labs.rows]
    });
  } catch(e) {
    console.error('[map/intervenants]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/v1/map/position — intervenant met à jour sa position
router.patch('/position', async (req, res) => {
  const { phone, latitude, longitude, address } = req.body;
  if (!phone || !latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'phone, latitude et longitude requis' });
  }
  try {
    await pool.query(
      `UPDATE users SET latitude = $1, longitude = $2, address = $3 WHERE phone = $4`,
      [latitude, longitude, address || null, phone]
    );
    res.json({ success: true, message: 'Position mise à jour' });
  } catch(e) {
    console.error('[map/position]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
