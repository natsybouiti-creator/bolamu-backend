const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { registerDoctor, getDoctors, updateDoctorStatus, getDoctorProfile, generatePatientQRCode, createTimeSlot, getTimeSlots, updateTimeSlot, updateDoctorProfile, deleteTimeSlot } = require('../controllers/doctor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { normalizePhone } = require('../utils/phone');
const { strictLimiter } = require('../middleware/rateLimiter');
const { logAccess } = require('../services/dmn.service');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

router.post('/register', strictLimiter, upload.single('document'), registerDoctor);
router.get('/', getDoctors);

router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM users WHERE role = 'doctor' AND is_active = false LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/:id/status', authMiddleware.requireAdmin, updateDoctorStatus);

router.get('/profil', authMiddleware, doctorOnly, getDoctorProfile);

// Modifier le profil médecin
router.patch('/profil', authMiddleware, doctorOnly, updateDoctorProfile);

// Générer QR Code pour un patient (côté médecin)
router.get('/patients/:phone/qrcode', authMiddleware, generatePatientQRCode);

// Recherche patients (accessible aux médecins)
router.get('/patients/search', authMiddleware, doctorOnly, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q}%`;
    const result = await pool.query(
      `SELECT u.phone, u.full_name, u.photo_url, u.city, u.is_active
       FROM users u
       WHERE u.role = 'patient'
       AND u.is_active = true
       AND (u.full_name ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY u.full_name
       LIMIT 20`,
      [searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[doctor-patients-search]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créneaux horaires
router.post('/slots', authMiddleware, createTimeSlot);
router.get('/slots', authMiddleware, getTimeSlots);
router.patch('/slots/:id', authMiddleware, updateTimeSlot);
router.delete('/slots/:id', authMiddleware, deleteTimeSlot);

router.post('/change-password', authMiddleware, strictLimiter, async (req, res) => {
  const phone = req.user.phone;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
  if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE phone = $1`, [phone]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable' });
    const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [newHash, phone]);
    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch(e) {
    console.error('[change-password]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/doctors/photo - Upload photo de profil
router.post('/photo', authMiddleware, doctorOnly, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);

    // Upload vers Cloudinary folder bolamu/doctors/
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/doctors', {
      public_id: `doctor_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    // Mettre à jour la table doctors
    await pool.query(
      'UPDATE doctors SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    // Mettre à jour la table users aussi pour cohérence
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('DOCTOR_PHOTO_UPDATE', $1, 'doctors', 
         (SELECT id FROM doctors WHERE phone = $2), $3::jsonb)`,
      [phone, phone, JSON.stringify({ photo_url: uploadResult.secure_url })]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[doctor-photo]', err.message);
    
    // Gestion spécifique erreur multer LIMIT_FILE_SIZE
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
    }
    
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/doctors/patients/:patientPhone/profile - Profil patient + statut accès dossier
router.get('/patients/:patientPhone/profile', authMiddleware, doctorOnly, async (req, res) => {
  try {
    const { patientPhone } = req.params;
    const normalizedPatientPhone = normalizePhone(patientPhone);
    const doctorUserRes = await pool.query('SELECT id FROM users WHERE phone = $1', [req.user.phone]);
    const doctorId = doctorUserRes.rows[0]?.id;
    if (!doctorId) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });

    // Profil patient
    const patientResult = await pool.query(
      `SELECT u.id, u.phone, u.first_name, u.last_name, u.photo_url, u.created_at,
              s.plan, s.status AS sub_status
       FROM users u
       LEFT JOIN subscriptions s ON s.patient_phone = u.phone AND s.status = 'active'
       WHERE u.phone = $1 AND u.role = 'patient'`,
      [normalizedPatientPhone]
    );

    if (!patientResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Patient introuvable' });
    }

    const patient = patientResult.rows[0];

    // Statut accès dossier
    const accessResult = await pool.query(
      `SELECT status FROM dossier_access_requests
       WHERE doctor_user_id = $1 AND patient_phone = $2`,
      [doctorId, normalizedPatientPhone]
    );

    const dossier_access = accessResult.rows.length ? accessResult.rows[0].status : 'none';

    res.json({
      success: true,
      data: {
        patient: {
          phone: patient.phone,
          first_name: patient.first_name,
          last_name: patient.last_name,
          full_name: [patient.first_name, patient.last_name].filter(Boolean).join(' '),
          photo_url: patient.photo_url,
          created_at: patient.created_at,
          sub_status: patient.sub_status,
          plan: patient.plan
        },
        dossier_access
      }
    });
  } catch (err) {
    console.error('[patient-profile]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/doctors/patients/:patientPhone/request-access - Demander accès dossier
router.post('/patients/:patientPhone/request-access', authMiddleware, doctorOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const { patientPhone } = req.params;
    const normalizedPatientPhone = normalizePhone(patientPhone);
    const doctorUserRes = await client.query('SELECT id FROM users WHERE phone = $1', [req.user.phone]);
    const doctorId = doctorUserRes.rows[0]?.id;
    if (!doctorId) {
      return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
    }

    await client.query('BEGIN');

    // Insérer ou mettre à jour la demande
    const insertResult = await client.query(
      `INSERT INTO dossier_access_requests (doctor_user_id, patient_phone, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (doctor_user_id, patient_phone)
       DO UPDATE SET status = 'pending', requested_at = NOW(), responded_at = NULL
       RETURNING id`,
      [doctorId, normalizedPatientPhone]
    );

    // Récupérer infos médecin pour notification
    const doctorResult = await client.query(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [doctorId]
    );

    if (doctorResult.rows.length) {
      const doctorName = `${doctorResult.rows[0].first_name} ${doctorResult.rows[0].last_name}`;

      // Notification WhatsApp (sendAutoMessage)
      try {
        const { sendAutoMessage } = require('../services/whatsapp.service');
        await sendAutoMessage(normalizedPatientPhone, 'DOSSIER_ACCESS_REQUEST', {
          doctorName
        });
      } catch (notifErr) {
        console.error('[whatsapp-notification]', notifErr.message);
        // Non bloquant
      }
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('DOSSIER_ACCESS_REQUEST', $1, 'dossier_access_requests',
         (SELECT id FROM dossier_access_requests WHERE doctor_user_id = $2 AND patient_phone = $3), $4::jsonb)`,
      [req.user.phone, doctorId, normalizedPatientPhone, JSON.stringify({ patient_phone: normalizedPatientPhone })]
    );

    await client.query('COMMIT');
    res.json({ success: true, request_id: insertResult.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[request-access]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// GET /api/v1/doctors/patients/:patientPhone/dossier - Accès dossier médical
router.get('/patients/:patientPhone/dossier', authMiddleware, doctorOnly, async (req, res) => {
  try {
    const { patientPhone } = req.params;
    const normalizedPatientPhone = normalizePhone(patientPhone);
    const doctorUserRes = await pool.query('SELECT id FROM users WHERE phone = $1', [req.user.phone]);
    const doctorId = doctorUserRes.rows[0]?.id;
    if (!doctorId) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });

    // Vérifier accès granted
    const accessResult = await pool.query(
      `SELECT id, status FROM dossier_access_requests
       WHERE doctor_user_id = $1 AND patient_phone = $2`,
      [doctorId, normalizedPatientPhone]
    );

    if (!accessResult.rows.length || accessResult.rows[0].status !== 'granted') {
      return res.status(403).json({ success: false, error: 'ACCESS_DENIED' });
    }

    // BHP : journalisation dmn_access_log (traçabilité Loi 29-2019)
    logAccess(
      normalizedPatientPhone,
      req.user.phone,
      'consultation',
      { source: 'doctor_dashboard_consent', request_id: accessResult.rows[0].id },
      req.ip
    ).catch(() => {});

    // Constantes médicales (depuis users)
    const constantesResult = await pool.query(
      `SELECT groupe_sanguin, allergies, maladies_chroniques, antecedents_medicaux,
              traitements_en_cours, poids, taille, contact_urgence_nom,
              contact_urgence_phone, contact_urgence_lien, constantes_updated_at
       FROM users WHERE phone = $1`,
      [normalizedPatientPhone]
    );

    // Ordonnances récentes
    const prescriptionsResult = await pool.query(
      `SELECT id, doctor_phone, medications, instructions, status, created_at
       FROM prescriptions
       WHERE patient_phone = $1
       ORDER BY created_at DESC LIMIT 10`,
      [normalizedPatientPhone]
    );

    // Timeline complète du patient (consultations, comptes rendus, prescriptions, ordonnances, labo)
    const timelineBase = await pool.query(
      `SELECT
          c.id as consultation_id,
          c.appointment_id,
          c.started_at,
          c.ended_at,
          c.status as consultation_status,
          a.appointment_date,
          a.appointment_time,
          a.session_code,
          a.report_submitted,
          a.status as appointment_status,
          d.phone as doctor_phone,
          d.full_name as doctor_name,
          d.specialty as doctor_specialty,
          d.photo_url as doctor_photo_url,
          cr.motif as cr_motif,
          cr.observations,
          cr.diagnostic as cr_diagnostic,
          cr.traitement,
          cr.prochaine_etape,
          cr.created_at as report_created_at
       FROM consultations c
       LEFT JOIN appointments a ON a.id = c.appointment_id
       LEFT JOIN doctors d ON d.phone = c.doctor_phone
       LEFT JOIN LATERAL (
           SELECT * FROM consultation_reports
           WHERE appointment_id = c.appointment_id
           ORDER BY created_at DESC
           LIMIT 1
       ) cr ON true
       WHERE c.patient_phone = $1
       ORDER BY COALESCE(a.appointment_date, c.started_at::date) DESC,
                COALESCE(a.appointment_time, c.started_at::time) DESC`,
      [normalizedPatientPhone]
    );

    const appointmentIds = timelineBase.rows.map(r => r.appointment_id).filter(Boolean);
    const consultationIds = timelineBase.rows.map(r => r.consultation_id);

    const [timelinePrescriptionsAgg, timelineOrdonnancesAgg, timelineLabAgg] = await Promise.all([
      appointmentIds.length ? pool.query(
        `SELECT appointment_id,
                COALESCE(jsonb_agg(jsonb_build_object(
                    'id', id,
                    'medications', medications,
                    'instructions', instructions,
                    'status', status,
                    'is_ssp', is_ssp,
                    'created_at', created_at
                ) ORDER BY created_at DESC), '[]'::jsonb) as items
         FROM prescriptions
         WHERE appointment_id = ANY($1::int[])
         GROUP BY appointment_id`,
        [appointmentIds]
      ) : { rows: [] },
      consultationIds.length ? pool.query(
        `SELECT o.consultation_id,
                o.id as ordonnance_id,
                o.issued_at,
                o.status,
                COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'medicament', oi.medicament,
                        'dosage', oi.dosage,
                        'frequence', oi.frequence,
                        'duree', oi.duree,
                        'instructions', oi.instructions,
                        'quantite', oi.quantite
                    ) ORDER BY oi.id)
                    FROM ordonnance_items oi
                    WHERE oi.ordonnance_id = o.id
                ), '[]'::jsonb) as items
         FROM ordonnances o
         WHERE o.consultation_id = ANY($1::int[])`,
        [consultationIds]
      ) : { rows: [] },
      appointmentIds.length ? pool.query(
        `SELECT lp.appointment_id,
                lp.id as lab_prescription_id,
                lp.examens,
                lp.instructions,
                lp.status,
                lp.prescription_code,
                lp.is_ssp,
                COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'resultats', lr.resultats,
                        'fichier_url', lr.fichier_url,
                        'status', lr.status,
                        'created_at', lr.created_at
                    ) ORDER BY lr.created_at DESC)
                    FROM lab_results lr
                    WHERE lr.lab_prescription_id = lp.id
                ), '[]'::jsonb) as results
         FROM lab_prescriptions lp
         WHERE lp.appointment_id = ANY($1::int[])`,
        [appointmentIds]
      ) : { rows: [] }
    ]);

    const prescriptionsMap = {};
    timelinePrescriptionsAgg.rows.forEach(row => { prescriptionsMap[row.appointment_id] = row.items; });

    const ordonnancesMap = {};
    timelineOrdonnancesAgg.rows.forEach(row => {
      if (!ordonnancesMap[row.consultation_id]) ordonnancesMap[row.consultation_id] = [];
      ordonnancesMap[row.consultation_id].push({
        id: row.ordonnance_id,
        issued_at: row.issued_at,
        status: row.status,
        items: row.items
      });
    });

    const labMap = {};
    timelineLabAgg.rows.forEach(row => {
      if (!labMap[row.appointment_id]) labMap[row.appointment_id] = [];
      labMap[row.appointment_id].push({
        id: row.lab_prescription_id,
        examens: row.examens,
        instructions: row.instructions,
        status: row.status,
        prescription_code: row.prescription_code,
        is_ssp: row.is_ssp,
        results: row.results
      });
    });

    const consultations = timelineBase.rows.map(r => {
      const report = r.report_created_at ? {
        motif: r.cr_motif,
        observations: r.observations,
        diagnostic: r.cr_diagnostic,
        traitement: r.traitement,
        prochaine_etape: r.prochaine_etape,
        created_at: r.report_created_at
      } : null;
      return {
        consultation_id: r.consultation_id,
        appointment_id: r.appointment_id,
        appointment_date: r.appointment_date,
        appointment_time: r.appointment_time,
        started_at: r.started_at,
        status: r.appointment_status || r.consultation_status,
        session_code: r.session_code,
        report_submitted: r.report_submitted,
        doctor_phone: r.doctor_phone,
        doctor_name: r.doctor_name,
        doctor_specialty: r.doctor_specialty,
        doctor_photo_url: r.doctor_photo_url,
        consultation_report: report,
        prescriptions: prescriptionsMap[r.appointment_id] || [],
        ordonnances: ordonnancesMap[r.consultation_id] || [],
        lab_exams: labMap[r.appointment_id] || []
      };
    });

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('DOSSIER_ACCESS_VIEW', $1, 'users',
         (SELECT id FROM users WHERE phone = $2), $3::jsonb)`,
      [req.user.phone, normalizedPatientPhone, JSON.stringify({ patient_phone: normalizedPatientPhone })]
    );

    res.json({
      success: true,
      data: {
        constantes: constantesResult.rows[0] || null,
        prescriptions: prescriptionsResult.rows,
        consultations: consultations
      }
    });
  } catch (err) {
    console.error('[patient-dossier]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;