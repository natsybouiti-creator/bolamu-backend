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
  getMyClubs,
  getClubMessages,
  sendClubMessage
} = require('../controllers/clubs.controller');

// Public
router.get('/', getClubs);
router.get('/:id', getClubById);

// Patient connecté
router.post('/:id/join', authMiddleware, joinClub);
router.delete('/:id/join', authMiddleware, leaveClub);
router.get('/my', authMiddleware, getMyClubs);

// Chat interne au club (membres uniquement)
router.get('/:id/messages', authMiddleware, getClubMessages);
router.post('/:id/messages', authMiddleware, sendClubMessage);

// Créer un club
router.post('/', authMiddleware, async (req, res) => {
  const pool = require('../config/db');
  const client = await pool.connect();
  try {
    const { name, description, category, sport_type } = req.body;
    const myPhone = req.user.phone;

    if (!name) {
      client.release();
      return res.status(400).json({ success: false, message: 'name requis' });
    }

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO clubs (name, description, category, animateur_phone, created_at, is_active)
      VALUES ($1, $2, $3, $4, NOW(), true)
      RETURNING id, name, description, category
    `, [name, description || category || sport_type || 'Sport', category || sport_type || 'Sport', myPhone]);

    const club = result.rows[0];

    // Créer la conversation de chat du club et y ajouter le créateur
    const convResult = await client.query(`
      INSERT INTO conversations (type, club_id, title, created_at, is_active)
      VALUES ('club', $1, $2, NOW(), true)
      RETURNING id
    `, [club.id, name]);

    const conversationId = convResult.rows[0].id;

    await client.query(`UPDATE clubs SET conversation_id = $1 WHERE id = $2`, [conversationId, club.id]);

    await client.query(`
      INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
      VALUES ($1, $2, 'admin', NOW())
    `, [conversationId, myPhone]);

    await client.query('COMMIT');

    res.json({ success: true, data: { ...club, conversation_id: conversationId } });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Patient connecté - Liste des membres du club avec Zora points
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/db');
    const clubId = req.params.id;
    
    const result = await pool.query(`
      SELECT u.phone, u.first_name, u.last_name,
        COALESCE(SUM(zl.points), 0) AS zora_points
      FROM club_members cm
      JOIN users u ON u.phone = cm.patient_phone
      LEFT JOIN zora_ledger zl ON zl.phone = cm.patient_phone
      WHERE cm.club_id = $1
      GROUP BY u.phone, u.first_name, u.last_name
      ORDER BY zora_points DESC
    `, [clubId]);
    
    const members = result.rows.map(m => ({
      phone: m.phone,
      full_name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Membre',
      zora_points: parseInt(m.zora_points) || 0
    }));
    
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
