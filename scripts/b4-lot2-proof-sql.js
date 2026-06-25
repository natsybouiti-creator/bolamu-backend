const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function proofSQL() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== PREUVE LOT 2 — SQL ===\n');

    // Insérer consultation test
    const result = await client.query(
      `INSERT INTO consultations 
       (patient_phone, doctor_phone, motif, status)
       VALUES ('+242069735418', '+242065207273', 
               'Test consultation', 'open')
       RETURNING id`
    );

    const consultation_id = result.rows[0].id;
    console.log(`✓ Consultation créée (ID: ${consultation_id})`);

    // Vérifier consultation
    const checkResult = await client.query(
      `SELECT id, patient_phone, doctor_phone, status
       FROM consultations
       WHERE status = 'open'`
    );

    console.log(`✓ Consultations 'open': ${checkResult.rows.length}`);
    checkResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Patient: ${row.patient_phone}, Médecin: ${row.doctor_phone}, Status: ${row.status}`);
    });

    await client.query('ROLLBACK');
    console.log('\n✅ LOT 2 — PREUVE SQL VALIDÉE (ROLLBACK effectué)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur preuve SQL:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

proofSQL();
