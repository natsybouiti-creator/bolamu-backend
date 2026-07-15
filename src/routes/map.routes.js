const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');

// GET /api/v1/map/intervenants — liste tous les intervenants avec coordonnées
router.get('/intervenants', async (req, res) => {
  try {
    // Médecins validés avec GPS
    // Corrigé (audit Gagner/Santé, 15 juillet 2026) : la requête référençait
    // d.consultation_fee / d.is_available, p.opening_hours, l.examens_disponibles
    // — colonnes inexistantes sur doctors/pharmacies/laboratories, ce qui faisait
    // échouer systématiquement les 3 requêtes (500 sur toute la route depuis sa
    // création). is_active vient désormais de la table spécifique du partenaire
    // (doctors/pharmacies/laboratories), jamais de users, conformément à la règle
    // absolue du projet.
    const doctors = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
             d.specialty,
             'doctor' as type
      FROM users u
      JOIN doctors d ON d.phone = u.phone
      WHERE d.is_active = true AND u.banned = false
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `);

    // Pharmacies validées avec GPS
    const pharmacies = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
             'pharmacie' as type
      FROM users u
      JOIN pharmacies p ON p.phone = u.phone
      WHERE p.is_active = true AND u.banned = false
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `);

    // Laboratoires validés avec GPS
    const labs = await pool.query(`
      SELECT u.phone, u.full_name, u.address, u.latitude, u.longitude,
      'laboratoire' as type
      FROM users u
      JOIN laboratories l ON l.phone = u.phone
      WHERE l.is_active = true AND u.banned = false
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
router.patch('/position', authMiddleware, async (req, res) => {
  const phone = normalizePhone(req.user.phone);
  const { latitude, longitude, address } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'latitude et longitude requis' });
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
