// ============================================================
// BOLAMU — Sprint 2 : Clubs Controller
// ============================================================
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('../services/whatsapp-web.service');
// const logger = require('../config/logger');

/**
 * GET /api/v1/clubs
 * Lister tous les clubs actifs
 */
async function getClubs(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, description, category, sport_type, max_members, created_at
       FROM clubs
       WHERE is_active = TRUE
       ORDER BY name`
    );

    res.json({ success: true, clubs: result.rows });
  } catch (error) {
    console.error('[CLUBS] Erreur getClubs:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/clubs/:id
 * Détails d'un club
 */
async function getClubById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, description, category, sport_type, max_members, created_at
       FROM clubs
       WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Club introuvable' });
    }

    res.json({ success: true, club: result.rows[0] });
  } catch (error) {
    console.error('[CLUBS] Erreur getClubById:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/clubs/:id/join
 * Rejoindre un club
 */
async function joinClub(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { phone } = req.user;
    const normalizedPhone = normalizePhone(phone);

    // Vérifier que le club existe
    const clubResult = await client.query(
      `SELECT id, name, max_members, conversation_id FROM clubs WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (clubResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Club introuvable' });
    }

    const club = clubResult.rows[0];

    // Vérifier si déjà membre
    const existingMember = await client.query(
      `SELECT id FROM club_members WHERE club_id = $1 AND patient_phone = $2`,
      [id, normalizedPhone]
    );

    if (existingMember.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Déjà membre de ce club' });
    }

    // Ajouter comme membre
    await client.query(
      `INSERT INTO club_members (club_id, patient_phone, joined_at)
       VALUES ($1, $2, NOW())`,
      [id, normalizedPhone]
    );

    // Ajouter au chat interne du club, s'il existe
    if (club.conversation_id) {
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
         VALUES ($1, $2, 'member', NOW())
         ON CONFLICT DO NOTHING`,
        [club.conversation_id, normalizedPhone]
      );
    }

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('club_joined', $1, 'club_members', NULL, $2::jsonb)`,
      [normalizedPhone, JSON.stringify({ club_id: id, club_name: club.name })]
    );

    await client.query('COMMIT');

    console.log(`[CLUBS] Patient ${normalizedPhone} a rejoint le club ${id}`);

    // Envoyer WhatsApp notification (non bloquant)
    try {
      const userResult = await pool.query(
        `SELECT first_name FROM users WHERE phone = $1`,
        [normalizedPhone]
      );
      const prenom = userResult.rows[0]?.first_name || '';
      
      console.log('[WAHA] joinClub — envoi vers', normalizedPhone, 'template bolamu_club_bienvenue');
      await sendAutoMessage(normalizedPhone, 'bolamu_club_bienvenue', [
        prenom,
        club.name
      ]);
      console.log('[WAHA] joinClub — envoi OK');
    } catch (err) {
      console.error('[WAHA] joinClub — ERREUR:', err.message, err.stack);
      // Ne pas bloquer si WhatsApp échoue
    }

    // Post système automatique dans le feed réseau social (non bloquant)
    try {
      const feedService = require('../services/feed.service');
      await feedService.postClubJoined(normalizedPhone, club.name);
    } catch (feedError) {
      console.error('[CLUBS] Erreur post feed (non bloquante):', feedError.message);
    }

    res.json({ success: true, message: 'Club rejoint avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CLUBS] Erreur joinClub:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/v1/clubs/:id/join
 * Quitter un club
 */
async function leaveClub(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { phone } = req.user;
    const normalizedPhone = normalizePhone(phone);

    // Vérifier que le club existe
    const clubResult = await client.query(
      `SELECT id, name, conversation_id FROM clubs WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (clubResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Club introuvable' });
    }

    const club = clubResult.rows[0];

    // Vérifier si membre
    const existingMember = await client.query(
      `SELECT id FROM club_members WHERE club_id = $1 AND patient_phone = $2`,
      [id, normalizedPhone]
    );

    if (existingMember.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Pas membre de ce club' });
    }

    // Supprimer le membre
    await client.query(
      `DELETE FROM club_members WHERE club_id = $1 AND patient_phone = $2`,
      [id, normalizedPhone]
    );

    // Retirer du chat interne du club, s'il existe
    if (club.conversation_id) {
      await client.query(
        `DELETE FROM conversation_participants WHERE conversation_id = $1 AND participant_phone = $2`,
        [club.conversation_id, normalizedPhone]
      );
    }

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('club_left', $1, 'club_members', NULL, $2::jsonb)`,
      [normalizedPhone, JSON.stringify({ club_id: id, club_name: club.name })]
    );

    await client.query('COMMIT');

    console.log(`[CLUBS] Patient ${normalizedPhone} a quitté le club ${id}`);

    res.json({ success: true, message: 'Club quitté avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CLUBS] Erreur leaveClub:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/clubs/my
 * Mes clubs
 */
async function getMyClubs(req, res) {
  try {
    const { phone } = req.user;
    const normalizedPhone = normalizePhone(phone);

    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.category, c.sport_type, cm.joined_at
       FROM clubs c
       JOIN club_members cm ON c.id = cm.club_id
       WHERE cm.patient_phone = $1 AND c.is_active = TRUE
       ORDER BY cm.joined_at DESC`,
      [normalizedPhone]
    );

    res.json({ success: true, clubs: result.rows });
  } catch (error) {
    console.error('[CLUBS] Erreur getMyClubs:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/clubs/:id/messages
 * Messages du chat interne au club (membres uniquement)
 */
async function getClubMessages(req, res) {
  try {
    const { id } = req.params;
    const { phone } = req.user;
    const normalizedPhone = normalizePhone(phone);

    const clubResult = await pool.query(
      `SELECT conversation_id FROM clubs WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (clubResult.rows.length === 0 || !clubResult.rows[0].conversation_id) {
      return res.status(404).json({ success: false, message: 'Club ou conversation introuvable' });
    }

    const conversationId = clubResult.rows[0].conversation_id;

    const memberCheck = await pool.query(
      `SELECT id FROM conversation_participants WHERE conversation_id = $1 AND participant_phone = $2`,
      [conversationId, normalizedPhone]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux membres du club' });
    }

    const result = await pool.query(
      `SELECT m.id, m.sender_phone, m.content, m.sent_at, u.first_name, u.last_name
       FROM messages m
       LEFT JOIN users u ON m.sender_phone = u.phone
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       ORDER BY m.sent_at ASC`,
      [conversationId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[CLUBS] Erreur getClubMessages:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/clubs/:id/messages
 * Envoyer un message dans le chat interne au club (membres uniquement)
 */
async function sendClubMessage(req, res) {
  try {
    const { id } = req.params;
    const { phone } = req.user;
    const { content } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message vide' });
    }

    const clubResult = await pool.query(
      `SELECT conversation_id FROM clubs WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (clubResult.rows.length === 0 || !clubResult.rows[0].conversation_id) {
      return res.status(404).json({ success: false, message: 'Club ou conversation introuvable' });
    }

    const conversationId = clubResult.rows[0].conversation_id;

    const memberCheck = await pool.query(
      `SELECT id FROM conversation_participants WHERE conversation_id = $1 AND participant_phone = $2`,
      [conversationId, normalizedPhone]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux membres du club' });
    }

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_phone, content, type, sent_at, is_deleted)
       VALUES ($1, $2, $3, 'text', NOW(), false)
       RETURNING *`,
      [conversationId, normalizedPhone, content.trim()]
    );

    await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[CLUBS] Erreur sendClubMessage:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getClubs,
  getClubById,
  joinClub,
  leaveClub,
  getMyClubs,
  getClubMessages,
  sendClubMessage
};
