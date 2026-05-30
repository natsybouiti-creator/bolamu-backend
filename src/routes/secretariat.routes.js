// ============================================================
// BOLAMU — Routes Secrétariat (Sprint 8)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const secretary = require('../controllers/secretary.controller');
const pool = require('../config/db');

// ============================================================
// ROUTES SECRÉTAIRE
// ============================================================

// POST /api/v1/secretary/login
// Login secrétaire
router.post('/secretary/login', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Numéro requis' });
    
    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, clinic_id 
             FROM users 
             WHERE phone = $1 AND role = 'secretaire' AND is_active = true`,
            [phone]
        );
        
        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Numéro invalide ou compte inactif' });
        }
        
        const user = result.rows[0];
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';
        
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: 'secretaire', clinic_id: user.clinic_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            secretaire: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                clinic_id: user.clinic_id
            }
        });
    } catch (err) {
        console.error('[SECRETARY LOGIN]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/v1/rh/login
// Login RH
router.post('/rh/login', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Numéro requis' });
    
    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, clinic_id 
             FROM users 
             WHERE phone = $1 AND role = 'rh' AND is_active = true`,
            [phone]
        );
        
        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Numéro invalide ou compte inactif' });
        }
        
        const user = result.rows[0];
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';
        
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: 'rh', clinic_id: user.clinic_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            rh: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                clinic_id: user.clinic_id
            }
        });
    } catch (err) {
        console.error('[RH LOGIN]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET /api/v1/secretary/agenda/:doctor_id
// Agenda d'un médecin pour une date
router.get('/secretary/agenda/:doctor_id', authMiddleware, authMiddleware.requireSecretary, secretary.getAgenda);

// POST /api/v1/secretary/appointments
// Créer RDV présentiel
router.post('/secretary/appointments', authMiddleware, authMiddleware.requireSecretary, secretary.createAppointment);

// POST /api/v1/secretary/rdv-manuel
// Créer RDV manuel à l'accueil (avec double booking check)
router.post('/secretary/rdv-manuel', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const { patient_phone, doctor_id, date, time, motif, is_urgent, created_by } = req.body;
    if (!patient_phone || !doctor_id || !date || !time) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }
    // Double booking check
    const existing = await pool.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3
       AND status NOT IN ('annule','refuse')`,
      [doctor_id, date, time]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Ce créneau est déjà réservé' });
    }
    const result = await pool.query(
      `INSERT INTO appointments 
        (patient_phone, doctor_id, appointment_date, appointment_time, status, motif, is_urgent, created_by)
       VALUES ($1, $2, $3, $4, 'confirme', $5, $6, $7)
       RETURNING *`,
      [patient_phone, doctor_id, date, time, motif || null, is_urgent || false, created_by || 'secretariat']
    );
    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) {
    console.error('[RDV MANUEL]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretary/queue/:doctor_id
// File d'attente du jour (date en query param optionnel)
router.get('/secretary/queue/:doctor_id', authMiddleware, authMiddleware.requireSecretary, secretary.getQueue);

// POST /api/v1/secretary/queue
// Ajouter patient en urgence sans RDV préalable
router.post('/secretary/queue', authMiddleware, authMiddleware.requireSecretary, secretary.addToQueue);

// PATCH /api/v1/secretary/queue/:id/status
// Changer statut patient dans file d'attente
router.patch('/secretary/queue/:id/status', authMiddleware, authMiddleware.requireSecretary, secretary.updateQueueStatus);

// POST /api/v1/secretary/agenda-blocks
// Bloquer créneau médecin
router.post('/secretary/agenda-blocks', authMiddleware, authMiddleware.requireSecretary, secretary.createAgendaBlock);

// DELETE /api/v1/secretary/agenda-blocks/:id
// Supprimer blocage
router.delete('/secretary/agenda-blocks/:id', authMiddleware, authMiddleware.requireSecretary, secretary.deleteAgendaBlock);

// GET /api/v1/secretary/stats
// Statistiques flux
router.get('/secretary/stats', authMiddleware, authMiddleware.requireSecretary, secretary.getStats);

// ============================================================
// ROUTES ADMIN
// ============================================================

// GET /api/v1/admin/secretaries
// Liste des secrétaires
router.get('/admin/secretaries', authMiddleware, authMiddleware.requireAdmin, secretary.getAdminSecretaries);

// POST /api/v1/admin/secretaries
// Créer compte secrétaire
router.post('/admin/secretaries', authMiddleware, authMiddleware.requireAdmin, secretary.createSecretary);

// POST /api/v1/admin/secretaries/:phone/assign
// Assigner secrétaire à un partenaire
router.post('/admin/secretaries/:phone/assign', authMiddleware, authMiddleware.requireAdmin, secretary.assignSecretary);

module.exports = router;
