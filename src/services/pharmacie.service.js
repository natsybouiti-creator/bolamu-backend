const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('./whatsapp.service');

async function getOrdonnancesEnAttente(pharmacie_phone) {
  const normalizedPhone = normalizePhone(pharmacie_phone);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT o.id, o.patient_phone, o.doctor_phone, o.issued_at, o.expires_at,
              u.first_name, u.last_name,
              oi.medicament, oi.dosage, oi.frequence, oi.duree
       FROM ordonnances o
       LEFT JOIN ordonnance_items oi ON o.id = oi.ordonnance_id
       LEFT JOIN users u ON o.patient_phone = u.phone
       WHERE o.status = 'active'
       AND o.expires_at > NOW()
       ORDER BY o.issued_at ASC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function dispenserOrdonnance(ordonnance_id, pharmacie_phone) {
  const normalizedPhone = normalizePhone(pharmacie_phone);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ordonnanceCheck = await client.query(
      `SELECT * FROM ordonnances WHERE id = $1 AND status = 'active'`,
      [ordonnance_id]
    );
    if (ordonnanceCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Ordonnance introuvable ou non disponible');
    }

    const ordonnance = ordonnanceCheck.rows[0];
    if (ordonnance.expires_at && new Date(ordonnance.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      throw new Error('Ordonnance expirée');
    }

    await client.query(
      `UPDATE ordonnances SET status = 'dispensed' WHERE id = $1`,
      [ordonnance_id]
    );

    const tarifResult = await client.query(
      `SELECT tarif_fcfa FROM partner_zones WHERE partner_phone = $1 AND partner_type = 'pharmacie'`,
      [normalizedPhone]
    );
    const tarif = tarifResult.rows[0]?.tarif_fcfa || 2500;

    const clearingResult = await client.query(
      `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ($1, 'pharmacie', $2, 'ordonnance', $3, 'pending')
       RETURNING id`,
      [normalizedPhone, ordonnance_id, tarif]
    );

    const patientResult = await client.query(
      `SELECT first_name FROM users WHERE phone = $1`,
      [ordonnance.patient_phone]
    );
    const patientName = patientResult.rows[0]?.first_name || 'Patient';

    const pharmaResult = await client.query(
      `SELECT name FROM pharmacies WHERE phone = $1`,
      [normalizedPhone]
    );
    const pharmaName = pharmaResult.rows[0]?.name || 'Pharmacie';

    setImmediate(async () => {
      try {
        await sendAutoMessage(ordonnance.patient_phone, 'bolamu_ordonnance_dispensee', [patientName, pharmaName, new Date().toLocaleDateString('fr-FR')]);
        await sendAutoMessage(ordonnance.doctor_phone, 'bolamu_ordonnance_dispensee_medecin', [patientName, pharmaName]);
      } catch (e) {
        console.error('[WhatsApp] Erreur notification dispensation:', e.message);
      }
    });

    await client.query('COMMIT');
    return { success: true, patient_name: patientName, clearing_id: clearingResult.rows[0].id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getStats(pharmacie_phone) {
  const normalizedPhone = normalizePhone(pharmacie_phone);
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const traiteesResult = await client.query(
      `SELECT COUNT(*) FROM ordonnances WHERE status = 'dispensed' AND issued_at::date = $1`,
      [today]
    );
    
    const enAttenteResult = await client.query(
      `SELECT COUNT(*) FROM ordonnances WHERE status = 'active' AND expires_at > NOW()`
    );
    
    const clearingResult = await client.query(
      `SELECT COALESCE(SUM(amount_fcfa), 0) FROM clearing_transactions 
       WHERE partner_phone = $1 AND status = 'pending'`,
      [normalizedPhone]
    );
    
    const bonsZoraResult = await client.query(
      `SELECT COUNT(*) FROM partner_bons_zora WHERE partner_phone = $1 AND validated_at::date = $1`,
      [normalizedPhone, today]
    );

    return {
      traitees_today: parseInt(traiteesResult.rows[0].count),
      en_attente: parseInt(enAttenteResult.rows[0].count),
      clearing_pending_fcfa: parseFloat(clearingResult.rows[0].coalesce),
      bons_zora_today: parseInt(bonsZoraResult.rows[0].count)
    };
  } finally {
    client.release();
  }
}

module.exports = { getOrdonnancesEnAttente, dispenserOrdonnance, getStats };
