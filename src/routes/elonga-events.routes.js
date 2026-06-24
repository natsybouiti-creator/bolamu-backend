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
const {
  registerPatient,
  checkinPatient,
  checkinByCode,
  getPatientRegistrations,
  getEventRegistrations,
  publishEvent,
  createEvent: createEventService,
  getPendingEvents
} = require('../services/event.service');
const authMiddleware = require('../middleware/auth.middleware');
const { ok, err } = require('../utils/apiResponse');

// PUBLICS
router.get('/', getEvents);
router.get('/:id', getEventById);

// PATIENTS (auth JWT)
router.delete('/:id/register', authMiddleware, cancelEventRegistration);
router.get('/:id/checkin-token', authMiddleware, getCheckinToken);

// PATIENTS (auth JWT) - Sprint 7 : Inscription avec session_code et qr_token
router.post('/:id/register', authMiddleware, async (req, res) => {
  try {
    const result = await registerPatient(req.user.phone, req.params.id);
    if (result.success) {
      ok(res, result);
    } else {
      err(res, 400, result.error);
    }
  } catch (err) {
    err(res, 500, err.message);
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

// ORGANISATEUR (auth JWT) - Sprint 5
router.post('/:id/checkin', authMiddleware, checkinEvent);

// ORGANISATEUR (auth JWT) - Sprint 7 : Check-in via QR token ou session_code
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  try {
    const { token, session_code, method } = req.body;
    let result;
    
    if (method === 'qr_scan' && token) {
      result = await checkinPatient(token, req.user.phone, req.params.id);
    } else if (method === 'code_manual' && session_code) {
      result = await checkinByCode(session_code, req.user.phone, req.params.id);
    } else {
      return err(res, 400, 'Paramètres manquants : token ou session_code');
    }
    
    if (result.success) {
      ok(res, result);
    } else {
      err(res, 400, result.error);
    }
  } catch (err) {
    err(res, 500, err.message);
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

// ADMIN - Sprint 5
router.put('/:id', authMiddleware.requireAdmin, updateEvent);
router.delete('/:id', authMiddleware.requireAdmin, deleteEvent);

// ADMIN - Sprint 7 : Créer événement avec status='pending'
router.post('/', authMiddleware, async (req, res) => {
  try {
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

module.exports = router;
