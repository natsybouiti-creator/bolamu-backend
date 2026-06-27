// ============================================================
// BOLAMU — Boucle 3 : Contrôleur Animateur
// ============================================================
const { 
  getStats, 
  getMyEvents, 
  createElongaEvent, 
  checkinPatient, 
  getTodayCheckins, 
  getMyClubs, 
  notifyClub,
  getEventRegistrations 
} = require('../services/animateur.service');
const logger = require('../config/logger');

/**
 * GET /animateur/stats
 * Statistiques globales animateur
 */
async function getStatsController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const stats = await getStats(animateur_phone);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] getStats error:', error);
    res.status(500).json({ error: 'Erreur récupération stats' });
  }
}

/**
 * GET /animateur/events
 * Liste des événements organisés
 */
async function getMyEventsController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const limit = parseInt(req.query.limit) || 20;
    const events = await getMyEvents(animateur_phone, limit);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] getMyEvents error:', error);
    res.status(500).json({ error: 'Erreur récupération événements' });
  }
}

/**
 * POST /animateur/events
 * Créer un événement Elonga
 */
async function createElongaEventController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const result = await createElongaEvent(req.body, animateur_phone);
    res.status(201).json(result);
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] createElongaEvent error:', error);
    res.status(400).json({ error: error.message });
  }
}

/**
 * GET /animateur/clubs
 * Clubs assignés à l'animateur
 */
async function getMyClubsController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const clubs = await getMyClubs(animateur_phone);
    res.json({ success: true, data: clubs });
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] getMyClubs error:', error);
    res.status(500).json({ error: 'Erreur récupération clubs' });
  }
}

/**
 * GET /animateur/checkins/today
 * Check-ins du jour
 */
async function getTodayCheckinsController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const checkins = await getTodayCheckins(animateur_phone);
    res.json({ success: true, data: checkins });
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] getTodayCheckins error:', error);
    res.status(500).json({ error: 'Erreur récupération check-ins' });
  }
}

/**
 * POST /events/:id/checkin
 * Check-in patient (QR token ou code)
 */
async function checkinPatientController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const { id: event_id } = req.params;
    const { qr_token, session_code } = req.body;
    
    const tokenOrCode = qr_token || session_code;
    if (!tokenOrCode) {
      return res.status(400).json({ error: 'qr_token ou session_code requis' });
    }
    
    const result = await checkinPatient(tokenOrCode, animateur_phone, parseInt(event_id));
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] checkinPatient error:', error);
    res.status(500).json({ error: 'Erreur check-in' });
  }
}

/**
 * POST /animateur/clubs/:id/notify
 * Notifier tous les membres d'un club
 */
async function notifyClubController(req, res) {
  try {
    const animateur_phone = req.user.phone;
    const { id: club_id } = req.params;
    const { message_type, params } = req.body;
    
    if (!message_type || !params) {
      return res.status(400).json({ error: 'message_type et params requis' });
    }
    
    const result = await notifyClub(parseInt(club_id), animateur_phone, message_type, params);
    res.json(result);
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] notifyClub error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /animateur/events/:id/registrations
 * Liste des inscrits à un événement
 */
async function getEventRegistrationsController(req, res) {
  try {
    const { id: event_id } = req.params;
    const result = await getEventRegistrations(parseInt(event_id));
    res.json(result);
  } catch (error) {
    logger.error('[ANIMATEUR CTRL] getEventRegistrations error:', error);
    res.status(500).json({ error: 'Erreur récupération inscriptions' });
  }
}

module.exports = {
  getStats: getStatsController,
  getMyEvents: getMyEventsController,
  createElongaEvent: createElongaEventController,
  getMyClubs: getMyClubsController,
  getTodayCheckins: getTodayCheckinsController,
  checkinPatient: checkinPatientController,
  notifyClub: notifyClubController,
  getEventRegistrations: getEventRegistrationsController
};
