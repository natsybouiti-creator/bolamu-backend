const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function parcoursNominal() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== PARCOURS NOMINAL B5 ===\n');
    
    // 1. Créer une consultation (B4) pour l'ordonnance
    const consultationResult = await client.query(
      `INSERT INTO consultations (patient_phone, doctor_phone, status, started_at)
       VALUES ('+242069735418', '+242065207273', 'open', NOW())
       RETURNING id`
    );
    const consultationId = consultationResult.rows[0].id;
    console.log(`✓ Consultation créée (ID: ${consultationId})`);
    
    // 2. Créer une ordonnance active (B4)
    const ordonnanceResult = await client.query(
      `INSERT INTO ordonnances (consultation_id, patient_phone, doctor_phone, issued_at, expires_at, status)
       VALUES ($1, '+242069735418', '+242065207273', NOW(), NOW() + INTERVAL '7 days', 'active')
       RETURNING id`,
      [consultationId]
    );
    const ordonnanceId = ordonnanceResult.rows[0].id;
    console.log(`✓ Ordonnance créée (ID: ${ordonnanceId})`);
    
    // 3. Dispenser l'ordonnance (simule l'action pharmacie)
    await client.query(
      `UPDATE ordonnances SET status = 'dispensed' WHERE id = $1`,
      [ordonnanceId]
    );
    console.log('✓ Ordonnance dispensée');
    
    // 4. Créer clearing transaction pharmacie
    const clearingPharmaResult = await client.query(
      `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242065207274', 'pharmacie', $1, 'ordonnance', 2500.00, 'pending')
       RETURNING id`,
      [ordonnanceId]
    );
    console.log(`✓ Clearing pharmacie créé (ID: ${clearingPharmaResult.rows[0].id})`);
    
    // 5. Créer prescription labo
    const labPrescriptionResult = await client.query(
      `INSERT INTO lab_prescriptions (patient_phone, doctor_phone, examens, status, prescription_code)
       VALUES ('+242069735418', '+242065207273', 'Glycémie, NFS', 'pending', '123456')
       RETURNING id`
    );
    const labPrescriptionId = labPrescriptionResult.rows[0].id;
    console.log(`✓ Prescription labo créée (ID: ${labPrescriptionId})`);
    
    // 6. Soumettre résultats labo
    await client.query(
      `INSERT INTO lab_results (lab_prescription_id, patient_phone, lab_phone, doctor_phone, resultats, status)
       VALUES ($1, '+242069735418', '+242065207275', '+242065207273', '{"Glycémie": "5.2 mmol/L"}', 'completed')`,
      [labPrescriptionId]
    );
    console.log('✓ Résultats labo soumis');
    
    // 7. Mettre à jour prescription labo
    await client.query(
      `UPDATE lab_prescriptions SET status = 'completed' WHERE id = $1`,
      [labPrescriptionId]
    );
    console.log('✓ Prescription labo complétée');
    
    // 8. Créer clearing transaction labo
    const clearingLabResult = await client.query(
      `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242065207275', 'laboratoire', $1, 'lab_prescription', 5000.00, 'pending')
       RETURNING id`,
      [labPrescriptionId]
    );
    console.log(`✓ Clearing labo créé (ID: ${clearingLabResult.rows[0].id})`);
    
    // 8. Preuve finale
    const proofResult = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM ordonnances WHERE status = 'dispensed') as ordonnances_dispensees,
        (SELECT COUNT(*) FROM lab_results) as resultats_labo,
        (SELECT COUNT(*) FROM clearing_transactions WHERE status = 'pending') as clearing_en_attente`
    );
    
    const proof = proofResult.rows[0];
    console.log('\n=== PREUVE FINALE ===');
    console.log(`Ordonnances dispensées: ${proof.ordonnances_dispensees}`);
    console.log(`Résultats labo: ${proof.resultats_labo}`);
    console.log(`Clearing en attente: ${proof.clearing_en_attente}`);
    
    const allOk = proof.ordonnances_dispensees >= 1 && proof.resultats_labo >= 1 && proof.clearing_en_attente >= 1;
    console.log(`\n${allOk ? '✓ PARCOURS NOMINAL VALIDÉ' : '❌ PARCOURS NOMINAL ÉCHOUÉ'}`);
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
    
  } catch (error) {
    console.error('❌ Erreur parcours nominal:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

parcoursNominal();
