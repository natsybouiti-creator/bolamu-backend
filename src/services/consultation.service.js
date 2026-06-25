const db = require('../config/db');
const { normalizePhone } = require('../utils/phoneUtils');
const zoraService = require('./zora.service');
const whatsappService = require('./whatsapp-web.service');

async function openConsultation(doctor_phone, patient_phone, rdv_id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const normalizedDoctor = normalizePhone(doctor_phone);
    const normalizedPatient = normalizePhone(patient_phone);

    // Vérifier abonnement actif
    const subResult = await client.query(
      `SELECT is_active FROM subscriptions 
       WHERE patient_phone = $1 AND is_active = true`,
      [normalizedPatient]
    );

    if (subResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('ABONNEMENT_INACTIF');
    }

    // Créer consultation
    const consultResult = await client.query(
      `INSERT INTO consultations 
       (patient_phone, doctor_phone, rdv_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id`,
      [normalizedPatient, normalizedDoctor, rdv_id]
    );

    const consultation_id = consultResult.rows[0].id;

    // Mettre à jour rendez_vous
    if (rdv_id) {
      await client.query(
        `UPDATE rendez_vous SET status = 'in_progress' 
         WHERE id = $1`,
        [rdv_id]
      );
    }

    // Mettre à jour file_attente
    await client.query(
      `UPDATE file_attente SET statut = 'en_consultation' 
       WHERE patient_phone = $1 AND doctor_phone = $2`,
      [normalizedPatient, normalizedDoctor]
    );

    // Créer ou mettre à jour medical_records
    const mrResult = await client.query(
      `SELECT id FROM medical_records WHERE patient_phone = $1`,
      [normalizedPatient]
    );

    if (mrResult.rows.length === 0) {
      await client.query(
        `INSERT INTO medical_records (patient_phone) VALUES ($1)`,
        [normalizedPatient]
      );
    }

    await client.query('COMMIT');
    return { consultation_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closeConsultation(consultation_id, doctor_phone, data) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const normalizedDoctor = normalizePhone(doctor_phone);

    // Récupérer consultation
    const consultResult = await client.query(
      `SELECT * FROM consultations WHERE id = $1 AND doctor_phone = $2`,
      [consultation_id, normalizedDoctor]
    );

    if (consultResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('CONSULTATION_NOT_FOUND');
    }

    const consultation = consultResult.rows[0];

    // Mettre à jour consultation
    await client.query(
      `UPDATE consultations SET 
       ended_at = NOW(), status = 'completed',
       diagnostic = $1, anamnese = $2, examen_clinique = $3,
       notes_confidentielles = $4
       WHERE id = $5`,
      [data.diagnostic, data.anamnese, data.examen_clinique, 
       data.notes, consultation_id]
    );

    // Mettre à jour medical_records
    await client.query(
      `UPDATE medical_records SET 
       derniere_consultation_at = NOW(),
       antecedents = array_append(antecedents, $1)
       WHERE patient_phone = $2`,
      [data.diagnostic, consultation.patient_phone]
    );

    // Mettre à jour file_attente
    await client.query(
      `UPDATE file_attente SET statut = 'terminé' 
       WHERE patient_phone = $1`,
      [consultation.patient_phone]
    );

    // Notifier WhatsApp patient
    const patientResult = await client.query(
      `SELECT first_name FROM users WHERE phone = $1`,
      [consultation.patient_phone]
    );

    if (patientResult.rows.length > 0) {
      const doctorResult = await client.query(
        `SELECT first_name, last_name FROM users WHERE phone = $1`,
        [normalizedDoctor]
      );

      if (doctorResult.rows.length > 0) {
        const patientName = patientResult.rows[0].first_name;
        const doctorName = `${doctorResult.rows[0].first_name} ${doctorResult.rows[0].last_name}`;
        
        await whatsappService.sendAutoMessage(
          consultation.patient_phone,
          'bolamu_consultation_terminee',
          [patientName, doctorName, data.diagnostic]
        );
      }
    }

    // Créditer 50 Zora au patient
    await zoraService.recalculateBalance(consultation.patient_phone, 50, 'consultation');

    await client.query('COMMIT');
    return { consultation_id, status: 'completed' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getPatientHistory(patient_phone, doctor_phone) {
  const normalizedPatient = normalizePhone(patient_phone);
  const normalizedDoctor = normalizePhone(doctor_phone);

  const result = await db.query(
    `SELECT c.*, o.id as ordonnance_id, o.status as ordonnance_status
     FROM consultations c
     LEFT JOIN ordonnances o ON o.consultation_id = c.id
     WHERE c.patient_phone = $1
     ORDER BY c.started_at DESC`,
    [normalizedPatient]
  );

  return result.rows;
}

async function getActiveQueue(doctor_phone) {
  const normalizedDoctor = normalizePhone(doctor_phone);

  const result = await db.query(
    `SELECT fa.*, u.first_name, u.last_name 
     FROM file_attente fa
     JOIN users u ON u.phone = fa.patient_phone
     WHERE fa.doctor_phone = $1 
     AND fa.statut IN ('en_attente', 'en_consultation')
     ORDER BY fa.heure_arrivee ASC`,
    [normalizedDoctor]
  );

  return result.rows;
}

module.exports = {
  openConsultation,
  closeConsultation,
  getPatientHistory,
  getActiveQueue
};
