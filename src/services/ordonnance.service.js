const db = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { bhpAccessMiddleware, logAccessAttempt } = require('../middleware/bhpAccess');
const whatsappService = require('./whatsapp-web.service');

async function createOrdonnance(consultation_id, doctor_phone, items) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const normalizedDoctor = normalizePhone(doctor_phone);

    // Vérifier que la consultation est 'open'
    const consultResult = await client.query(
      `SELECT * FROM consultations WHERE id = $1 AND doctor_phone = $2 AND status = 'open'`,
      [consultation_id, normalizedDoctor]
    );

    if (consultResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('CONSULTATION_NOT_OPEN');
    }

    const consultation = consultResult.rows[0];

    // Créer ordonnance
    const ordResult = await client.query(
      `INSERT INTO ordonnances 
       (consultation_id, patient_phone, doctor_phone, expires_at, status)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', 'active')
       RETURNING id`,
      [consultation_id, consultation.patient_phone, normalizedDoctor]
    );

    const ordonnance_id = ordResult.rows[0].id;

    // Insérer items
    for (const item of items) {
      await client.query(
        `INSERT INTO ordonnance_items 
         (ordonnance_id, medicament, dosage, frequence, duree, instructions, quantite)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ordonnance_id, item.medicament, item.dosage, item.frequence, 
         item.duree, item.instructions, item.quantite || 1]
      );
    }

    await client.query('COMMIT');
    return { ordonnance_id, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getOrdonnance(ordonnance_id, requester_phone, role) {
  const normalizedRequester = normalizePhone(requester_phone);

  const result = await db.query(
    `SELECT o.*, oi.medicament, oi.dosage, oi.frequence, oi.duree, 
            oi.instructions, oi.quantite
     FROM ordonnances o
     LEFT JOIN ordonnance_items oi ON oi.ordonnance_id = o.id
     WHERE o.id = $1`,
    [ordonnance_id]
  );

  if (result.rows.length === 0) {
    throw new Error('ORDONNANCE_NOT_FOUND');
  }

  const ordonnance = result.rows[0];

  // Vérifications d'accès
  if (role === 'patient' && ordonnance.patient_phone !== normalizedRequester) {
    throw new Error('ACCESS_DENIED');
  }

  if (role === 'medecin' && ordonnance.doctor_phone !== normalizedRequester) {
    throw new Error('ACCESS_DENIED');
  }

  // Pour pharmacie, bhpAccess est vérifié côté route

  // Grouper items
  const items = result.rows.map(row => ({
    medicament: row.medicament,
    dosage: row.dosage,
    frequence: row.frequence,
    duree: row.duree,
    instructions: row.instructions,
    quantite: row.quantite
  }));

  return {
    id: ordonnance.id,
    consultation_id: ordonnance.consultation_id,
    patient_phone: ordonnance.patient_phone,
    doctor_phone: ordonnance.doctor_phone,
    issued_at: ordonnance.issued_at,
    expires_at: ordonnance.expires_at,
    status: ordonnance.status,
    items
  };
}

async function dispenseOrdonnance(ordonnance_id, pharmacie_phone, req) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const normalizedPharmacie = normalizePhone(pharmacie_phone);

    // Vérifier ordonnance
    const ordResult = await client.query(
      `SELECT * FROM ordonnances WHERE id = $1 AND status = 'active'`,
      [ordonnance_id]
    );

    if (ordResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('ORDONNANCE_NOT_ACTIVE');
    }

    const ordonnance = ordResult.rows[0];

    // Mettre à jour statut
    await client.query(
      `UPDATE ordonnances SET status = 'dispensed' WHERE id = $1`,
      [ordonnance_id]
    );

    // Log BHP
    await logAccessAttempt(
      ordonnance.id,
      { id: req.user.id, phone: normalizedPharmacie, role: 'pharmacie' },
      'ordonnance_dispensed',
      req.ip
    );

    // Notifier médecin
    const doctorResult = await client.query(
      `SELECT first_name FROM users WHERE phone = $1`,
      [ordonnance.doctor_phone]
    );

    if (doctorResult.rows.length > 0) {
      // Notification médecin (optionnel - à implémenter si nécessaire)
    }

    // Notifier patient
    const patientResult = await client.query(
      `SELECT first_name FROM users WHERE phone = $1`,
      [ordonnance.patient_phone]
    );

    if (patientResult.rows.length > 0) {
      await whatsappService.sendAutoMessage(
        ordonnance.patient_phone,
        'bolamu_ordonnance_prete',
        [patientResult.rows[0].first_name]
      );
    }

    await client.query('COMMIT');
    return { ordonnance_id, status: 'dispensed' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createOrdonnance,
  getOrdonnance,
  dispenseOrdonnance
};
