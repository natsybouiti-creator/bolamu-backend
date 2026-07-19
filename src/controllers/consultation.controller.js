const consultationService = require('../services/consultation.service');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');

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

module.exports = {
  openConsultation,
  closeConsultation,
  getActiveQueue,
  getPatientHistory
};
