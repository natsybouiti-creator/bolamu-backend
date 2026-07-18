// ============================================================
// BOLAMU — Sprint 5 + 7 : Routes Événements Elonga
// ============================================================
const express = require('express');
const router = express.Router();
const {
  getEvents,
  getEventById,
  cancelEventRegistration,
  getCheckinToken,
  checkinEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/elonga-events.controller');
const { registerForEvent, processCheckin } = require('../services/elonga-events.service');
const {
  getPatientRegistrations,
  getEventRegistrations,
  publishEvent,
  createEvent: createEventService,
  getPendingEvents,
  activateEvent,
  completeEvent
} = require('../services/event.service');
const authMiddleware = require('../middleware/auth.middleware');
const { ok, err } = require('../utils/apiResponse');
const { upload, uploadEvent } = require('../middleware/uploadEvent');

// PUBLICS
router.get('/', getEvents);
router.get('/:id', getEventById);

// PATIENTS (auth JWT)
router.delete('/:id/register', authMiddleware, cancelEventRegistration);
router.patch('/:id/cancel', authMiddleware, cancelEventRegistration); // Alias frontend
router.get('/:id/checkin-token', authMiddleware, getCheckinToken);

// PATIENTS (auth JWT) - Sprint 7 : Inscription via elonga-events.service.js
router.post('/:id/register', authMiddleware, async (req, res) => {
  try {
    const result = await registerForEvent({ phone: req.user.phone, event_id: req.params.id });
    if (result.success) {
      res.json({ success: true, places_restantes: result.places_restantes });
    } else {
      if (result.reason === 'event_not_available') {
        res.status(400).json({ success: false, error: { code: "EVENT_NOT_AVAILABLE", message: "Cet événement n'est pas disponible." } });
      } else if (result.reason === 'event_full') {
        res.status(400).json({ success: false, error: { code: "EVENT_FULL", message: "Cet événement est complet." } });
      } else {
        res.status(400).json({ success: false, error: { code: "UNKNOWN_ERROR", message: result.reason } });
      }
    }
  } catch (e) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Une erreur est survenue." } });
  }
});

// PATIENTS (auth JWT) - Sprint 7 : Liste des inscriptions du patient
router.get('/my/registrations', authMiddleware, async (req, res) => {
  try {
    const registrations = await getPatientRegistrations(req.user.phone);
    ok(res, registrations);
  } catch (err) {
    err(res, 500, err.message);
  }
});

// ORGANISATEUR (auth JWT) - Sprint 7 : Check-in via token UUID
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const { phone } = req.user;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token requis' });
    }
    
    const result = await processCheckin({ token, organizer_phone: phone, callerRole: req.user.role });

    if (result.success) {
      res.json({ success: true, points_credited: result.points_credited });
    } else if (result.reason === 'not_organizer') {
      res.status(403).json({ success: false, reason: result.reason, message: "Vous n'êtes pas l'organisateur de cet événement." });
    } else {
      res.status(400).json({ success: false, reason: result.reason });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur check-in' });
  }
});

// ORGANISATEUR ou ADMIN (auth JWT) - Sprint 7 : Liste des inscrits à un événement
router.get('/:id/registrations', authMiddleware, async (req, res) => {
  try {
    const result = await getEventRegistrations(req.params.id);
    ok(res, result);
  } catch (err) {
    err(res, 500, err.message);
  }
});

// PATIENTS (auth JWT) - Liste des participants avec Zora points
router.get('/:id/participants', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = require('../config/db');
    
    const result = await pool.query(`
      SELECT
        er.phone,
        COALESCE(u.first_name, '') AS prenom,
        COALESCE(u.last_name, '') AS nom,
        u.photo_url,
        COALESCE(SUM(zl.points), 0) AS zora_total
      FROM elonga_registrations er
      LEFT JOIN users u ON u.phone = er.phone
      LEFT JOIN zora_ledger zl ON zl.phone = er.phone
      WHERE er.event_id = $1
      GROUP BY er.phone, u.first_name, u.last_name, u.photo_url
      ORDER BY zora_total DESC
    `, [id]);
    
    const participants = result.rows.map(p => ({
      phone: p.phone,
      full_name: `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Participant',
      photo_url: p.photo_url,
      zora_points: parseInt(p.zora_total) || 0
    }));
    
    return res.json({ success: true, data: participants });
  } catch (error) {
    console.error('[participants]', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ADMIN - Sprint 5
router.put('/:id', authMiddleware.requireAdmin, updateEvent);
router.delete('/:id', authMiddleware.requireAdmin, deleteEvent);

// ADMIN - Sprint 7 : Créer événement avec status='pending'
router.post('/', authMiddleware, upload.single('cover'), uploadEvent, async (req, res) => {
  try {
    // Ajouter l'URL Cloudinary au body si upload réussi
    if (req.cloudinaryUrl) {
      req.body.cover_image_path = req.cloudinaryUrl;
    }
    const result = await createEventService(req.body, req.user.phone);
    if (result.success) {
      ok(res, result);
    } else {
      err(res, 400, 'Erreur création événement');
    }
  } catch (err) {
    err(res, 500, err.message);
  }
});

// ADMIN - Sprint 7 : Publier événement
router.patch('/:id/publish', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await publishEvent(req.params.id, req.user.phone);
    if (result.success) {
      ok(res, { message: 'Événement publié' });
    } else {
      err(res, 400, result.error);
    }
  } catch (err) {
    err(res, 500, err.message);
  }
});

// ADMIN - Sprint 7 : Liste des événements en attente
router.get('/admin/events/pending', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const events = await getPendingEvents();
    ok(res, events);
  } catch (err) {
    err(res, 500, err.message);
  }
});

// ANIMATEUR ou ADMIN - Sprint 7 : Activer événement (published → active)
router.patch('/:id/activate', authMiddleware, async (req, res) => {
  try {
    // Vérifier rôle animateur ou admin
    if (req.user.role !== 'animateur' && req.user.role !== 'admin') {
      return err(res, 403, 'Accès réservé aux animateurs et admins');
    }
    
    const result = await activateEvent(req.params.id, req.user.phone);
    if (result.success) {
      ok(res, { message: 'Événement activé' });
    } else {
      err(res, 400, result.error);
    }
  } catch (error) {
    err(res, 500, error.message);
  }
});

// ANIMATEUR ou ADMIN - Sprint 7 : Compléter événement (active → completed) + créditer Zora
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    // Vérifier rôle animateur ou admin
    if (req.user.role !== 'animateur' && req.user.role !== 'admin') {
      return err(res, 403, 'Accès réservé aux animateurs et admins');
    }
    
    const result = await completeEvent(req.params.id, req.user.phone);
    if (result.success) {
      ok(res, { 
        message: 'Événement complété',
        checkins_count: result.checkins_count,
        zora_distributed: result.zora_distributed
      });
    } else {
      err(res, 400, result.error);
    }
  } catch (error) {
    err(res, 500, error.message);
  }
});

// ADMIN - Sprint 7 : Historique des check-ins avec filtres et pagination
router.get('/admin/checkins/history', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const { event_id, date, animateur_phone, limit = 50, offset = 0 } = req.query;
    
    const pool = require('../config/db');
    
    // Construire la requête avec filtres dynamiques
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (event_id) {
      whereClause += ` AND ecl.event_id = $${paramIndex}`;
      params.push(event_id);
      paramIndex++;
    }
    
    if (date) {
      whereClause += ` AND DATE(ecl.checked_in_at) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    
    if (animateur_phone) {
      whereClause += ` AND ecl.animateur_phone = $${paramIndex}`;
      params.push(animateur_phone);
      paramIndex++;
    }
    
    // Requête principale avec pagination
    const result = await pool.query(
      `SELECT 
        ecl.id,
        ecl.registration_id,
        ecl.event_id,
        ecl.patient_phone,
        ecl.animateur_phone,
        ecl.scan_method,
        ecl.checked_in_at,
        ecl.zora_credited,
        ee.title as event_title,
        u.first_name as patient_first_name,
        u.last_name as patient_last_name,
        a.first_name as animateur_first_name,
        a.last_name as animateur_last_name
       FROM event_checkin_log ecl
       JOIN elonga_events ee ON ecl.event_id = ee.id
       LEFT JOIN users u ON ecl.patient_phone = u.phone
       LEFT JOIN users a ON ecl.animateur_phone = a.phone
       ${whereClause}
       ORDER BY ecl.checked_in_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    // Compte total pour pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM event_checkin_log ecl ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    ok(res, {
      checkins: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (err) {
    err(res, 500, err.message);
  }
});

module.exports = router;
