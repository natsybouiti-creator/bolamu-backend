// ============================================================
// BOLAMU — Sprint 2 : Clubs Controller
// ============================================================
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');

/**
 * GET /api/v1/clubs
 * Lister tous les clubs actifs
 */
async function getClubs(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, description, category, city, meeting_day, meeting_time, max_members, current_members, created_at
       FROM clubs
       WHERE is_active = TRUE
       ORDER BY name`
    );

    res.json({ success: true, clubs: result.rows });
  } catch (error) {
    logger.error('[CLUBS] Erreur getClubs:', error.message);
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
      `SELECT id, name, description, category, city, meeting_day, meeting_time, max_members, current_members, created_at
       FROM clubs
       WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Club introuvable' });
    }

    res.json({ success: true, club: result.rows[0] });
  } catch (error) {
    logger.error('[CLUBS] Erreur getClubById:', error.message);
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
      `SELECT id, name, max_members FROM clubs WHERE id = $1 AND is_active = TRUE`,
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

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('club_joined', $1, 'club_members', NULL, $2::jsonb)`,
      [normalizedPhone, JSON.stringify({ club_id: id, club_name: club.name })]
    );

    await client.query('COMMIT');

    logger.info(`[CLUBS] Patient ${normalizedPhone} a rejoint le club ${id}`);

    res.json({ success: true, message: 'Club rejoint avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[CLUBS] Erreur joinClub:', error.message);
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
      `SELECT id, name FROM clubs WHERE id = $1 AND is_active = TRUE`,
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

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('club_left', $1, 'club_members', NULL, $2::jsonb)`,
      [normalizedPhone, JSON.stringify({ club_id: id, club_name: club.name })]
    );

    await client.query('COMMIT');

    logger.info(`[CLUBS] Patient ${normalizedPhone} a quitté le club ${id}`);

    res.json({ success: true, message: 'Club quitté avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[CLUBS] Erreur leaveClub:', error.message);
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
      `SELECT c.id, c.name, c.description, c.category, c.city, c.meeting_day, c.meeting_time, cm.joined_at
       FROM clubs c
       JOIN club_members cm ON c.id = cm.club_id
       WHERE cm.patient_phone = $1 AND c.is_active = TRUE
       ORDER BY cm.joined_at DESC`,
      [normalizedPhone]
    );

    res.json({ success: true, clubs: result.rows });
  } catch (error) {
    logger.error('[CLUBS] Erreur getMyClubs:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getClubs,
  getClubById,
  joinClub,
  leaveClub,
  getMyClubs
};
