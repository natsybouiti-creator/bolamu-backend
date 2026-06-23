// ============================================================
// BOLAMU — Sprint 7 : Service Événements Complet
// ============================================================
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { normalizePhone } = require('../utils/phone');
const { creditWellnessAction } = require('./wellness.service');

/**
 * Inscrire un patient à un événement
 * @param {string} patient_phone - Numéro du patient
 * @param {number} event_id - ID de l'événement
 * @returns {Promise<Object>} { session_code, qr_token, event }
 */
async function registerPatient(patient_phone, event_id) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const normalizedPhone = normalizePhone(patient_phone);
    
    // Vérifier que l'événement est publié et a des places disponibles
    const eventResult = await client.query(
      `SELECT * FROM elonga_events 
       WHERE id = $1 AND status = 'published' AND starts_at > NOW()`,
      [event_id]
    );
    
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Événement non disponible' };
    }
    
    const event = eventResult.rows[0];
    
    // Vérifier places disponibles
    if (event.max_participants !== null) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM event_registrations 
         WHERE event_id = $1 AND status IN ('registered', 'checked_in')`,
        [event_id]
      );
      
      const currentCount = parseInt(countResult.rows[0].count);
      if (currentCount >= event.max_participants) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Événement complet' };
      }
    }
    
    // Vérifier que le patient n'est pas déjà inscrit
    const existingResult = await client.query(
      `SELECT id FROM event_registrations 
       WHERE event_id = $1 AND patient_phone = $2 AND status != 'cancelled'`,
      [event_id, normalizedPhone]
    );
    
    if (existingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Déjà inscrit à cet événement' };
    }
    
    // Générer session_code : EV-[ANNÉE]-[4 chiffres aléatoires]
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const session_code = `EV-${year}-${randomDigits}`;
    
    // Générer qr_token : JWT signé 72h
    const qr_payload = { patient_phone: normalizedPhone, event_id, session_code };
    const qr_token = jwt.sign(qr_payload, process.env.JWT_SECRET, { expiresIn: '72h' });
    
    // INSERT dans event_registrations
    const insertResult = await client.query(
      `INSERT INTO event_registrations (event_id, patient_phone, session_code, qr_token, status)
       VALUES ($1, $2, $3, $4, 'registered')
       RETURNING id`,
      [event_id, normalizedPhone, session_code, qr_token]
    );
    
    const registration_id = insertResult.rows[0].id;
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_id, payload)
       VALUES ('event_registration', $1, $2, $3)`,
      [normalizedPhone, registration_id, JSON.stringify({ event_id, session_code })]
    );
    
    await client.query('COMMIT');
    
    // Notification WhatsApp (non bloquant)
    try {
      const { notifyEventRegistration } = require('./whatsapp.service');
      await notifyEventRegistration(normalizedPhone, event, session_code);
    } catch (whatsappErr) {
      logger.warn('[EVENT] Erreur notification WhatsApp:', whatsappErr.message);
    }
    
    return { 
      success: true, 
      session_code, 
      qr_token, 
      event: {
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        location_name: event.location_name
      }
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[EVENT] registerPatient error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check-in patient via QR token
 * @param {string} qr_token - Token JWT QR
 * @param {string} animateur_phone - Numéro de l'animateur
 * @param {number} event_id - ID de l'événement
 * @returns {Promise<Object>} { patient_phone, session_code, zora_credited }
 */
async function checkinPatient(qr_token, animateur_phone, event_id) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const normalizedAnimateur = normalizePhone(animateur_phone);
    
    // Vérifier JWT qr_token non expiré
    let decoded;
    try {
      decoded = jwt.verify(qr_token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Token QR invalide ou expiré' };
    }
    
    // Vérifier registration existe + status='registered'
    const regResult = await client.query(
      `SELECT * FROM event_registrations 
       WHERE event_id = $1 AND patient_phone = $2 AND status = 'registered'`,
      [event_id, normalizePhone(decoded.patient_phone)]
    );
    
    if (regResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Inscription non trouvée' };
    }
    
    const registration = regResult.rows[0];
    
    // Vérifier event_id correspond
    if (registration.event_id !== event_id) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Événement ne correspond pas' };
    }
    
    // UPDATE registration status='checked_in', checked_in_at=NOW()
    await client.query(
      `UPDATE event_registrations 
       SET status = 'checked_in', checked_in_at = NOW()
       WHERE id = $1`,
      [registration.id]
    );
    
    // INSERT dans event_checkin_log
    const logResult = await client.query(
      `INSERT INTO event_checkin_log (registration_id, event_id, patient_phone, animateur_phone, scan_method)
       VALUES ($1, $2, $3, $4, 'qr_scan')
       RETURNING id`,
      [registration.id, event_id, registration.patient_phone, normalizedAnimateur]
    );
    
    // Appelle creditWellnessAction
    let zora_credited = 0;
    try {
      const wellnessResult = await creditWellnessAction(
        registration.patient_phone,
        'event_checkin',
        registration.id,
        normalizedAnimateur
      );
      zora_credited = wellnessResult.zora_credited || 0;
      
      // UPDATE zora_credited dans registration
      await client.query(
        `UPDATE event_registrations SET zora_credited = $1 WHERE id = $2`,
        [zora_credited, registration.id]
      );
      
      // UPDATE zora_credited dans checkin_log
      await client.query(
        `UPDATE event_checkin_log SET zora_credited = $1 WHERE id = $2`,
        [zora_credited, logResult.rows[0].id]
      );
    } catch (wellnessErr) {
      logger.warn('[EVENT] Erreur creditWellnessAction:', wellnessErr.message);
    }
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_id, payload)
       VALUES ('event_checkin', $1, $2, $3)`,
      [normalizedAnimateur, registration.id, JSON.stringify({ event_id, method: 'qr_scan' })]
    );
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      patient_phone: registration.patient_phone, 
      session_code: registration.session_code,
      zora_credited
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[EVENT] checkinPatient error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check-in patient via session code
 * @param {string} session_code - Code de session
 * @param {string} animateur_phone - Numéro de l'animateur
 * @param {number} event_id - ID de l'événement
 * @returns {Promise<Object>} { patient_phone, session_code, zora_credited }
 */
async function checkinByCode(session_code, animateur_phone, event_id) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const normalizedAnimateur = normalizePhone(animateur_phone);
    
    // Vérifier registration existe via session_code + status='registered'
    const regResult = await client.query(
      `SELECT * FROM event_registrations 
       WHERE event_id = $1 AND session_code = $2 AND status = 'registered'`,
      [event_id, session_code]
    );
    
    if (regResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Code de session invalide' };
    }
    
    const registration = regResult.rows[0];
    
    // UPDATE registration status='checked_in', checked_in_at=NOW()
    await client.query(
      `UPDATE event_registrations 
       SET status = 'checked_in', checked_in_at = NOW()
       WHERE id = $1`,
      [registration.id]
    );
    
    // INSERT dans event_checkin_log
    const logResult = await client.query(
      `INSERT INTO event_checkin_log (registration_id, event_id, patient_phone, animateur_phone, scan_method)
       VALUES ($1, $2, $3, $4, 'code_manual')
       RETURNING id`,
      [registration.id, event_id, registration.patient_phone, normalizedAnimateur]
    );
    
    // Appelle creditWellnessAction
    let zora_credited = 0;
    try {
      const wellnessResult = await creditWellnessAction(
        registration.patient_phone,
        'event_checkin',
        registration.id,
        normalizedAnimateur
      );
      zora_credited = wellnessResult.zora_credited || 0;
      
      // UPDATE zora_credited dans registration
      await client.query(
        `UPDATE event_registrations SET zora_credited = $1 WHERE id = $2`,
        [zora_credited, registration.id]
      );
      
      // UPDATE zora_credited dans checkin_log
      await client.query(
        `UPDATE event_checkin_log SET zora_credited = $1 WHERE id = $2`,
        [zora_credited, logResult.rows[0].id]
      );
    } catch (wellnessErr) {
      logger.warn('[EVENT] Erreur creditWellnessAction:', wellnessErr.message);
    }
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_id, payload)
       VALUES ('event_checkin', $1, $2, $3)`,
      [normalizedAnimateur, registration.id, JSON.stringify({ event_id, method: 'code_manual' })]
    );
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      patient_phone: registration.patient_phone, 
      session_code: registration.session_code,
      zora_credited
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[EVENT] checkinByCode error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Liste toutes les inscriptions du patient
 * @param {string} patient_phone - Numéro du patient
 * @returns {Promise<Array>} Liste des inscriptions avec détails événement
 */
async function getPatientRegistrations(patient_phone) {
  const normalizedPhone = normalizePhone(patient_phone);
  
  const result = await pool.query(
    `SELECT 
      er.id as registration_id,
      er.session_code,
      er.status as registration_status,
      er.registered_at,
      er.checked_in_at,
      er.zora_credited,
      e.id as event_id,
      e.title,
      e.description,
      e.location_name,
      e.starts_at,
      e.ends_at,
      e.zora_reward,
      e.pillar
     FROM event_registrations er
     JOIN elonga_events e ON er.event_id = e.id
     WHERE er.patient_phone = $1
     ORDER BY e.starts_at DESC`,
    [normalizedPhone]
  );
  
  return result.rows;
}

/**
 * Liste tous les inscrits à un événement
 * @param {number} event_id - ID de l'événement
 * @returns {Promise<Object>} { registrations, total, present }
 */
async function getEventRegistrations(event_id) {
  const result = await pool.query(
    `SELECT 
      er.id as registration_id,
      er.patient_phone,
      er.session_code,
      er.status as registration_status,
      er.registered_at,
      er.checked_in_at,
      er.zora_credited,
      u.first_name,
      u.last_name
     FROM event_registrations er
     JOIN users u ON er.patient_phone = u.phone
     WHERE er.event_id = $1
     ORDER BY er.registered_at ASC`,
    [event_id]
  );
  
  const total = await pool.query(
    `SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1`,
    [event_id]
  );
  
  const present = await pool.query(
    `SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1 AND status = 'checked_in'`,
    [event_id]
  );
  
  return {
    registrations: result.rows,
    total: parseInt(total.rows[0].count),
    present: parseInt(present.rows[0].count)
  };
}

/**
 * Publier un événement
 * @param {number} event_id - ID de l'événement
 * @param {string} admin_phone - Numéro de l'admin
 * @returns {Promise<Object>} { success }
 */
async function publishEvent(event_id, admin_phone) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const normalizedAdmin = normalizePhone(admin_phone);
    
    // Vérifier que l'appelant est admin ou animateur senior
    const userResult = await pool.query(
      `SELECT role FROM users WHERE phone = $1`,
      [normalizedAdmin]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Utilisateur non trouvé' };
    }
    
    const role = userResult.rows[0].role;
    if (role !== 'admin' && role !== 'animateur') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Non autorisé' };
    }
    
    // UPDATE events
    await client.query(
      `UPDATE elonga_events 
       SET status = 'published', published_at = NOW(), published_by = $1
       WHERE id = $2`,
      [normalizedAdmin, event_id]
    );
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_id, payload)
       VALUES ('event_publish', $1, $2, $3)`,
      [normalizedAdmin, event_id, JSON.stringify({ event_id })]
    );
    
    await client.query('COMMIT');
    
    return { success: true };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[EVENT] publishEvent error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Créer un événement
 * @param {Object} data - Données de l'événement
 * @param {string} creator_phone - Numéro du créateur
 * @returns {Promise<Object>} { success, event_id }
 */
async function createEvent(data, creator_phone) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const normalizedCreator = normalizePhone(creator_phone);
    
    // INSERT dans events avec status='pending'
    const result = await client.query(
      `INSERT INTO elonga_events (
        title, description, pillar, location_name, location_address,
        latitude, longitude, city, cover_image_path, starts_at, ends_at,
        max_participants, zora_reward, proof_class, status, organizer_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', $15)
       RETURNING id`,
      [
        data.title,
        data.description || null,
        data.pillar,
        data.location_name,
        data.location_address || data.location_name,
        data.latitude || null,
        data.longitude || null,
        data.city || 'Brazzaville',
        data.cover_image_path || null,
        data.starts_at,
        data.ends_at,
        data.max_participants || null,
        data.zora_reward || 50,
        data.proof_class || 'ground_truth',
        normalizedCreator
      ]
    );
    
    const event_id = result.rows[0].id;
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_id, payload)
       VALUES ('event_create', $1, $2, $3)`,
      [normalizedCreator, event_id, JSON.stringify({ title: data.title })]
    );
    
    await client.query('COMMIT');
    
    return { success: true, event_id };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[EVENT] createEvent error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Liste les événements en attente de validation
 * @returns {Promise<Array>} Liste des événements pending
 */
async function getPendingEvents() {
  const result = await pool.query(
    `SELECT * FROM elonga_events 
     WHERE status = 'pending'
     ORDER BY created_at DESC`
  );
  
  return result.rows;
}

module.exports = {
  registerPatient,
  checkinPatient,
  checkinByCode,
  getPatientRegistrations,
  getEventRegistrations,
  publishEvent,
  createEvent,
  getPendingEvents
};
