// ============================================================
// BOLAMU — Sprint 6A : Service Leaderboard Hebdo
// ============================================================
const pool = require('../config/db');

/**
 * Calculer le classement hebdomadaire
 * Semaine : lundi 00h00 → dimanche 23h59
 */
async function computeWeeklyLeaderboard() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Début de semaine courante (lundi)
    const weekStartResult = await client.query(
      `SELECT date_trunc('week', NOW()) as week_start`
    );
    const weekStart = weekStartResult.rows[0].week_start;
    
    // Calculer les points gagnés cette semaine
    const pointsResult = await client.query(
      `SELECT phone, SUM(points) as points_earned
       FROM zora_ledger
       WHERE earned_at >= date_trunc('week', NOW())
         AND points > 0
       GROUP BY phone
       ORDER BY points_earned DESC
       LIMIT 100`
    );
    
    // UPSERT dans leaderboard_weekly
    for (let i = 0; i < pointsResult.rows.length; i++) {
      const row = pointsResult.rows[i];
      const rank = i + 1;
      
      await client.query(
        `INSERT INTO leaderboard_weekly (phone, week_start, points_earned, rank)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone, week_start) 
         DO UPDATE SET points_earned = $3, rank = $4`,
        [row.phone, weekStart, row.points_earned, rank]
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`[LEADERBOARD] Classement hebdo calculé : ${pointsResult.rows.length} joueurs`);
    
    return { success: true, count: pointsResult.rows.length };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[LEADERBOARD] Erreur computeWeeklyLeaderboard:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer le classement hebdo
 * @param {Object} params - { phone, limit }
 * @returns {Object} - { top, my_position }
 */
async function getLeaderboard({ phone, limit = 10 }) {
  try {
    const weekStartResult = await pool.query(
      `SELECT date_trunc('week', NOW()) as week_start`
    );
    const weekStart = weekStartResult.rows[0].week_start;
    
    // Top N
    const topResult = await pool.query(
      `SELECT lw.phone, lw.points_earned, lw.rank,
              u.first_name, u.last_name
       FROM leaderboard_weekly lw
       JOIN users u ON u.phone = lw.phone
       WHERE lw.week_start = $1
       ORDER BY lw.rank ASC
       LIMIT $2`,
      [weekStart, limit]
    );
    
    // Masquer les noms (Jean-Paul M. au lieu de Jean-Paul Martin)
    const top = topResult.rows.map(row => ({
      rank: row.rank,
      points_earned: row.points_earned,
      display_name: `${row.first_name} ${row.last_name ? row.last_name.charAt(0) + '.' : ''}`
    }));
    
    // Position du demandeur
    let myPosition = null;
    if (phone) {
      const myResult = await pool.query(
        `SELECT lw.rank, lw.points_earned
         FROM leaderboard_weekly lw
         WHERE lw.week_start = $1 AND lw.phone = $2`,
        [weekStart, phone]
      );
      
      if (myResult.rows.length > 0) {
        myPosition = {
          rank: myResult.rows[0].rank,
          points_earned: myResult.rows[0].points_earned
        };
      }
    }
    
    return { success: true, top, my_position: myPosition };
    
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getLeaderboard:', error);
    throw error;
  }
}

/**
 * Récupérer le top 3 sans auth (pour landing page)
 */
async function getTop3() {
  try {
    const weekStartResult = await pool.query(
      `SELECT date_trunc('week', NOW()) as week_start`
    );
    const weekStart = weekStartResult.rows[0].week_start;
    
    const result = await pool.query(
      `SELECT lw.rank, lw.points_earned,
              u.first_name, u.last_name
       FROM leaderboard_weekly lw
       JOIN users u ON u.phone = lw.phone
       WHERE lw.week_start = $1
       ORDER BY lw.rank ASC
       LIMIT 3`,
      [weekStart]
    );
    
    const top3 = result.rows.map(row => ({
      rank: row.rank,
      points_earned: row.points_earned,
      display_name: `${row.first_name} ${row.last_name ? row.last_name.charAt(0) + '.' : ''}`
    }));
    
    return { success: true, data: top3 };
    
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getTop3:', error);
    throw error;
  }
}

module.exports = {
  computeWeeklyLeaderboard,
  getLeaderboard,
  getTop3
};
