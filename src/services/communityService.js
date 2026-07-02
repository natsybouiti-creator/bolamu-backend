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
  const result = await pool.query(
    `SELECT sg.*, COUNT(sgm.phone) as member_count
     FROM sport_groups sg
     LEFT JOIN sport_group_members sgm ON sg.id = sgm.group_id
     WHERE sg.is_active = true
     GROUP BY sg.id
     ORDER BY sg.created_at DESC`
  );
  return result.rows;
}

async function createSportGroup(name, sport, description, phone) {
  validateGroupInput(name, sport);
  const normalizedPhone = normalizePhone(phone);
  const result = await pool.query(
    `INSERT INTO sport_groups (name, sport_type, description, city, created_by, is_active, created_at)
     VALUES ($1, $2, $3, 'Brazzaville', $4, true, NOW())
     RETURNING *`,
    [name, sport, description, normalizedPhone]
  );
  return result.rows[0];
}

async function joinGroup(phone, groupId) {
  const normalizedPhone = normalizePhone(phone);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Vérifier si déjà membre
    const existingMember = await client.query(
      'SELECT id FROM sport_group_members WHERE group_id = $1 AND phone = $2',
      [groupId, normalizedPhone]
    );
    
    if (existingMember.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new Error('ALREADY_MEMBER');
    }
    
    // Ajouter comme membre
    await client.query(
      `INSERT INTO sport_group_members (group_id, phone, joined_at)
       VALUES ($1, $2, NOW())`,
      [groupId, normalizedPhone]
    );
    
    // Récupérer le nom du groupe
    const groupResult = await client.query(
      'SELECT name FROM sport_groups WHERE id = $1',
      [groupId]
    );
    const groupName = groupResult.rows[0]?.name || 'Groupe';
    
    // Récupérer le prénom du patient
    const userResult = await client.query(
      'SELECT first_name FROM users WHERE phone = $1',
      [normalizedPhone]
    );
    const firstName = userResult.rows[0]?.first_name || 'Membre';
    
    // Upsert leaderboard_weekly
    await client.query(
      `INSERT INTO leaderboard_weekly (phone, week_start, points_earned)
       VALUES ($1, date_trunc('week', NOW())::date, 0)
       ON CONFLICT (phone, week_start) DO NOTHING`,
      [normalizedPhone]
    );
    
    await client.query('COMMIT');
    
    // Envoyer notification WhatsApp (hors transaction)
    setImmediate(async () => {
      try {
        await whatsappService.sendAutoMessage(
          normalizedPhone,
          'bolamu_groupe_rejoint',
          [groupName, firstName]
        );
      } catch (err) {
        console.error('[Community] Erreur WhatsApp groupe rejoint:', err.message);
      }
    });
    
    return { success: true, group_name: groupName };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function leaveGroup(phone, groupId) {
  const normalizedPhone = normalizePhone(phone);
  await pool.query(
    'DELETE FROM sport_group_members WHERE group_id = $1 AND phone = $2',
    [groupId, normalizedPhone]
  );
}

async function getGroupMembers(groupId) {
  const result = await pool.query(
    `SELECT sgm.*, u.first_name, u.last_name
     FROM sport_group_members sgm
     LEFT JOIN users u ON sgm.phone = u.phone
     WHERE sgm.group_id = $1
     ORDER BY sgm.joined_at ASC`,
    [groupId]
  );
  return result.rows;
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
  const result = await pool.query(
    `SELECT lw.*, u.first_name, u.last_name, sg.name as group_name
     FROM leaderboard_weekly lw
     LEFT JOIN users u ON lw.phone = u.phone
     LEFT JOIN sport_groups sg ON lw.group_id = sg.id
     WHERE lw.week_start = date_trunc('week', NOW())::date
     ORDER BY lw.points_earned DESC
     LIMIT 50`
  );
  return result.rows;
}

async function getGroupLeaderboard(groupId) {
  const result = await pool.query(
    `SELECT lw.*, u.first_name, u.last_name
     FROM leaderboard_weekly lw
     LEFT JOIN users u ON lw.phone = u.phone
     WHERE lw.week_start = date_trunc('week', NOW())::date
     AND lw.group_id = $1
     ORDER BY lw.points_earned DESC`,
    [groupId]
  );
  return result.rows;
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
  const normalizedPhone = normalizePhone(phone);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(
      `INSERT INTO leaderboard_weekly (phone, group_id, week_start, points_earned)
       VALUES ($1, $2, date_trunc('week', NOW())::date, $3)
       ON CONFLICT (phone, week_start)
       DO UPDATE SET points_earned = leaderboard_weekly.points_earned + EXCLUDED.points_earned`,
      [normalizedPhone, groupId, points]
    );
    
    // Récupérer le nouveau rang
    const rankResult = await client.query(
      `SELECT rank FROM (
         SELECT phone, points_earned, 
           RANK() OVER (ORDER BY points_earned DESC) as rank
         FROM leaderboard_weekly
         WHERE week_start = date_trunc('week', NOW())::date
         AND group_id = $1
       ) ranked WHERE phone = $2`,
      [groupId, normalizedPhone]
    );
    
    const rank = rankResult.rows[0]?.rank || 0;
    
    await client.query('COMMIT');

    return { success: true, rank };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
  commentMember
};
