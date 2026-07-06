const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { recalculateBalance } = require('./zora.service');
const { notify } = require('./notification.service');

function validateGroupInput(name, sport) {
  // Longueur
  if (!name || name.length < 3 || name.length > 50) {
    throw new Error('Nom invalide (3-50 caractères)');
  }
  // Caractères interdits (SQL injection)
  const forbidden = /[';"\-\-\/\*\\]/;
  if (forbidden.test(name)) {
    throw new Error('Caractères non autorisés dans le nom');
  }
  // Sports autorisés uniquement
  const sportsAutorises = [
    'Football', 'Basketball', 'Tennis',
    'Natation', 'Course', 'Cyclisme', 'Autre'
  ];
  if (!sportsAutorises.includes(sport)) {
    throw new Error('Sport non autorisé');
  }
}

async function getSportGroups() {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function createSportGroup(name, sport, description, phone) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function joinGroup(phone, groupId) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function leaveGroup(phone, groupId) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function getGroupMembers(groupId) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function getClubs() {
  const result = await pool.query(
    `SELECT c.*, COUNT(cm.phone) as member_count
     FROM clubs c
     LEFT JOIN club_members cm ON c.id = cm.club_id
     WHERE c.is_active = true
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

async function createClub(name, description, sport, phone) {
  const normalizedPhone = normalizePhone(phone);
  const result = await pool.query(
    `INSERT INTO clubs (name, description, sport, created_by, is_active, created_at)
     VALUES ($1, $2, $3, $4, true, NOW())
     RETURNING *`,
    [name, description, sport, normalizedPhone]
  );
  return result.rows[0];
}

async function joinClub(phone, clubId) {
  const normalizedPhone = normalizePhone(phone);
  
  const existingMember = await pool.query(
    'SELECT id FROM club_members WHERE club_id = $1 AND phone = $2',
    [clubId, normalizedPhone]
  );
  
  if (existingMember.rows.length > 0) {
    throw new Error('ALREADY_MEMBER');
  }
  
  await pool.query(
    `INSERT INTO club_members (club_id, phone, joined_at)
     VALUES ($1, $2, NOW())`,
    [clubId, normalizedPhone]
  );
  
  return { success: true };
}

async function getLeaderboard() {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function getGroupLeaderboard(groupId) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function getMessages(conversationId, phone) {
  // Si phone fourni, vérifier que l'utilisateur est membre
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const memberCheck = await pool.query(
      `SELECT id FROM conversation_participants 
       WHERE conversation_id = $1 AND participant_phone = $2`,
      [conversationId, normalizedPhone]
    );
    
    if (memberCheck.rows.length === 0) {
      throw new Error('NOT_MEMBER');
    }
  }
  
  const result = await pool.query(
    `SELECT m.*, u.first_name, u.last_name
     FROM messages m
     LEFT JOIN users u ON m.sender_phone = u.phone
     WHERE m.conversation_id = $1 AND m.is_deleted = false
     ORDER BY m.sent_at ASC`,
    [conversationId]
  );
  return result.rows;
}

async function sendMessage(phone, conversationId, content) {
  const normalizedPhone = normalizePhone(phone);
  
  // Vérifier que l'utilisateur est membre de la conversation
  const memberCheck = await pool.query(
    `SELECT id FROM conversation_participants 
     WHERE conversation_id = $1 AND participant_phone = $2`,
    [conversationId, normalizedPhone]
  );
  
  if (memberCheck.rows.length === 0) {
    throw new Error('NOT_MEMBER');
  }
  
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_phone, content, type, sent_at, is_deleted)
     VALUES ($1, $2, $3, 'text', NOW(), false)
     RETURNING *`,
    [conversationId, normalizedPhone, content]
  );
  
  // Émettre via Socket.io
  try {
    const { emitToRoom } = require('./socketService');
    emitToRoom(conversationId, 'new_message', result.rows[0]);
  } catch (socketErr) {
    console.error('[Socket.io] Échec émission new_message:', socketErr.message);
    // ne jamais faire échouer l'envoi du message
  }
  
  return result.rows[0];
}

async function getStreak(phone) {
  const normalizedPhone = normalizePhone(phone);
  const result = await pool.query(
    'SELECT * FROM user_streaks WHERE phone = $1',
    [normalizedPhone]
  );
  
  if (result.rows.length === 0) {
    return {
      phone: normalizedPhone,
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null
    };
  }
  
  return result.rows[0];
}

async function updateStreak(phone) {
  const normalizedPhone = normalizePhone(phone);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const streakResult = await client.query(
      'SELECT * FROM user_streaks WHERE phone = $1',
      [normalizedPhone]
    );
    
    let currentStreak = 1;
    let longestStreak = 0;
    
    if (streakResult.rows.length > 0) {
      const streak = streakResult.rows[0];
      const lastActivity = streak.last_activity_date ? streak.last_activity_date.toISOString().split('T')[0] : null;
      
      if (lastActivity === today) {
        // Déjà compté aujourd'hui
        await client.query('ROLLBACK');
        return streak;
      } else if (lastActivity === yesterday) {
        currentStreak = streak.current_streak + 1;
      } else {
        currentStreak = 1;
      }
      
      longestStreak = Math.max(streak.longest_streak, currentStreak);
      
      await client.query(
        `UPDATE user_streaks 
         SET current_streak = $1, longest_streak = $2, last_activity_date = $3, updated_at = NOW()
         WHERE phone = $4`,
        [currentStreak, longestStreak, today, normalizedPhone]
      );
    } else {
      await client.query(
        `INSERT INTO user_streaks (phone, current_streak, longest_streak, last_activity_date, updated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [normalizedPhone, currentStreak, longestStreak, today]
      );
    }
    
    await client.query('COMMIT');

    return {
      phone: normalizedPhone,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: today
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateLeaderboard(phone, groupId, points) {
  // DÉPRÉCIÉ - Tables sport_groups et sport_group_members supprimées (migration_064)
  // Système remplacé par clubs/club_members (voir getClubs, createClub, joinClub)
  // Routes sport-groups.routes.DEPRECATED.js neutralisées avec 410 Gone
  throw new Error('Sport groups system deprecated - use clubs/club_members instead');
}

async function encourageMember(fromPhone, targetPhone) {
  const normalizedFrom = normalizePhone(fromPhone);
  const normalizedTarget = normalizePhone(targetPhone);

  // Vérifier que le destinataire existe et est un patient
  const targetRoleResult = await pool.query(
    'SELECT role FROM users WHERE phone = $1',
    [normalizedTarget]
  );

  if (targetRoleResult.rows.length === 0) {
    throw new Error('TARGET_NOT_FOUND');
  }

  if (targetRoleResult.rows[0].role !== 'patient') {
    throw new Error('TARGET_NOT_PATIENT');
  }

  // Vérifier rate limiting : 1 pouce par expéditeur → destinataire par 24h
  const existingEncouragement = await pool.query(
    `SELECT COUNT(*) as count
     FROM leaderboard_encouragements
     WHERE from_phone = $1 AND target_phone = $2
       AND created_at >= NOW() - INTERVAL '24 hours'`,
    [normalizedFrom, normalizedTarget]
  );

  if (parseInt(existingEncouragement.rows[0].count) > 0) {
    throw new Error('ALREADY_ENCOURAGED_TODAY');
  }

  // Récupérer le nom de l'expéditeur pour la notification
  const senderResult = await pool.query(
    'SELECT first_name, full_name FROM users WHERE phone = $1',
    [normalizedFrom]
  );
  const senderName = senderResult.rows[0]?.first_name || senderResult.rows[0]?.full_name || 'Un membre';

  const result = await pool.query(
    `INSERT INTO leaderboard_encouragements (from_phone, target_phone, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id`,
    [normalizedFrom, normalizedTarget]
  );

  // Envoyer notification WhatsApp au destinataire
  setImmediate(async () => {
    try {
      await notify(normalizedTarget, 'encouragement', {
        sender_name: senderName,
        sender_phone: normalizedFrom
      });
    } catch (err) {
      console.error('[Community] Erreur notification encouragement:', err.message);
    }
  });

  return { success: true, id: result.rows[0].id };
}

async function commentMember(fromPhone, targetPhone, comment) {
  const normalizedFrom = normalizePhone(fromPhone);
  const normalizedTarget = normalizePhone(targetPhone);

  const result = await pool.query(
    `INSERT INTO leaderboard_comments (from_phone, target_phone, comment, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [normalizedFrom, normalizedTarget, comment]
  );

  return { success: true, id: result.rows[0].id, comment };
}

async function calculateBadges(phone) {
  const normalizedPhone = normalizePhone(phone);
  
  // Badge 1: Série en feu (longest_streak >= 7)
  const streakResult = await pool.query(
    'SELECT longest_streak FROM user_streaks WHERE phone = $1',
    [normalizedPhone]
  );
  const serie_en_feu = streakResult.rows.length > 0 && streakResult.rows[0].longest_streak >= 7;
  
  // Badge 2: Membre fidèle (créé il y a au moins 6 mois)
  const userResult = await pool.query(
    'SELECT created_at FROM users WHERE phone = $1',
    [normalizedPhone]
  );
  const membre_fidele = userResult.rows.length > 0 && 
    userResult.rows[0].created_at <= new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  
  // Badge 3: Top classement (dans le top 10 du leaderboard hebdo - réutilise requête point 6)
  const leaderboardResult = await pool.query(
    `SELECT u.phone
     FROM users u
     JOIN zora_ledger zl ON zl.phone = u.phone
     WHERE u.role = 'patient'
       AND u.is_active = true
       AND zl.earned_at >= date_trunc('week', NOW())
     GROUP BY u.phone
     ORDER BY SUM(zl.points) DESC
     LIMIT 10`
  );
  const top_classement = leaderboardResult.rows.some(row => row.phone === normalizedPhone);
  
  return {
    serie_en_feu,
    membre_fidele,
    top_classement
  };
}

module.exports = {
  getSportGroups,
  createSportGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getClubs,
  createClub,
  joinClub,
  getLeaderboard,
  getGroupLeaderboard,
  getMessages,
  sendMessage,
  getStreak,
  updateStreak,
  updateLeaderboard,
  encourageMember,
  commentMember,
  calculateBadges
};
