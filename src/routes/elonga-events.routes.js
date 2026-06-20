// ============================================================
// BOLAMU — Sprint 5 : Routes Événements Elonga
// ============================================================
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/elonga-events.controller');
const authMiddleware = require('../middleware/auth.middleware');

// PUBLICS
router.get('/', getEvents);
router.get('/:id', getEventById);

// PATIENTS (auth JWT)
router.post('/:id/register', authMiddleware, registerEvent);
router.delete('/:id/register', authMiddleware, cancelEventRegistration);
router.get('/:id/checkin-token', authMiddleware, getCheckinToken);
router.get('/my/registrations', authMiddleware, getMyRegistrations);

// ORGANISATEUR (auth JWT)
router.post('/:id/checkin', authMiddleware, checkinEvent);

// ADMIN
router.post('/', authMiddleware.requireAdmin, createEvent);
router.put('/:id', authMiddleware.requireAdmin, updateEvent);
router.delete('/:id', authMiddleware.requireAdmin, deleteEvent);

module.exports = router;
