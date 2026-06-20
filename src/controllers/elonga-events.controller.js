// ============================================================
// BOLAMU — Sprint 5 : Controller Événements Elonga
// ============================================================
const { registerForEvent, cancelRegistration, generateCheckinToken, processCheckin } = require('../services/elonga-events.service');
const pool = require('../config/db');

/**
 * GET /api/v1/events - Liste publique des événements
 * Query params : city, pillar
 */
async function getEvents(req, res) {
  try {
    const { city, pillar } = req.query;
    
    let query = `
      SELECT e.*, 
             (SELECT COUNT(*) FROM elonga_registrations er 
              WHERE er.event_id = e.id AND er.status IN ('registered', 'checked_in')) as participants_count,
             CASE 
               WHEN e.max_participants IS NULL THEN NULL
               ELSE e.max_participants - (SELECT COUNT(*) FROM elonga_registrations er 
                                          WHERE er.event_id = e.id AND er.status IN ('registered', 'checked_in'))
             END as places_restantes
      FROM elonga_events e
      WHERE e.status = 'published' AND e.starts_at > NOW()
    `;
    
    const params = [];
    const conditions = [];
    
    if (city) {
      conditions.push(`e.city = $${params.length + 1}`);
      params.push(city);
    }
    
    if (pillar) {
      conditions.push(`e.pillar = $${params.length + 1}`);
      params.push(pillar);
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY e.starts_at ASC';
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[ELONGA] getEvents error:', error);
    res.status(500).json({ success: false, message: 'Erreur chargement événements' });
  }
}

/**
 * GET /api/v1/events/:id - Détail d'un événement
 */
async function getEventById(req, res) {
  try {
    const { id } = req.params;
    
    const eventResult = await pool.query(
      `SELECT e.*, 
              (SELECT COUNT(*) FROM elonga_registrations er 
               WHERE er.event_id = e.id AND er.status IN ('registered', 'checked_in')) as participants_count,
              CASE 
                WHEN e.max_participants IS NULL THEN NULL
                ELSE e.max_participants - (SELECT COUNT(*) FROM elonga_registrations er 
                                           WHERE er.event_id = e.id AND er.status IN ('registered', 'checked_in'))
              END as places_restantes
       FROM elonga_events e
       WHERE e.id = $1`,
      [id]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Événement non trouvé' });
    }
    
    const event = eventResult.rows[0];
    
    // Vérifier si l'utilisateur est inscrit (si authentifié)
    let is_registered = false;
    if (req.user && req.user.phone) {
      const regResult = await pool.query(
        `SELECT id FROM elonga_registrations 
         WHERE event_id = $1 AND phone = $2 AND status IN ('registered', 'checked_in')`,
        [id, req.user.phone]
      );
      is_registered = regResult.rows.length > 0;
    }
    
    res.json({ success: true, data: { ...event, is_registered } });
  } catch (error) {
    console.error('[ELONGA] getEventById error:', error);
    res.status(500).json({ success: false, message: 'Erreur chargement événement' });
  }
}

/**
 * POST /api/v1/events/:id/register - Inscription patient
 */
async function registerEvent(req, res) {
  try {
    const { id } = req.params;
    const { phone } = req.user;
    
    const result = await registerForEvent({ phone, event_id: id });
    
    if (result.success) {
      res.json({ success: true, places_restantes: result.places_restantes });
    } else {
      res.status(400).json({ success: false, reason: result.reason });
    }
  } catch (error) {
    console.error('[ELONGA] registerEvent error:', error);
    res.status(500).json({ success: false, message: 'Erreur inscription' });
  }
}

/**
 * DELETE /api/v1/events/:id/register - Annulation inscription
 */
async function cancelEventRegistration(req, res) {
  try {
    const { id } = req.params;
    const { phone } = req.user;
    
    const result = await cancelRegistration({ phone, event_id: id });
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, reason: result.reason });
    }
  } catch (error) {
    console.error('[ELONGA] cancelEventRegistration error:', error);
    res.status(500).json({ success: false, message: 'Erreur annulation' });
  }
}

/**
 * GET /api/v1/events/:id/checkin-token - Générer token QR
 */
async function getCheckinToken(req, res) {
  try {
    const { id } = req.params;
    const { phone } = req.user;
    
    const result = await generateCheckinToken({ phone, event_id: id });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, reason: result.reason });
    }
  } catch (error) {
    console.error('[ELONGA] getCheckinToken error:', error);
    res.status(500).json({ success: false, message: 'Erreur génération token' });
  }
}

/**
 * GET /api/v1/events/my/registrations - Inscriptions du patient
 */
async function getMyRegistrations(req, res) {
  try {
    const { phone } = req.user;
    
    const result = await pool.query(
      `SELECT er.*, e.title, e.starts_at, e.ends_at, e.location_name, e.zora_reward, e.status as event_status
       FROM elonga_registrations er
       JOIN elonga_events e ON er.event_id = e.id
       WHERE er.phone = $1
       ORDER BY e.starts_at DESC`,
      [phone]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[ELONGA] getMyRegistrations error:', error);
    res.status(500).json({ success: false, message: 'Erreur chargement inscriptions' });
  }
}

/**
 * POST /api/v1/events/:id/checkin - Check-in organisateur
 */
async function checkinEvent(req, res) {
  try {
    const { id } = req.params;
    const { token } = req.body;
    const { phone } = req.user;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token requis' });
    }
    
    const result = await processCheckin({ token, organizer_phone: phone });
    
    if (result.success) {
      res.json({ success: true, points_credited: result.points_credited });
    } else {
      res.status(400).json({ success: false, reason: result.reason });
    }
  } catch (error) {
    console.error('[ELONGA] checkinEvent error:', error);
    res.status(500).json({ success: false, message: 'Erreur check-in' });
  }
}

/**
 * POST /api/v1/events - Créer événement (admin)
 */
async function createEvent(req, res) {
  try {
    const {
      title, description, pillar,
      location_name, location_address,
      latitude, longitude, city,
      cover_image_path, starts_at, ends_at,
      max_participants, zora_reward, organizer_phone
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO elonga_events 
       (title, description, pillar, location_name, location_address, latitude, longitude, city,
        cover_image_path, starts_at, ends_at, max_participants, zora_reward, organizer_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [title, description, pillar, location_name, location_address, latitude, longitude, city,
       cover_image_path, starts_at, ends_at, max_participants, zora_reward || 50, organizer_phone]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[ELONGA] createEvent error:', error);
    res.status(500).json({ success: false, message: 'Erreur création événement' });
  }
}

/**
 * PUT /api/v1/events/:id - Modifier événement (admin)
 */
async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const {
      title, description, pillar,
      location_name, location_address,
      latitude, longitude, city,
      cover_image_path, starts_at, ends_at,
      max_participants, zora_reward, status
    } = req.body;
    
    const result = await pool.query(
      `UPDATE elonga_events 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           pillar = COALESCE($3, pillar),
           location_name = COALESCE($4, location_name),
           location_address = COALESCE($5, location_address),
           latitude = COALESCE($6, latitude),
           longitude = COALESCE($7, longitude),
           city = COALESCE($8, city),
           cover_image_path = COALESCE($9, cover_image_path),
           starts_at = COALESCE($10, starts_at),
           ends_at = COALESCE($11, ends_at),
           max_participants = COALESCE($12, max_participants),
           zora_reward = COALESCE($13, zora_reward),
           status = COALESCE($14, status),
           updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [title, description, pillar, location_name, location_address, latitude, longitude, city,
       cover_image_path, starts_at, ends_at, max_participants, zora_reward, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Événement non trouvé' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[ELONGA] updateEvent error:', error);
    res.status(500).json({ success: false, message: 'Erreur modification événement' });
  }
}

/**
 * DELETE /api/v1/events/:id - Supprimer événement (admin)
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM elonga_events WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Événement non trouvé' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[ELONGA] deleteEvent error:', error);
    res.status(500).json({ success: false, message: 'Erreur suppression événement' });
  }
}

module.exports = {
  getEvents,
  getEventById,
  registerEvent,
  cancelEventRegistration,
  getCheckinToken,
  getMyRegistrations,
  checkinEvent,
  createEvent,
  updateEvent,
  deleteEvent
};
