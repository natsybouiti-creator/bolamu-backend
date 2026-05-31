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

// POST /api/v1/secretariat/login
// Login secrétaire
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis' });
        }

        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, clinic_id, password_hash
             FROM users
             WHERE phone = $1 AND role = 'secretaire' AND is_active = true`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Compte secrétaire introuvable' });
        }

        const user = result.rows[0];

        // Vérifier le mot de passe
        console.log('[SECRETARY LOGIN DEBUG] phone:', phone);
        console.log('[SECRETARY LOGIN DEBUG] password reçu:', password ? 'OUI (longueur: ' + password.length + ')' : 'NON/VIDE');
        console.log('[SECRETARY LOGIN DEBUG] hash en base:', user.password_hash ? user.password_hash.substring(0, 20) : 'NULL');
        const bcrypt = require('bcrypt');
        const valid = await bcrypt.compare(password, user.password_hash);
        console.log('[SECRETARY LOGIN DEBUG] bcrypt.compare result:', valid);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: 'secretaire', clinic_id: user.clinic_id },
            JWT_SECRET,
            { expiresIn: '8h' }
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
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/v1/secretariat/rh/login
// Login RH
router.post('/rh/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis' });
        }

        const result = await pool.query(
            `SELECT u.id, u.full_name, u.phone, u.role, u.is_active, u.company_id, u.password_hash, c.name as company_name
             FROM users u
             LEFT JOIN companies c ON c.id = u.company_id
             WHERE u.phone = $1 AND u.role = 'rh' AND u.is_active = true`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Compte RH introuvable' });
        }

        const user = result.rows[0];

        // Vérifier le mot de passe
        const bcrypt = require('bcrypt');
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: 'rh', company_id: user.company_id },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            rh: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                company_id: user.company_id,
                company_name: user.company_name
            }
        });
    } catch (err) {
        console.error('[RH LOGIN]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/v1/secretariat/agenda?doctor_id=X&date=YYYY-MM-DD
router.get('/agenda', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const doctor_id = parseInt(req.query.doctor_id);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const clinicId = req.user.clinic_id;

    if (!doctor_id) {
      return res.status(400).json({ success: false, message: 'doctor_id requis' });
    }

    const doctorCheck = await pool.query(
      `SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2`,
      [doctor_id, clinicId]
    );
    if (!doctorCheck.rows.length) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const result = await pool.query(
      `SELECT a.id, a.patient_phone, a.appointment_date,
              a.appointment_time, a.status, a.motif,
              u.full_name as patient_name,
              s.motif as symptomes_motif
       FROM appointments a
       LEFT JOIN users u ON u.phone = a.patient_phone
       LEFT JOIN appointment_symptoms s ON s.appointment_id = a.id
       WHERE a.doctor_id = $1 AND a.appointment_date = $2
       ORDER BY a.appointment_time`,
      [doctor_id, date]
    );

    res.json({ success: true, appointments: result.rows });
  } catch(err) {
    console.error('[AGENDA]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretary/agenda/:doctor_id
// Agenda d'un médecin pour une date
router.get('/secretary/agenda/:doctor_id', authMiddleware, authMiddleware.requireSecretary, secretary.getAgenda);

// POST /api/v1/secretary/appointments
// Créer RDV présentiel
router.post('/secretary/appointments', authMiddleware, authMiddleware.requireSecretary, secretary.createAppointment);

// POST /api/v1/secretariat/rdv-manuel
// Créer RDV manuel à l'accueil (avec double booking check)
router.post('/rdv-manuel', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const { patient_phone, doctor_id, date, time, motif, is_urgent } = req.body;
    if (!patient_phone || !doctor_id || !date || !time) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }
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
       VALUES ($1, $2, $3, $4, 'confirme', $5, $6, 'secretariat')
       RETURNING *`,
      [patient_phone, doctor_id, date, time, motif || null, is_urgent || false]
    );
    res.json({ success: true, appointment: result.rows[0] });
  } catch(err) {
    console.error('[RDV MANUEL]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

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

// PATCH /api/v1/secretariat/queue/:id/status
// Changer statut patient dans file d'attente
router.patch('/queue/:id/status', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      `UPDATE queue_entries SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

// GET /api/v1/secretariat/dashboard-stats
// Stats dashboard secrétaire
router.get('/dashboard-stats', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const { date } = req.query;
    const clinicId = req.user.clinic_id;
    const queryDate = date || new Date().toISOString().split('T')[0];
    
    const [rdvToday, enAttente, enConsult, medecins] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON d.id = a.doctor_id 
         WHERE d.clinic_id = $1 AND a.appointment_date = $2 AND a.status NOT IN ('annule','refuse')`,
        [clinicId, queryDate]
      ),
      pool.query(
        `SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON d.id = a.doctor_id 
         WHERE d.clinic_id = $1 AND a.appointment_date = $2 AND a.status = 'en_attente'`,
        [clinicId, queryDate]
      ),
      pool.query(
        `SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON d.id = a.doctor_id 
         WHERE d.clinic_id = $1 AND a.appointment_date = $2 AND a.status = 'en_cours'`,
        [clinicId, queryDate]
      ),
      pool.query(
        `SELECT COUNT(*) FROM doctors WHERE clinic_id = $1 AND is_active = true`,
        [clinicId]
      )
    ]);
    
    res.json({ 
      success: true, 
      stats: {
        rdv_today: parseInt(rdvToday.rows[0].count),
        en_attente: parseInt(enAttente.rows[0].count),
        en_consultation: parseInt(enConsult.rows[0].count),
        medecins_disponibles: parseInt(medecins.rows[0].count)
      }
    });
  } catch (err) {
    console.error('[DASHBOARD STATS]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretariat/patients/search
// Recherche patients
router.get('/patients/search', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const { q } = req.query;
    let query, params;
    if (!q || q.length < 2) {
      query = `SELECT id, full_name, phone, statut_abonnement FROM users 
               WHERE role = 'patient' AND is_active = true 
               ORDER BY full_name LIMIT 50`;
      params = [];
    } else {
      query = `SELECT id, full_name, phone, statut_abonnement FROM users 
               WHERE role = 'patient' AND is_active = true
               AND (full_name ILIKE $1 OR phone ILIKE $1)
               ORDER BY full_name LIMIT 20`;
      params = [`%${q}%`];
    }
    const result = await pool.query(query, params);
    res.json({ success: true, patients: result.rows });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretariat/medecins
// Liste médecins de la clinique
router.get('/medecins', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const clinicId = req.user.clinic_id;
    console.log('[MEDECINS] clinic_id:', clinicId);
    
    const result = await pool.query(
      `SELECT d.id, d.full_name, d.specialty, d.is_active,
        COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE AND a.status NOT IN ('annule','refuse')) as rdv_today
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.id
       WHERE d.clinic_id = $1
       GROUP BY d.id ORDER BY d.full_name`,
      [clinicId]
    );
    
    console.log('[MEDECINS] result rows:', result.rows.length);
    res.json({ success: true, medecins: result.rows });
  } catch (err) {
    console.error('[MEDECINS ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretariat/queue
// File d'attente globale
router.get('/queue', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT q.id, q.patient_phone, q.doctor_id, q.status, q.motif,
              q.is_urgent, q.created_at,
              d.full_name as doctor_name,
              u.full_name as patient_name
       FROM queue_entries q
       LEFT JOIN doctors d ON d.id = q.doctor_id
       LEFT JOIN users u ON u.phone = q.patient_phone
       WHERE d.clinic_id = $1
       AND DATE(q.created_at) = $2::date
       ORDER BY q.created_at ASC`,
      [req.user.clinic_id, date]
    );
    res.json({ success: true, queue: result.rows });
  } catch(err) {
    console.error('[QUEUE ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretariat/clinic-info
// Info clinique du secrétaire
router.get('/clinic-info', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, city, address, phone FROM clinics WHERE id = $1`,
      [req.user.clinic_id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Clinique introuvable' });
    res.json({ success: true, clinic: result.rows[0] });
  } catch (err) {
    console.error('[CLINIC INFO]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/secretariat/medecin/:id/disponibilites
// Disponibilités d'un médecin
router.get('/medecin/:id/disponibilites', authMiddleware, authMiddleware.requireSecretary, async (req, res) => {
  try {
    // Vérifier que ce médecin appartient bien à la clinique du secrétaire
    const doc = await pool.query(
      `SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2`,
      [req.params.id, req.user.clinic_id]
    );
    if (!doc.rows.length) return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    
    const result = await pool.query(
      `SELECT day_of_week, start_time, end_time, slot_duration
       FROM doctor_availabilities WHERE doctor_id = $1 AND is_active = true
       ORDER BY day_of_week`,
      [req.params.id]
    );
    res.json({ success: true, disponibilites: result.rows });
  } catch (err) {
    console.error('[MEDECIN DISPONIBILITES]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

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
