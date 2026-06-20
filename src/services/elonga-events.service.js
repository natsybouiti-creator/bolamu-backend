// ============================================================
// BOLAMU — Sprint 5 : Service Événements Elonga
// ============================================================
const pool = require('../config/db');
const { awardZora } = require('./zora.service');

/**
 * Inscrire un patient à un événement
 * @param {Object} params - { phone, event_id }
 * @returns {Promise<Object>} { success, places_restantes }
 */
async function registerForEvent({ phone, event_id }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Vérifier que l'événement existe et est publié
    const eventResult = await client.query(
      `SELECT * FROM elonga_events 
       WHERE id = $1 AND status = 'published' AND starts_at > NOW()`,
      [event_id]
    );
    
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'event_not_available' };
    }
    
    const event = eventResult.rows[0];
    
    // Vérifier places disponibles
    if (event.max_participants !== null) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM elonga_registrations 
         WHERE event_id = $1 AND status IN ('registered', 'checked_in')`,
        [event_id]
      );
      
      const currentCount = parseInt(countResult.rows[0].count);
      if (currentCount >= event.max_participants) {
        await client.query('ROLLBACK');
        return { success: false, reason: 'event_full' };
      }
    }
    
    // Insérer ou mettre à jour l'inscription (ON CONFLICT DO UPDATE)
    const insertResult = await client.query(
      `INSERT INTO elonga_registrations (event_id, phone, status)
       VALUES ($1, $2, 'registered')
       ON CONFLICT (event_id, phone) 
       DO UPDATE SET status = 'registered', registered_at = NOW()
       WHERE status = 'cancelled'
       RETURNING id`,
      [event_id, phone]
    );
    
    await client.query('COMMIT');
    
    // Calculer places restantes
    const placesRestantes = event.max_participants !== null 
      ? event.max_participants - (await pool.query(
          `SELECT COUNT(*) as count FROM elonga_registrations 
           WHERE event_id = $1 AND status IN ('registered', 'checked_in')`,
          [event_id]
        )).rows[0].count
      : null;
    
    return { success: true, places_restantes: placesRestantes };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ELONGA] registerForEvent error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Annuler une inscription à un événement
 * @param {Object} params - { phone, event_id }
 * @returns {Promise<Object>} { success }
 */
async function cancelRegistration({ phone, event_id }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE elonga_registrations 
       SET status = 'cancelled'
       WHERE event_id = $1 AND phone = $2 AND status = 'registered'
       RETURNING id`,
      [event_id, phone]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'not_registered' };
    }
    
    await client.query('COMMIT');
    return { success: true };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ELONGA] cancelRegistration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Générer un token de check-in QR pour un participant
 * @param {Object} params - { phone, event_id }
 * @returns {Promise<Object>} { token, expires_at, event_title }
 */
async function generateCheckinToken({ phone, event_id }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Vérifier que l'utilisateur est inscrit
    const regResult = await client.query(
      `SELECT er.*, e.title as event_title 
       FROM elonga_registrations er
       JOIN elonga_events e ON er.event_id = e.id
       WHERE er.event_id = $1 AND er.phone = $2 AND er.status = 'registered'`,
      [event_id, phone]
    );
    
    if (regResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'not_registered' };
    }
    
    const registration = regResult.rows[0];
    
    // Générer token UUID avec expiration 24h
    const tokenResult = await client.query(
      `INSERT INTO elonga_checkin_tokens (event_id, phone, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')
       RETURNING token, expires_at`,
      [event_id, phone]
    );
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      token: tokenResult.rows[0].token,
      expires_at: tokenResult.rows[0].expires_at,
      event_title: registration.event_title
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ELONGA] generateCheckinToken error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Traiter un check-in via QR code
 * @param {Object} params - { token, organizer_phone }
 * @returns {Promise<Object>} { success, points_credited }
 */
async function processCheckin({ token, organizer_phone }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Charger le token
    const tokenResult = await client.query(
      `SELECT ect.*, er.id as registration_id, er.phone, er.event_id, e.title as event_title, e.zora_reward, e.organizer_phone
       FROM elonga_checkin_tokens ect
       JOIN elonga_registrations er ON ect.event_id = er.event_id AND ect.phone = er.phone
       JOIN elonga_events e ON ect.event_id = e.id
       WHERE ect.token = $1`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'token_invalid' };
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Vérifier que le token n'est pas utilisé
    if (tokenData.used) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'token_already_used' };
    }
    
    // Vérifier que le token n'est pas expiré
    if (tokenData.expires_at < new Date()) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'token_expired' };
    }
    
    // Vérifier que l'organisateur est autorisé (optionnel - pour l'instant tout user authentifié peut scanner)
    // TODO: Ajouter vérification organizer_phone === event.organizer_phone si nécessaire
    
    // Marquer le token comme utilisé
    await client.query(
      `UPDATE elonga_checkin_tokens SET used = TRUE WHERE id = $1`,
      [tokenData.id]
    );
    
    // Mettre à jour l'inscription
    await client.query(
      `UPDATE elonga_registrations 
       SET status = 'checked_in', checkin_at = NOW(), checkin_by = $1
       WHERE id = $2`,
      [organizer_phone, tokenData.registration_id]
    );
    
    // Créditer points Zora via awardZora
    const zoraResult = await awardZora({
      phone: tokenData.phone,
      action_type: 'event_checkin',
      proof_class: 'ground_truth',
      proof_source: organizer_phone,
      proof_reference: tokenData.registration_id.toString()
    });
    
    // Marquer zora_awarded = TRUE
    await client.query(
      `UPDATE elonga_registrations SET zora_awarded = TRUE WHERE id = $1`,
      [tokenData.registration_id]
    );
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      points_credited: zoraResult.success ? tokenData.zora_reward : 0
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ELONGA] processCheckin error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  registerForEvent,
  cancelRegistration,
  generateCheckinToken,
  processCheckin
};
