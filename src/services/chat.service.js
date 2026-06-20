// ============================================================
// Service : Chat communauté + médecins
// ============================================================

const { pool } = require('../config/db');

/**
 * Récupérer les messages d'un canal
 */
async function getMessages({ channel, limit = 20, before_id = null }) {
  let query = `
    SELECT 
      cm.id,
      cm.channel,
      cm.sender_phone,
      CASE 
        WHEN cm.message_type = 'achievement' THEN 
          CONCAT(SUBSTRING(u.full_name, 1, 1), '.', SUBSTRING(u.full_name, POSITION(' ' IN u.full_name) + 1, 1))
        ELSE 
          CONCAT(SUBSTRING(u.full_name, 1, 1), '.', SUBSTRING(u.full_name, POSITION(' ' IN u.full_name) + 1, 1))
      END as sender_name,
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

/**
 * Envoyer un message
 */
async function sendMessage({ sender_phone, channel, content, message_type = 'text', achievement_data = null }) {
  // Vérifier que si c'est un achievement, le phone correspond
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

/**
 * Ajouter une réaction à un message
 */
async function addReaction({ message_id, phone, reaction = 'encourage' }) {
  const result = await pool.query(
    `INSERT INTO chat_reactions (message_id, phone, reaction)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, phone, reaction) DO NOTHING
     RETURNING id`,
    [message_id, phone, reaction]
  );
  
  // Récupérer le compteur de réactions
  const countResult = await pool.query(
    'SELECT COUNT(*) as reaction_count FROM chat_reactions WHERE message_id = $1',
    [message_id]
  );
  
  return { 
    success: result.rows.length > 0,
    reaction_count: parseInt(countResult.rows[0].reaction_count)
  };
}

/**
 * Auto-post d'un achievement dans le canal communauté
 */
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
  
  // Récupérer le prénom de l'utilisateur
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

/**
 * Récupérer les médecins avec qui le patient a eu des RDV
 */
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

module.exports = {
  getMessages,
  sendMessage,
  addReaction,
  postAchievement,
  getPatientDoctors
};
