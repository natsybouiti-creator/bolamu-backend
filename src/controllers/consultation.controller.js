const consultationService = require('../services/consultation.service');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');
const pool = require('../config/db');

async function openConsultation(req, res) {
  try {
    const { patient_phone, appointment_id } = req.body;
    const doctor_phone = req.user.phone;

    const result = await consultationService.openConsultation(
      doctor_phone,
      patient_phone,
      appointment_id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'ABONNEMENT_INACTIF') {
      return res.status(400).json({ 
        success: false, 
        error: 'ABONNEMENT_INACTIF',
        message: 'Le patient n\'a pas d\'abonnement actif'
      });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function closeConsultation(req, res) {
  try {
    const { id } = req.params;
    const { diagnostic, anamnese, examen_clinique, notes } = req.body;
    const doctor_phone = req.user.phone;

    const result = await consultationService.closeConsultation(
      id,
      doctor_phone,
      { diagnostic, anamnese, examen_clinique, notes_confidentielles: notes }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'CONSULTATION_NOT_FOUND') {
      return res.status(404).json({ 
        success: false, 
        error: 'CONSULTATION_NOT_FOUND'
      });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function getActiveQueue(req, res) {
  try {
    const doctor_phone = req.user.phone;
    const queue = await consultationService.getActiveQueue(doctor_phone);
    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function getPatientHistory(req, res) {
  try {
    const { phone } = req.params;
    const doctor_phone = req.user.phone;

    const history = await consultationService.getPatientHistory(phone, doctor_phone);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function saveTranscript(req, res) {
  try {
    const { id } = req.params;
    const { text, duration_seconds } = req.body;
    const doctor_phone = req.user?.phone;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Texte transcrit requis.' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ success: false, error: 'Texte trop long (max 10 000 caractères).' });
    }

    const appt = await pool.query(
      `SELECT a.id, a.patient_phone, d.phone as doctor_phone
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = $1`,
      [id]
    );
    if (appt.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'RDV introuvable.' });
    }
    if (appt.rows[0].doctor_phone !== doctor_phone) {
      return res.status(403).json({ success: false, error: 'Ce RDV ne vous appartient pas.' });
    }

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('dictaphone.transcription', $1, 'consultations', $2, $3::jsonb)`,
      [doctor_phone, id, JSON.stringify({
        patient_phone: appt.rows[0].patient_phone,
        text_length: text.length,
        duration_seconds: parseInt(duration_seconds || 0),
        source: 'browser'
      })]
    );

    return res.json({
      success: true,
      message: 'Transcription réceptionnée.',
      text_length: text.length
    });
  } catch (error) {
    console.error('[saveTranscript] Erreur :', error.message);
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
}

module.exports = {
  openConsultation,
  closeConsultation,
  getActiveQueue,
  getPatientHistory,
  saveTranscript
};
