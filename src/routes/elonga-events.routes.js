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
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// PUBLICS
router.get('/', getEvents);
router.get('/:id', getEventById);

// PATIENTS (auth JWT)
router.post('/:id/register', authenticateToken, registerEvent);
router.delete('/:id/register', authenticateToken, cancelEventRegistration);
router.get('/:id/checkin-token', authenticateToken, getCheckinToken);
router.get('/my/registrations', authenticateToken, getMyRegistrations);

// ORGANISATEUR (auth JWT)
router.post('/:id/checkin', authenticateToken, checkinEvent);

// ADMIN
router.post('/', requireAdmin, createEvent);
router.put('/:id', requireAdmin, updateEvent);
router.delete('/:id', requireAdmin, deleteEvent);

module.exports = router;
