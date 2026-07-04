// ============================================================
// BOLAMU — Sprint 4 : Service Jeux Zora
// ============================================================
const crypto = require('crypto');
const pool = require('../config/db');
const { awardZora } = require('./zora.service');
const { sendAutoMessage } = require('./whatsapp-web.service');

/**
 * Vérifier les parties jouées aujourd'hui
 * @param {Object} params - { phone, game_id }
 * @returns {Object} - { free_plays_used, paid_plays_today, free_plays_remaining, daily_gain_today }
 */
async function checkDailyPlays({ phone, game_id }) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE play_type = 'free') as free_plays_used,
         COUNT(*) FILTER (WHERE play_type = 'paid') as paid_plays_today,
         COALESCE(SUM(points_won), 0) as daily_gain_today
       FROM zora_game_plays
       WHERE phone = $1 
         AND game_id = $2 
         AND played_at >= $3`,
      [phone, game_id, today]
    );
    
    const row = result.rows[0];
    const gameResult = await pool.query(
      'SELECT daily_free_plays FROM zora_games WHERE id = $1',
      [game_id]
    );
    const dailyFreePlays = gameResult.rows[0]?.daily_free_plays || 1;
    
    return {
      free_plays_used: parseInt(row.free_plays_used) || 0,
      paid_plays_today: parseInt(row.paid_plays_today) || 0,
      free_plays_remaining: Math.max(0, dailyFreePlays - (parseInt(row.free_plays_used) || 0)),
      daily_gain_today: parseInt(row.daily_gain_today) || 0
    };
  } catch (error) {
    console.error('[ZORA GAMES] Erreur checkDailyPlays:', error.message);
    throw error;
  }
}

/**
 * Jouer une partie (tirage serveur uniquement)
 * @param {Object} params - { phone, game_type, play_type }
 * @returns {Object} - { play_id, prize_label, points_won, server_seed, daily_gain_today, free_plays_remaining, question_id, question, option_a, option_b, option_c, option_d }
 */
async function playGame({ phone, game_type, play_type }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Charger le jeu
    const gameResult = await client.query(
      'SELECT * FROM zora_games WHERE game_type = $1 AND is_active = TRUE',
      [game_type]
    );
    
    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'game_not_found' };
    }
    
    const game = gameResult.rows[0];
    
    // ÉTAPE 2 — Vérifier les parties gratuites
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const playsResult = await client.query(
      `SELECT 
         COUNT(*) FILTER (WHERE play_type = 'free') as free_plays_used,
         COALESCE(SUM(points_won), 0) as daily_gain_today
       FROM zora_game_plays
       WHERE phone = $1 
         AND game_id = $2 
         AND played_at >= $3`,
      [phone, game.id, today]
    );
    
    const plays = playsResult.rows[0];
    const freePlaysUsed = parseInt(plays.free_plays_used) || 0;
    const dailyGainToday = parseInt(plays.daily_gain_today) || 0;
    
    let costPaid = 0;
    
    if (play_type === 'free') {
      if (freePlaysUsed >= game.daily_free_plays) {
        await client.query('ROLLBACK');
        return { success: false, error: 'free_play_already_used' };
      }
    } else if (play_type === 'paid') {
      // Vérifier balance
      const balanceResult = await client.query(
        'SELECT balance FROM zora_points WHERE phone = $1',
        [phone]
      );
      
      if (balanceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'user_not_found' };
      }
      
      const balance = balanceResult.rows[0].balance;
      
      if (balance < game.extra_play_cost) {
        await client.query('ROLLBACK');
        return { success: false, error: 'insufficient_balance' };
      }
      
      // Déduire le coût
      await client.query(
        'UPDATE zora_points SET balance = balance - $1 WHERE phone = $2',
        [game.extra_play_cost, phone]
      );
      
      // Insérer ledger négative — category est NOT NULL, expires_at requis
      await client.query(
        `INSERT INTO zora_ledger (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
         VALUES ($1, $2, 'plateforme', 'game_play_cost', 'system_event', 'game_engine', NULL, $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
        [phone, -game.extra_play_cost, crypto.randomBytes(16).toString('hex')]
      );
      
      costPaid = game.extra_play_cost;
    }
    
    // ÉTAPE 3 — Vérifier plafond gain journalier
    let pointsWon = 0;
    let prizeId = null;
    let prizeLabel = '';
    
    // Vérifier plafond global
    const globalCapResult = await client.query(
      'SELECT daily_total_cap FROM zora_games_global_cap WHERE id = 1'
    );
    const globalCap = globalCapResult.rows[0]?.daily_total_cap || 100;
    
    const totalGamesGainResult = await client.query(
      `SELECT COALESCE(SUM(points_won), 0) as total_games_gain
       FROM zora_game_plays
       WHERE phone = $1 AND played_at >= $2`,
      [phone, today]
    );
    const totalGamesGain = parseInt(totalGamesGainResult.rows[0]?.total_games_gain) || 0;
    
    const globalCapReached = totalGamesGain >= globalCap;
    const gameCapReached = dailyGainToday >= game.daily_gain_cap;
    
    // ÉTAPE 4 — TIRAGE SERVEUR
    const serverSeed = crypto.randomBytes(32).toString('hex');
    
    if (game_type === 'quiz') {
      // Sélectionner une question aléatoire non posée aujourd'hui
      const playedQuestionsResult = await client.query(
        `SELECT DISTINCT question_id 
         FROM zora_game_plays 
         WHERE phone = $1 AND game_id = $2 AND played_at >= $3`,
        [phone, game.id, today]
      );
      const playedQuestionIds = playedQuestionsResult.rows.map(r => r.question_id).filter(id => id);
      
      let questionQuery = 'SELECT * FROM zora_quiz_questions WHERE is_active = TRUE';
      const queryParams = [];
      
      if (playedQuestionIds.length > 0) {
        questionQuery += ' AND id NOT IN (' + playedQuestionIds.map((_, i) => `$${i + 1}`).join(',') + ')';
        queryParams.push(...playedQuestionIds);
      }
      
      questionQuery += ' ORDER BY RANDOM() LIMIT 1';
      
      const questionResult = await client.query(questionQuery, queryParams);
      
      if (questionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'no_questions_available' };
      }
      
      const question = questionResult.rows[0];
      
      // Enregistrer la partie quiz
      const playResult = await client.query(
        `INSERT INTO zora_game_plays (phone, game_id, play_type, cost_paid, points_won, server_seed, played_at, question_id)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         RETURNING id`,
        [phone, game.id, play_type, costPaid, 0, serverSeed, question.id]
      );
      
      await client.query('COMMIT');
      
      return {
        success: true,
        play_id: playResult.rows[0].id,
        question_id: question.id,
        question: question.question,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        server_seed: serverSeed,
        daily_gain_today: dailyGainToday,
        free_plays_remaining: Math.max(0, game.daily_free_plays - freePlaysUsed)
      };
    } else {
      // Tirage pondéré pour scratch, wheel, chest
      const prizesResult = await client.query(
        'SELECT * FROM zora_game_prizes WHERE game_id = $1 AND is_active = TRUE ORDER BY probability ASC',
        [game.id]
      );
      
      if (prizesResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'no_prizes_available' };
      }
      
      const prizes = prizesResult.rows;
      
      // Si plafond atteint, forcer gain à 0
      if (globalCapReached || gameCapReached) {
        const noGainPrize = prizes.find(p => p.points_value === 0);
        if (noGainPrize) {
          prizeId = noGainPrize.id;
          prizeLabel = noGainPrize.label_fr;
          pointsWon = 0;
        }
      } else {
        // Tirage pondéré
        const randomValue = Math.floor(Math.random() * 1000);
        let cumulative = 0;
        
        for (const prize of prizes) {
          cumulative += prize.probability;
          if (randomValue < cumulative) {
            prizeId = prize.id;
            prizeLabel = prize.label_fr;
            pointsWon = prize.points_value;
            break;
          }
        }
      }
      
      // ÉTAPE 5 — Enregistrer la partie
      const playResult = await client.query(
        `INSERT INTO zora_game_plays (phone, game_id, play_type, cost_paid, prize_id, points_won, server_seed, played_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [phone, game.id, play_type, costPaid, prizeId, pointsWon, serverSeed]
      );
      
      // ÉTAPE 6 — Créditer les points si gain > 0
      if (pointsWon > 0) {
        await awardZora({
          phone,
          action_type: 'game_' + game_type,
          proof_class: 'system_event',
          proof_source: 'game_engine',
          recording_method: null,
          proof_reference: playResult.rows[0].id.toString()
        });

        // Envoyer WhatsApp gain jeu Zora (non bloquant)
        setImmediate(async () => {
          try {
            const balanceResult = await pool.query(
              `SELECT balance FROM zora_points WHERE phone = $1`,
              [phone]
            );
            const solde = balanceResult.rows[0]?.balance || 0;

            const gameLabels = {
              scratch: 'carte à gratter',
              wheel: 'roue de la fortune',
              chest: 'coffre mystère',
              quiz: 'quiz santé'
            };

            await sendAutoMessage(phone, 'gain_jeu_zora', [
              pointsWon.toString(),
              gameLabels[game_type] || 'jeu',
              solde.toString()
            ]);
          } catch (whatsappErr) {
            console.error('[ZORA GAMES] Erreur envoi WhatsApp gain (non bloquante):', whatsappErr.message);
          }
        });
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        play_id: playResult.rows[0].id,
        prize_label: prizeLabel,
        points_won: pointsWon,
        server_seed: serverSeed,
        daily_gain_today: dailyGainToday + pointsWon,
        free_plays_remaining: Math.max(0, game.daily_free_plays - freePlaysUsed - 1)
      };
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA GAMES] Erreur playGame:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * Soumettre la réponse au quiz
 * @param {Object} params - { phone, play_id, answer }
 * @returns {Object} - { correct, correct_answer, points_won }
 */
async function submitQuizAnswer({ phone, play_id, answer }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Charger la partie
    const playResult = await client.query(
      `SELECT gp.*, g.game_type, q.correct_answer, q.difficulty
       FROM zora_game_plays gp
       JOIN zora_games g ON gp.game_id = g.id
       LEFT JOIN zora_quiz_questions q ON gp.question_id = q.id
       WHERE gp.id = $1 AND gp.phone = $2 AND gp.points_won = 0`,
      [play_id, phone]
    );
    
    if (playResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'play_not_found' };
    }
    
    const play = playResult.rows[0];
    
    // ÉTAPE 2 — Vérifier délai (5 minutes)
    const playedAt = new Date(play.played_at);
    const now = new Date();
    const diffMinutes = (now - playedAt) / 60000;
    
    if (diffMinutes > 5) {
      await client.query('ROLLBACK');
      return { success: false, error: 'answer_timeout' };
    }
    
    // ÉTAPE 3 — Vérifier la réponse
    const isCorrect = answer.toLowerCase() === play.correct_answer.toLowerCase();
    
    // ÉTAPE 4 — Calculer le gain
    let pointsWon = 0;
    if (isCorrect) {
      switch (play.difficulty) {
        case 'facile':
          pointsWon = 10;
          break;
        case 'moyen':
          pointsWon = 20;
          break;
        case 'difficile':
          pointsWon = 40;
          break;
        default:
          pointsWon = 10;
      }
    }
    
    // ÉTAPE 5 — Mettre à jour + créditer
    await client.query(
      'UPDATE zora_game_plays SET points_won = $1 WHERE id = $2',
      [pointsWon, play_id]
    );
    
    if (pointsWon > 0) {
      await awardZora({
        phone,
        action_type: 'game_quiz',
        proof_class: 'system_event',
        proof_source: 'game_engine',
        recording_method: null,
        proof_reference: play_id.toString()
      });
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      correct: isCorrect,
      correct_answer: play.correct_answer,
      points_won: pointsWon
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA GAMES] Erreur submitQuizAnswer:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * Obtenir la configuration des jeux
 * @returns {Object} - { success, data: [games] }
 */
async function getGamesConfig() {
  try {
    const result = await pool.query(
      'SELECT * FROM zora_games WHERE is_active = TRUE ORDER BY id'
    );
    
    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    console.error('[ZORA GAMES] Erreur getGamesConfig:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * Obtenir le statut des jeux pour un utilisateur
 * @param {Object} params - { phone }
 * @returns {Object} - { success, data: [game_status] }
 */
async function getGamesStatus({ phone }) {
  try {
    const gamesResult = await pool.query(
      'SELECT * FROM zora_games WHERE is_active = TRUE ORDER BY id'
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const statusPromises = gamesResult.rows.map(async (game) => {
      const playsResult = await pool.query(
        `SELECT 
           COUNT(*) FILTER (WHERE play_type = 'free') as free_plays_used,
           COALESCE(SUM(points_won), 0) as daily_gain_today
         FROM zora_game_plays
         WHERE phone = $1 
           AND game_id = $2 
           AND played_at >= $3`,
        [phone, game.id, today]
      );
      
      const plays = playsResult.rows[0];
      const freePlaysUsed = parseInt(plays.free_plays_used) || 0;
      const dailyGainToday = parseInt(plays.daily_gain_today) || 0;
      
      // Vérifier balance pour partie payante
      const balanceResult = await pool.query(
        'SELECT balance FROM zora_points WHERE phone = $1',
        [phone]
      );
      const balance = balanceResult.rows[0]?.balance || 0;
      
      return {
        game_type: game.game_type,
        label_fr: game.label_fr,
        daily_free_plays: game.daily_free_plays,
        extra_play_cost: game.extra_play_cost,
        max_gain_per_play: game.max_gain_per_play,
        daily_gain_cap: game.daily_gain_cap,
        free_plays_remaining: Math.max(0, game.daily_free_plays - freePlaysUsed),
        daily_gain_today: dailyGainToday,
        can_play_free: freePlaysUsed < game.daily_free_plays,
        can_play_paid: balance >= game.extra_play_cost
      };
    });
    
    const status = await Promise.all(statusPromises);
    
    return {
      success: true,
      data: status
    };
  } catch (error) {
    console.error('[ZORA GAMES] Erreur getGamesStatus:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * Obtenir l'historique des parties
 * @param {Object} params - { phone, limit }
 * @returns {Object} - { success, data: [plays] }
 */
async function getGamesHistory({ phone, limit = 30 }) {
  try {
    const result = await pool.query(
      `SELECT gp.*, g.game_type, g.label_fr, p.label_fr as prize_label
       FROM zora_game_plays gp
       JOIN zora_games g ON gp.game_id = g.id
       LEFT JOIN zora_game_prizes p ON gp.prize_id = p.id
       WHERE gp.phone = $1
       ORDER BY gp.played_at DESC
       LIMIT $2`,
      [phone, limit]
    );
    
    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    console.error('[ZORA GAMES] Erreur getGamesHistory:', error.message);
    return { success: false, error: 'server_error' };
  }
}

module.exports = {
  checkDailyPlays,
  playGame,
  submitQuizAnswer,
  getGamesConfig,
  getGamesStatus,
  getGamesHistory
};
