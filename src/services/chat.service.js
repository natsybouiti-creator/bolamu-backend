// ============================================================
// Service : Chat communauté + médecins (Sprint 3 — conversation-based)
// ============================================================

const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

// ============================================================
// ANCIEN SYSTÈME — canal sport/groupes (conservé pour compatibilité)
// ============================================================

async function getMessages({ channel, limit = 20, before_id = null }) {
  let query = `
    SELECT
      cm.id,
      cm.channel,
      cm.sender_phone,
      CONCAT(SUBSTRING(u.full_name, 1, 1), '.', SUBSTRING(u.full_name, POSITION(' ' IN u.full_name) + 1, 1)) as sender_name,
      cm.content,
      cm.message_type,
      cm.achievement_data,
      cm.created_at,
      COUNT(cr.id) as reaction_count
    FROM chat_messages cm
    JOIN users u ON cm.sender_phone = u.phone
    LEFT JOIN chat_reactions cr ON cm.id = cr.message_id
    WHERE cm.channel = $1
      AND cm.is_deleted = false
  `;

  const params = [channel];

  if (before_id) {
    query += ' AND cm.id < $2';
    params.push(before_id);
  }

  query += `
    GROUP BY cm.id, cm.channel, cm.sender_phone, u.full_name, cm.content, cm.message_type, cm.achievement_data, cm.created_at
    ORDER BY cm.created_at DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

async function sendMessage({ sender_phone, channel, content, message_type = 'text', achievement_data = null }) {
  if (message_type === 'achievement' && achievement_data) {
    if (achievement_data.phone !== sender_phone) {
      throw new Error('Vous ne pouvez poster que vos propres exploits');
    }
  }

  const result = await pool.query(
    `INSERT INTO chat_messages (sender_phone, channel, content, message_type, achievement_data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [sender_phone, channel, content, message_type, achievement_data ? JSON.stringify(achievement_data) : null]
  );

  return result.rows[0];
}

async function addReaction({ message_id, phone, reaction = 'encourage' }) {
  const result = await pool.query(
    `INSERT INTO chat_reactions (message_id, phone, reaction)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, phone, reaction) DO NOTHING
     RETURNING id`,
    [message_id, phone, reaction]
  );

  const countResult = await pool.query(
    'SELECT COUNT(*) as reaction_count FROM chat_reactions WHERE message_id = $1',
    [message_id]
  );

  return {
    success: result.rows.length > 0,
    reaction_count: parseInt(countResult.rows[0].reaction_count)
  };
}

async function postAchievement({ phone, action_type, points }) {
  const messages = {
    bilan_annuel: 'a complété un bilan annuel',
    vaccination: 'a reçu un vaccin',
    event_checkin: 'a participé à un événement Elonga',
    streak_7: 'a maintenu une série de 7 jours',
    streak_30: 'a maintenu une série de 30 jours'
  };

  const message = messages[action_type];
  if (!message) return;

  const userResult = await pool.query(
    'SELECT first_name FROM users WHERE phone = $1',
    [phone]
  );

  const firstName = userResult.rows[0]?.first_name || 'Un adhérent';
  const content = `${firstName} ${message} · +${points} Zora`;

  await sendMessage({
    sender_phone: phone,
    channel: 'community',
    content,
    message_type: 'achievement',
    achievement_data: { phone, action_type, points }
  });
}

async function getPatientDoctors({ patient_phone }) {
  const result = await pool.query(
    `
    SELECT DISTINCT
      d.phone,
      d.full_name,
      d.specialty,
      MAX(a.appointment_date) as last_appointment
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.patient_phone = $1
      AND a.status IN ('confirme', 'termine', 'en_cours')
    GROUP BY d.phone, d.full_name, d.specialty
    ORDER BY last_appointment DESC
    `,
    [patient_phone]
  );

  return result.rows;
}

// ============================================================
// NOUVEAU SYSTÈME — conversations (Sprint 3)
// ============================================================

async function getOrCreateConversation(patient_phone, medecin_phone) {
  const pPhone = normalizePhone(patient_phone);
  const dPhone = normalizePhone(medecin_phone);

  // Chercher une conversation existante entre ces deux participants
  const existing = await pool.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_participants cp1
       ON c.id = cp1.conversation_id AND cp1.participant_phone = $1
     JOIN conversation_participants cp2
       ON c.id = cp2.conversation_id AND cp2.participant_phone = $2
     WHERE c.type = 'patient_medecin' AND c.is_active = true
     LIMIT 1`,
    [pPhone, dPhone]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Créer la conversation et ses participants dans une transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const convResult = await client.query(
      `INSERT INTO conversations (type) VALUES ('patient_medecin') RETURNING id`
    );
    const conversation_id = convResult.rows[0].id;

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, participant_phone, role)
       VALUES ($1, $2, 'patient'), ($1, $3, 'medecin')`,
      [conversation_id, pPhone, dPhone]
    );

    await client.query('COMMIT');
    return { id: conversation_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getCommunauteConversation() {
  const existing = await pool.query(
    `SELECT id FROM conversations WHERE type = 'communaute' AND is_active = true LIMIT 1`
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO conversations (type) VALUES ('communaute') RETURNING id`
  );
  return result.rows[0];
}

async function getConversationMessages(conversation_id, limit = 20, before_id = null) {
  const params = [parseInt(conversation_id)];

  let beforeClause = '';
  if (before_id) {
    beforeClause = `AND m.id < $${params.length + 1}`;
    params.push(parseInt(before_id));
  }

  params.push(parseInt(limit));

  const result = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_phone,
       CASE
         WHEN c.type = 'communaute' THEN
           UPPER(
             SUBSTRING(u.full_name, 1, 1) ||
             COALESCE(SUBSTRING(u.full_name FROM POSITION(' ' IN u.full_name) + 1 FOR 1), '')
           )
         ELSE u.full_name
       END as sender_display,
       m.content,
       m.type,
       m.sent_at,
       COALESCE(cp.role, 'patient') as sender_role
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     JOIN users u ON m.sender_phone = u.phone
     LEFT JOIN conversation_participants cp
       ON m.conversation_id = cp.conversation_id AND m.sender_phone = cp.participant_phone
     WHERE m.conversation_id = $1
       AND m.is_deleted = false
       ${beforeClause}
     ORDER BY m.sent_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

async function sendConversationMessage(conversation_id, sender_phone, content) {
  const phone = normalizePhone(sender_phone);

  // Vérifier que l'expéditeur est bien participant
  const check = await pool.query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND participant_phone = $2`,
    [parseInt(conversation_id), phone]
  );

  if (check.rows.length === 0) {
    throw new Error('Accès non autorisé à cette conversation');
  }

  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_phone, content)
     VALUES ($1, $2, $3)
     RETURNING id, sent_at`,
    [parseInt(conversation_id), phone, content]
  );

  return result.rows[0];
}

async function markAsRead(conversation_id, participant_phone) {
  const phone = normalizePhone(participant_phone);
  await pool.query(
    `UPDATE conversation_participants
     SET last_read_at = NOW()
     WHERE conversation_id = $1 AND participant_phone = $2`,
    [parseInt(conversation_id), phone]
  );
}

async function getUnreadCount(patient_phone) {
  const phone = normalizePhone(patient_phone);

  const result = await pool.query(
    `SELECT COUNT(m.id) as unread
     FROM messages m
     JOIN conversation_participants cp
       ON m.conversation_id = cp.conversation_id
       AND cp.participant_phone = $1
     WHERE m.sender_phone != $1
       AND m.is_deleted = false
       AND (cp.last_read_at IS NULL OR m.sent_at > cp.last_read_at)`,
    [phone]
  );

  return parseInt(result.rows[0].unread);
}

async function getPatientConversations(patient_phone) {
  const phone = normalizePhone(patient_phone);

  const result = await pool.query(
    `SELECT
       c.id,
       c.type,
       c.is_active,
       -- Dernier message
       (
         SELECT content FROM messages
         WHERE conversation_id = c.id AND is_deleted = false
         ORDER BY sent_at DESC LIMIT 1
       ) as last_message,
       (
         SELECT sent_at FROM messages
         WHERE conversation_id = c.id AND is_deleted = false
         ORDER BY sent_at DESC LIMIT 1
       ) as last_message_at,
       -- Messages non lus
       (
         SELECT COUNT(*) FROM messages m2
         WHERE m2.conversation_id = c.id
           AND m2.sender_phone != $1
           AND m2.is_deleted = false
           AND (cp.last_read_at IS NULL OR m2.sent_at > cp.last_read_at)
       ) as unread_count,
       -- Autre participant (pour patient_medecin)
       (
         SELECT u.full_name
         FROM conversation_participants cp2
         JOIN users u ON cp2.participant_phone = u.phone
         WHERE cp2.conversation_id = c.id
           AND cp2.participant_phone != $1
         LIMIT 1
       ) as other_name,
       (
         SELECT cp2.participant_phone
         FROM conversation_participants cp2
         WHERE cp2.conversation_id = c.id
           AND cp2.participant_phone != $1
         LIMIT 1
       ) as other_phone,
       (
         SELECT cp2.role
         FROM conversation_participants cp2
         WHERE cp2.conversation_id = c.id
           AND cp2.participant_phone != $1
         LIMIT 1
       ) as other_role
     FROM conversations c
     JOIN conversation_participants cp
       ON c.id = cp.conversation_id AND cp.participant_phone = $1
     WHERE c.is_active = true
     ORDER BY last_message_at DESC NULLS LAST`,
    [phone]
  );

  return result.rows;
}

module.exports = {
  // Ancien système (canal sport/groupes)
  getMessages,
  sendMessage,
  addReaction,
  postAchievement,
  getPatientDoctors,
  // Nouveau système (conversations Sprint 3)
  getOrCreateConversation,
  getCommunauteConversation,
  getConversationMessages,
  sendConversationMessage,
  markAsRead,
  getUnreadCount,
  getPatientConversations
};
