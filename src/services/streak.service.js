// ============================================================
// BOLAMU — Sprint 6A : Service Streaks
// ============================================================
const pool = require('../config/db');

/**
 * Mettre à jour le streak d'un utilisateur
 * @param {Object} params - { phone }
 * @returns {Object} - { current_streak, longest_streak, bonus_awarded }
 */
async function updateStreak({ phone }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Charger le streak actuel
    const streakResult = await client.query(
      `SELECT current_streak, longest_streak, last_activity_date
       FROM user_streaks
       WHERE phone = $1`,
      [phone]
    );
    
    let currentStreak = 0;
    let longestStreak = 0;
    let lastActivityDate = null;
    let isNewUser = streakResult.rows.length === 0;
    
    if (!isNewUser) {
      currentStreak = streakResult.rows[0].current_streak;
      longestStreak = streakResult.rows[0].longest_streak;
      lastActivityDate = streakResult.rows[0].last_activity_date;
    }
    
    // Logique de streak
    if (isNewUser) {
      // Premier gain = streak 1
      currentStreak = 1;
      longestStreak = 1;
    } else if (lastActivityDate) {
      const lastDate = new Date(lastActivityDate);
      lastDate.setHours(0, 0, 0, 0);
      
      if (lastDate.getTime() === yesterday.getTime()) {
        // Activité hier = streak + 1
        currentStreak += 1;
      } else if (lastDate.getTime() === today.getTime()) {
        // Activité déjà aujourd'hui = ne rien changer
      } else {
        // Activité avant-hier ou plus = reset à 1
        currentStreak = 1;
      }
      
      // Mettre à jour longest_streak
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else {
      // Pas de last_activity_date = premier gain
      currentStreak = 1;
      longestStreak = 1;
    }
    
    // UPSERT user_streaks
    await client.query(
      `INSERT INTO user_streaks (phone, current_streak, longest_streak, last_activity_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (phone) 
       DO UPDATE SET current_streak = $2, longest_streak = $3, last_activity_date = $4`,
      [phone, currentStreak, longestStreak, today]
    );
    
    await client.query('COMMIT');
    
    // Bonus streak (non bloquant, hors transaction)
    let bonusAwarded = null;
    setImmediate(async () => {
      try {
        const { awardZora } = require('./zora.service');
        if (currentStreak === 7) {
          const result = await awardZora({
            phone,
            action_type: 'streak_7',
            proof_class: 'system_event',
            proof_source: 'streak_engine',
            proof_reference: currentStreak.toString()
          });
          if (result.success) bonusAwarded = { type: 'streak_7', points: 100 };
        } else if (currentStreak === 30) {
          const result = await awardZora({
            phone,
            action_type: 'streak_30',
            proof_class: 'system_event',
            proof_source: 'streak_engine',
            proof_reference: currentStreak.toString()
          });
          if (result.success) bonusAwarded = { type: 'streak_30', points: 500 };
        }
      } catch (bonusErr) {
        console.error('[STREAK] Erreur bonus (non bloquante):', bonusErr.message);
      }
    });
    
    return {
      success: true,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
      bonus_awarded: bonusAwarded
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[STREAK] Erreur updateStreak:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer le streak d'un utilisateur
 * @param {Object} params - { phone }
 * @returns {Object} - { current_streak, longest_streak, last_activity_date, next_bonus_at }
 */
async function getStreak({ phone }) {
  try {
    const result = await pool.query(
      `SELECT current_streak, longest_streak, last_activity_date
       FROM user_streaks
       WHERE phone = $1`,
      [phone]
    );
    
    if (result.rows.length === 0) {
      return {
        success: true,
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: null,
        next_bonus_at: 7
      };
    }
    
    const streak = result.rows[0];
    let nextBonusAt = 7;
    if (streak.current_streak >= 7) nextBonusAt = 30;
    if (streak.current_streak >= 30) nextBonusAt = null;
    
    return {
      success: true,
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_activity_date: streak.last_activity_date,
      next_bonus_at: nextBonusAt
    };
    
  } catch (error) {
    console.error('[STREAK] Erreur getStreak:', error);
    throw error;
  }
}

module.exports = {
  updateStreak,
  getStreak
};
