const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function qaNominal() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== LOT 4 — PARCOURS NOMINAL QA ===\n');

    // 1. Créer patient test
    const patientPhone = '+242069735418';
    const doctorPhone = '+242065207273';

    const patientResult = await client.query(
      `INSERT INTO users (phone, role, first_name, last_name, full_name, is_active)
       VALUES ($1, 'patient', 'Antonio', 'Mbemba', 'Antonio Mbemba', true)
       ON CONFLICT (phone) DO UPDATE SET is_active = true
       RETURNING id`,
      [patientPhone]
    );
    const patientId = patientResult.rows[0].id;
    console.log(`✓ Patient créé (ID: ${patientId}, Phone: ${patientPhone})`);

    // 2. Créer RDV (table rendez_vous)
    const rdvResult = await client.query(
      `INSERT INTO rendez_vous (patient_phone, doctor_phone, scheduled_at, status, motif)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 'confirmed', 'Test parcours nominal')
       RETURNING id`,
      [patientPhone, doctorPhone]
    );
    const rdvId = rdvResult.rows[0].id;
    console.log(`✓ RDV créé (ID: ${rdvId})`);

    // 3. Ouvrir consultation
    const consultationResult = await client.query(
      `INSERT INTO consultations (patient_phone, doctor_phone, motif, status, rdv_id)
       VALUES ($1, $2, 'Test parcours nominal', 'open', $3)
       RETURNING id`,
      [patientPhone, doctorPhone, rdvId]
    );
    const consultationId = consultationResult.rows[0].id;
    console.log(`✓ Consultation ouverte (ID: ${consultationId})`);

    // 4. Créer ordonnance
    const ordonnanceResult = await client.query(
      `INSERT INTO ordonnances (consultation_id, doctor_phone, patient_phone, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [consultationId, doctorPhone, patientPhone]
    );
    const ordonnanceId = ordonnanceResult.rows[0].id;
    console.log(`✓ Ordonnance créée (ID: ${ordonnanceId})`);

    // 5. Ajouter items ordonnance
    await client.query(
      `INSERT INTO ordonnance_items (ordonnance_id, medicament, dosage, frequence, duree)
       VALUES ($1, 'Paracétamol 500mg', '1 comprimé', '3x/jour', '5 jours')`,
      [ordonnanceId]
    );
    console.log(`✓ Item ordonnance ajouté`);

    // 6. Fermer consultation
    await client.query(
      `UPDATE consultations 
       SET status = 'completed', diagnostic = 'Hypertension légère', anamnese = 'Céphalées', examen_clinique = 'TA 140/90'
       WHERE id = $1`,
      [consultationId]
    );
    console.log(`✓ Consultation fermée`);

    await client.query('ROLLBACK');
    console.log('\n✅ LOT 4 — PARCOURS NOMINAL VALIDÉ (ROLLBACK effectué)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur parcours nominal:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

qaNominal();
