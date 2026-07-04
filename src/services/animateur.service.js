// ============================================================
// BOLAMU — Boucle 3 : Service Animateur
// Orchestre event.service.js sans dupliquer la logique
// ============================================================
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { 
  createEvent, 
  checkinPatient, 
  checkinByCode,
  getEventRegistrations 
} = require('./event.service');
const { sendAutoMessage } = require('./whatsapp.service');
const logger = require('../config/logger');

/**
 * Statistiques globales animateur
 * @param {string} animateur_phone - Numéro de l'animateur
 * @returns {Promise<Object>} { events_count, checkins_today, members_active, elonga_points_week }
 */
async function getStats(animateur_phone) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    // Événements organisés (event_registrations)
    const eventsResult = await pool.query(
      `SELECT COUNT(DISTINCT event_id) as count 
       FROM event_registrations er
       JOIN elonga_events e ON er.event_id = e.id
       WHERE e.organizer_phone = $1`,
      [normalizedPhone]
    );
    
    // Check-ins du jour (event_checkin_log)
    const checkinsResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM event_checkin_log 
       WHERE animateur_phone = $1 
       AND DATE(checked_in_at) = CURRENT_DATE`,
      [normalizedPhone]
    );
    
    // Membres actifs dans les clubs assignés
    const membersResult = await pool.query(
      `SELECT COUNT(DISTINCT cm.patient_phone) as count
       FROM club_members cm
       JOIN animateur_clubs ac ON cm.club_id = ac.club_id
       WHERE ac.animateur_phone = $1
       AND cm.is_active = TRUE`,
      [normalizedPhone]
    );
    
    // Inscriptions totales sur les événements de l'animateur
    const inscriptionsResult = await pool.query(
      `SELECT COUNT(*) as count FROM elonga_registrations er
       JOIN elonga_events e ON er.event_id = e.id
       WHERE e.organizer_phone = $1`,
      [normalizedPhone]
    );

    // Clubs assignés à l'animateur
    const clubsResult = await pool.query(
      `SELECT COUNT(*) as count FROM animateur_clubs
       WHERE animateur_phone = $1`,
      [normalizedPhone]
    );

    // Événements actifs
    const actifsResult = await pool.query(
      `SELECT COUNT(*) as count FROM elonga_events
       WHERE organizer_phone = $1 AND status = 'active'`,
      [normalizedPhone]
    );

    return {
      total_events:       parseInt(eventsResult.rows[0].count),
      total_checkins:     parseInt(checkinsResult.rows[0].count),
      total_membres:      parseInt(membersResult.rows[0].count),
      total_inscriptions: parseInt(inscriptionsResult.rows[0].count),
      total_clubs:        parseInt(clubsResult.rows[0].count),
      events_actifs:      parseInt(actifsResult.rows[0].count)
    };
    
  } catch (error) {
    logger.error('[ANIMATEUR] getStats error:', error);
    throw error;
  }
}

/**
 * Liste des événements organisés par l'animateur
 * @param {string} animateur_phone - Numéro de l'animateur
 * @param {number} limit - Limite de résultats
 * @returns {Promise<Array>} Liste avec nb_inscrits par event
 */
async function getMyEvents(animateur_phone, limit = 20) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    const result = await pool.query(
      `SELECT 
        e.id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.location_name,
        e.max_participants,
        e.zora_reward,
        e.status,
        e.pillar,
        (SELECT COUNT(*) FROM event_registrations 
         WHERE event_id = e.id AND status IN ('registered', 'checked_in')) as nb_inscrits
       FROM elonga_events e
       WHERE e.organizer_phone = $1
       ORDER BY e.starts_at ASC
       LIMIT $2`,
      [normalizedPhone, limit]
    );
    
    return result.rows;
    
  } catch (error) {
    logger.error('[ANIMATEUR] getMyEvents error:', error);
    throw error;
  }
}

/**
 * Créer un événement Elonga (wrapper event.service)
 * @param {Object} data - Données de l'événement
 * @param {string} animateur_phone - Numéro de l'animateur
 * @returns {Promise<Object>} { success, event_id }
 */
async function createElongaEvent(data, animateur_phone) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  // Validation
  if (!data.title || data.title.length < 3 || data.title.length > 100) {
    throw new Error('Titre invalide (3-100 caractères)');
  }
  if (!data.location_name || data.location_name.length < 3) {
    throw new Error('Lieu invalide');
  }
  if (!data.starts_at || !data.ends_at) {
    throw new Error('Dates de début et fin requises');
  }
  if (new Date(data.starts_at) >= new Date(data.ends_at)) {
    throw new Error('Date de fin doit être après date de début');
  }
  if (data.zora_reward && (data.zora_reward < 0 || data.zora_reward > 100)) {
    throw new Error('Récompense Zora invalide (0-100)');
  }
  if (data.max_participants && (data.max_participants < 1 || data.max_participants > 200)) {
    throw new Error('Max participants invalide (1-200)');
  }
  
  // Appelle event.service.createEvent avec status='published' pour animateur
  const eventData = {
    ...data,
    status: 'published'
  };
  
  const result = await createEvent(eventData, normalizedPhone);
  
  // Override status à published après création
  await pool.query(
    `UPDATE elonga_events SET status = 'published' WHERE id = $1`,
    [result.event_id]
  );
  
  return result;
}

/**
 * Check-in patient (QR token ou code)
 * @param {string} qr_token_or_code - Token QR ou code session
 * @param {string} animateur_phone - Numéro de l'animateur
 * @param {number} event_id - ID de l'événement
 * @returns {Promise<Object>} { success, patient_name, zora_awarded }
 */
async function checkinPatientWrapper(qr_token_or_code, animateur_phone, event_id) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    let checkinResult;
    
    // Essaie d'abord QR token
    checkinResult = await checkinPatient(qr_token_or_code, normalizedPhone, event_id);
    
    // Si échec, essaie code session
    if (!checkinResult.success) {
      checkinResult = await checkinByCode(qr_token_or_code, normalizedPhone, event_id);
    }
    
    if (!checkinResult.success) {
      return checkinResult;
    }
    
    // Récupère détails patient et événement
    const patientResult = await pool.query(
      `SELECT first_name, last_name FROM users WHERE phone = $1`,
      [checkinResult.patient_phone]
    );
    
    const eventResult = await pool.query(
      `SELECT title, zora_reward FROM elonga_events WHERE id = $1`,
      [event_id]
    );
    
    const patientName = patientResult.rows[0] 
      ? `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`.trim()
      : 'Patient';
    const eventName = eventResult.rows[0]?.title || 'Événement';
    const zoraReward = eventResult.rows[0]?.zora_reward || checkinResult.zora_credited;
    
    // INSERT dans elonga_points
    await pool.query(
      `INSERT INTO elonga_points (phone, event_id, points, source, awarded_at)
       VALUES ($1, $2, $3, 'checkin', NOW())`,
      [checkinResult.patient_phone, event_id, zoraReward]
    );
    
    // Notification WhatsApp (non bloquant)
    try {
      await sendAutoMessage(
        checkinResult.patient_phone,
        'bolamu_checkin_confirme',
        [patientName, eventName, zoraReward.toString()]
      );
    } catch (whatsappErr) {
      logger.warn('[ANIMATEUR] Erreur WhatsApp checkin:', whatsappErr.message);
    }
    
    return {
      success: true,
      patient_name: patientName,
      zora_awarded: zoraReward
    };
    
  } catch (error) {
    logger.error('[ANIMATEUR] checkinPatientWrapper error:', error);
    throw error;
  }
}

/**
 * Check-ins du jour
 * @param {string} animateur_phone - Numéro de l'animateur
 * @returns {Promise<Array>} Liste check-ins du jour
 */
async function getTodayCheckins(animateur_phone) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    const result = await pool.query(
      `SELECT 
        ecl.id,
        ecl.checked_in_at,
        ecl.patient_phone,
        e.title as event_title,
        u.first_name,
        u.last_name,
        ecl.zora_credited
       FROM event_checkin_log ecl
       JOIN elonga_events e ON ecl.event_id = e.id
       JOIN users u ON ecl.patient_phone = u.phone
       WHERE ecl.animateur_phone = $1 
       AND DATE(ecl.checked_in_at) = CURRENT_DATE
       ORDER BY ecl.checked_in_at DESC`,
      [normalizedPhone]
    );
    
    return result.rows;
    
  } catch (error) {
    logger.error('[ANIMATEUR] getTodayCheckins error:', error);
    throw error;
  }
}

/**
 * Clubs assignés à l'animateur
 * @param {string} animateur_phone - Numéro de l'animateur
 * @returns {Promise<Array>} Liste clubs avec nb_membres
 */
async function getMyClubs(animateur_phone) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    const result = await pool.query(
      `SELECT
        c.id,
        c.name,
        c.category,
        (SELECT COUNT(*) FROM club_members cm
         WHERE cm.club_id = c.id AND cm.is_active = TRUE) as nb_membres
       FROM clubs c
       JOIN animateur_clubs ac ON c.id = ac.club_id
       WHERE ac.animateur_phone = $1
       ORDER BY c.name ASC`,
      [normalizedPhone]
    );
    
    return result.rows;
    
  } catch (error) {
    logger.error('[ANIMATEUR] getMyClubs error:', error);
    throw error;
  }
}

/**
 * Notifier tous les membres d'un club
 * @param {number} club_id - ID du club
 * @param {string} animateur_phone - Numéro de l'animateur
 * @param {string} message_type - Type de message template
 * @param {Array} params - Paramètres template
 * @returns {Promise<Object>} { sent_count, failed_count }
 */
async function notifyClub(club_id, animateur_phone, message_type, params) {
  const normalizedPhone = normalizePhone(animateur_phone);
  
  try {
    // Vérifie que l'animateur est assigné à ce club
    const assignResult = await pool.query(
      `SELECT id FROM animateur_clubs 
       WHERE animateur_phone = $1 AND club_id = $2`,
      [normalizedPhone, club_id]
    );
    
    if (assignResult.rows.length === 0) {
      throw new Error('Animateur non assigné à ce club');
    }
    
    // Récupère tous les membres actifs du club
    const membersResult = await pool.query(
      `SELECT patient_phone FROM club_members 
       WHERE club_id = $1 AND is_active = TRUE`,
      [club_id]
    );
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const member of membersResult.rows) {
      const ok = await sendAutoMessage(member.patient_phone, message_type, params);
      if (ok) {
        sentCount++;
      } else {
        failedCount++;
        logger.warn('[ANIMATEUR] Échec envoi WhatsApp à', member.patient_phone);
      }
    }
    
    return { sent_count: sentCount, failed_count: failedCount };
    
  } catch (error) {
    logger.error('[ANIMATEUR] notifyClub error:', error);
    throw error;
  }
}

module.exports = {
  getStats,
  getMyEvents,
  createElongaEvent,
  checkinPatient: checkinPatientWrapper,
  getTodayCheckins,
  getMyClubs,
  notifyClub,
  getEventRegistrations // Re-export depuis event.service
};
