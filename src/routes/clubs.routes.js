// ============================================================
// BOLAMU — Sprint 2 : Clubs Routes
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getClubs,
  getClubById,
  joinClub,
  leaveClub,
  getMyClubs
} = require('../controllers/clubs.controller');

// Public
router.get('/', getClubs);
router.get('/:id', getClubById);

// Patient connecté
router.post('/:id/join', authMiddleware, joinClub);
router.delete('/:id/join', authMiddleware, leaveClub);
router.get('/my', authMiddleware, getMyClubs);

// Patient connecté - Liste des membres du club avec Zora points
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/db');
    const clubId = req.params.id;
    
    const result = await pool.query(`
      SELECT u.phone, u.nom, u.prenom,
        COALESCE(SUM(zl.points), 0) AS zora_points
      FROM club_members cm
      JOIN users u ON u.phone = cm.user_phone
      LEFT JOIN zora_ledger zl ON zl.user_phone = cm.user_phone
      WHERE cm.club_id = $1
      GROUP BY u.phone, u.nom, u.prenom
      ORDER BY zora_points DESC
    `, [clubId]);
    
    const members = result.rows.map(m => ({
      phone: m.phone,
      full_name: `${m.prenom || ''} ${m.nom || ''}`.trim() || 'Membre',
      zora_points: parseInt(m.zora_points) || 0
    }));
    
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
