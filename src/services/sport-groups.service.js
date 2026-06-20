// ============================================================
// Service : Groupes de sport
// ============================================================

const pool = require('../config/db');

/**
 * Rejoindre un groupe de sport
 */
async function joinGroup({ phone, group_id }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Vérifier si déjà membre
    const existingMember = await client.query(
      'SELECT id FROM sport_group_members WHERE group_id = $1 AND phone = $2',
      [group_id, phone]
    );

    if (existingMember.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Déjà membre du groupe' };
    }

    // Ajouter le membre
    await client.query(
      'INSERT INTO sport_group_members (group_id, phone) VALUES ($1, $2)',
      [group_id, phone]
    );

    // Incrémenter le compteur de membres
    await client.query(
      'UPDATE sport_groups SET member_count = member_count + 1 WHERE id = $1',
      [group_id]
    );

    await client.query('COMMIT');

    // Récupérer le nouveau compteur
    const groupResult = await pool.query(
      'SELECT member_count FROM sport_groups WHERE id = $1',
      [group_id]
    );

    return {
      success: true,
      member_count: groupResult.rows[0].member_count
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining group:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Quitter un groupe de sport
 */
async function leaveGroup({ phone, group_id }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Supprimer le membre
    const result = await client.query(
      'DELETE FROM sport_group_members WHERE group_id = $1 AND phone = $2 RETURNING id',
      [group_id, phone]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Pas membre du groupe' };
    }

    // Décrémenter le compteur de membres
    await client.query(
      'UPDATE sport_groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1',
      [group_id]
    );

    await client.query('COMMIT');

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error leaving group:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lister les groupes de sport
 */
async function getGroups({ phone, city }) {
  let query = `
    SELECT
      sg.id,
      sg.name,
      sg.sport_type,
      sg.icon_name,
      sg.color_token,
      sg.description,
      sg.city,
      sg.member_count,
      sg.weekly_score,
      CASE WHEN sgm.phone IS NOT NULL THEN true ELSE false END as is_member
    FROM sport_groups sg
    LEFT JOIN sport_group_members sgm ON sg.id = sgm.group_id AND sgm.phone = $1
    WHERE sg.is_active = true
  `;

  const params = [phone];

  if (city) {
    query += ' AND sg.city = $2';
    params.push(city);
  }

  query += ' ORDER BY sg.member_count DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Mettre à jour le score d'un groupe
 */
async function updateGroupScore({ group_id, points, phone }) {
  await pool.query(
    'UPDATE sport_groups SET weekly_score = weekly_score + $1 WHERE id = $2',
    [points, group_id]
  );

  await pool.query(
    'UPDATE sport_group_members SET weekly_contribution = weekly_contribution + $1 WHERE group_id = $2 AND phone = $3',
    [points, group_id, phone]
  );
}

/**
 * Obtenir les top membres d'un groupe
 */
async function getGroupMembers({ group_id, limit = 10 }) {
  const result = await pool.query(
    `
    SELECT
      sgm.phone,
      u.full_name,
      sgm.weekly_contribution,
      sgm.joined_at
    FROM sport_group_members sgm
    JOIN users u ON sgm.phone = u.phone
    WHERE sgm.group_id = $1
    ORDER BY sgm.weekly_contribution DESC
    LIMIT $2
    `,
    [group_id, limit]
  );

  return result.rows;
}

/**
 * Reset hebdo des scores (cron lundi 02h00)
 */
async function resetWeeklyScores() {
  await pool.query('UPDATE sport_groups SET weekly_score = 0');
  await pool.query('UPDATE sport_group_members SET weekly_contribution = 0');
}

module.exports = {
  joinGroup,
  leaveGroup,
  getGroups,
  updateGroupScore,
  getGroupMembers,
  resetWeeklyScores
};
