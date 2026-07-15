// ============================================================
// BOLAMU — Sprint 6A : Service Leaderboard Hebdo
// ============================================================
const pool = require('../config/db');

// Comptes de test QA (cf. CLAUDE.md "Comptes de test") exclus du classement —
// constaté le 15 juillet 2026 (audit Gagner/Santé) : le compte patient de test
// +242069735418 ("Antonio Test") occupait la 1ère place du classement hebdo
// réel, entièrement via des crédits Zora de test/audit, jamais des actions
// patient réelles.
const TEST_PHONES_EXCLUDED_FROM_LEADERBOARD = ['+242069735418', '+242069735419', '+242099999999'];

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

// Masquer les noms (Jean-Paul M. au lieu de Jean-Paul Martin) — logique
// identique des deux côtés (getLeaderboard/getTop3), factorisée.
function toDisplayName(fullName) {
  const parts = (fullName || 'Anonyme').trim().split(' ');
  const firstName = parts[0] || 'Anonyme';
  const lastNameInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) + '.' : '';
  return `${firstName} ${lastNameInitial}`.trim();
}

/**
 * Récupérer le classement hebdo — calcul live sur zora_ledger (source unique
 * de vérité, cf. audit du 13 juillet 2026 : la table leaderboard_weekly,
 * snapshot recalculé 1×/jour par le cron abonnement.job.js, divergeait de ce
 * calcul live utilisé par la modale "Voir tout", au point d'afficher des
 * rangs contradictoires pour le même patient dans la même session).
 * RANK() OVER (...) calculé sur l'ensemble des patients qualifiés (pas de
 * LIMIT en SQL) pour que my_position reste correct même au-delà du top
 * affiché ; le LIMIT demandé (10 par défaut) n'est appliqué qu'à `top`.
 * @param {Object} params - { phone, limit }
 * @returns {Object} - { top, my_position }
 */
async function getLeaderboard({ phone, limit = 10 }) {
  try {
    const rankedResult = await pool.query(
      `SELECT phone, full_name, photo_url, weekly_points, rank FROM (
         SELECT u.phone, u.full_name, u.photo_url, SUM(zl.points) as weekly_points,
                RANK() OVER (ORDER BY SUM(zl.points) DESC) as rank
         FROM users u
         JOIN zora_ledger zl ON zl.phone = u.phone
         WHERE u.role = 'patient'
           AND u.is_active = true
           AND u.phone <> ALL($1)
           AND zl.earned_at >= date_trunc('week', NOW())
         GROUP BY u.phone, u.full_name, u.photo_url
         HAVING SUM(zl.points) > 0
       ) ranked
       ORDER BY rank ASC`,
      [TEST_PHONES_EXCLUDED_FROM_LEADERBOARD]
    );

    const top = rankedResult.rows.slice(0, limit).map(row => ({
      rank: row.rank,
      phone: row.phone,
      display_name: toDisplayName(row.full_name),
      full_name: row.full_name,
      photo_url: row.photo_url,
      weekly_points: row.weekly_points
    }));

    let myPosition = null;
    if (phone) {
      const mine = rankedResult.rows.find(row => row.phone === phone);
      if (mine) {
        myPosition = { rank: mine.rank, weekly_points: mine.weekly_points };
      }
    }

    return { success: true, top, my_position: myPosition };

  } catch (error) {
    console.error('[LEADERBOARD] Erreur getLeaderboard:', error);
    throw error;
  }
}

/**
 * Récupérer le top 3 sans auth (pour landing page) — même source live que
 * getLeaderboard(), cf. commentaire ci-dessus. Route publique non
 * authentifiée : phone/full_name/photo_url volontairement exclus du retour
 * (confirmé orpheline côté frontend le 13 juillet 2026, mais on garde le
 * format minimal par prudence si elle est un jour consommée publiquement).
 */
async function getTop3() {
  try {
    const result = await pool.query(
      `SELECT phone, full_name, weekly_points, rank FROM (
         SELECT u.phone, u.full_name, SUM(zl.points) as weekly_points,
                RANK() OVER (ORDER BY SUM(zl.points) DESC) as rank
         FROM users u
         JOIN zora_ledger zl ON zl.phone = u.phone
         WHERE u.role = 'patient'
           AND u.is_active = true
           AND u.phone <> ALL($1)
           AND zl.earned_at >= date_trunc('week', NOW())
         GROUP BY u.phone, u.full_name
         HAVING SUM(zl.points) > 0
       ) ranked
       ORDER BY rank ASC
       LIMIT 3`,
      [TEST_PHONES_EXCLUDED_FROM_LEADERBOARD]
    );

    const top3 = result.rows.map(row => ({
      rank: row.rank,
      display_name: toDisplayName(row.full_name),
      weekly_points: row.weekly_points
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
  getTop3,
  toDisplayName,
  TEST_PHONES_EXCLUDED_FROM_LEADERBOARD
};
