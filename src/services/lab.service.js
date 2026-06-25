const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('./whatsapp-web.service');

async function getPrescriptionsEnAttente(lab_phone) {
  const normalizedPhone = normalizePhone(lab_phone);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT lp.id, lp.patient_phone, lp.doctor_phone, lp.examens, lp.instructions, 
              lp.created_at, lp.priorite, lp.prescription_code,
              u.first_name, u.last_name,
              d.full_name as doctor_name
       FROM lab_prescriptions lp
       LEFT JOIN users u ON lp.patient_phone = u.phone
       LEFT JOIN doctors d ON lp.doctor_phone = d.phone
       WHERE lp.status = 'pending'
       ORDER BY lp.priorite DESC, lp.created_at ASC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function soumettreResultats(prescription_id, lab_phone, resultats) {
  const normalizedPhone = normalizePhone(lab_phone);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prescriptionCheck = await client.query(
      `SELECT * FROM lab_prescriptions WHERE id = $1 AND status = 'pending'`,
      [prescription_id]
    );
    if (prescriptionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Prescription introuvable ou non disponible');
    }

    const prescription = prescriptionCheck.rows[0];

    for (const resultat of resultats) {
      await client.query(
        `INSERT INTO lab_results (lab_prescription_id, patient_phone, lab_phone, doctor_phone, resultats, status)
         VALUES ($1, $2, $3, $4, $5, 'completed')`,
        [prescription_id, prescription.patient_phone, normalizedPhone, prescription.doctor_phone, JSON.stringify(resultat)]
      );
    }

    await client.query(
      `UPDATE lab_prescriptions SET status = 'completed' WHERE id = $1`,
      [prescription_id]
    );

    const tarifResult = await client.query(
      `SELECT tarif_fcfa FROM partner_zones WHERE partner_phone = $1 AND partner_type = 'laboratoire'`,
      [normalizedPhone]
    );
    const tarif = tarifResult.rows[0]?.tarif_fcfa || 5000;

    const clearingResult = await client.query(
      `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ($1, 'laboratoire', $2, 'lab_prescription', $3, 'pending')
       RETURNING id`,
      [normalizedPhone, prescription_id, tarif]
    );

    const patientResult = await client.query(
      `SELECT first_name FROM users WHERE phone = $1`,
      [prescription.patient_phone]
    );
    const patientName = patientResult.rows[0]?.first_name || 'Patient';

    const laboResult = await client.query(
      `SELECT name FROM laboratories WHERE phone = $1`,
      [normalizedPhone]
    );
    const laboName = laboResult.rows[0]?.name || 'Laboratoire';

    setImmediate(async () => {
      try {
        await sendAutoMessage(prescription.patient_phone, 'bolamu_resultats_disponibles', [patientName, laboName]);
      } catch (e) {
        console.error('[WhatsApp] Erreur notification résultats:', e.message);
      }
    });

    await client.query('COMMIT');
    return { success: true, resultats_count: resultats.length, clearing_id: clearingResult.rows[0].id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getResultats(prescription_id, requester_phone, role) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT lr.*, lp.examens, lp.instructions as prescription_instructions
       FROM lab_results lr
       LEFT JOIN lab_prescriptions lp ON lr.lab_prescription_id = lp.id
       WHERE lr.lab_prescription_id = $1`,
      [prescription_id]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = { getPrescriptionsEnAttente, soumettreResultats, getResultats };
