const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testFraudScenarios() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== SCÉNARIOS FRAUDE B5 ===\n');
    
    // 1. Créer une ordonnance active
    const consultationResult = await client.query(
      `INSERT INTO consultations (patient_phone, doctor_phone, status, started_at)
       VALUES ('+242069735418', '+242065207273', 'open', NOW())
       RETURNING id`
    );
    const consultationId = consultationResult.rows[0].id;
    
    const ordonnanceResult = await client.query(
      `INSERT INTO ordonnances (consultation_id, patient_phone, doctor_phone, issued_at, expires_at, status)
       VALUES ($1, '+242069735418', '+242065207273', NOW(), NOW() + INTERVAL '7 days', 'active')
       RETURNING id`,
      [consultationId]
    );
    const ordonnanceId = ordonnanceResult.rows[0].id;
    console.log(`✓ Ordonnance créée (ID: ${ordonnanceId})`);
    
    // 2. Test: Dispenser deux fois la même ordonnance
    await client.query(`UPDATE ordonnances SET status = 'dispensed' WHERE id = $1`, [ordonnanceId]);
    console.log('✓ Première dispensation réussie');
    
    // Note: Double dispensation doit être bloquée au niveau du service (pharmacie.service.js)
    // La base de données n'a pas de contrainte UNIQUE sur (ordonnance_id, status)
    console.log('⚠️ NOTE: Double dispensation doit être bloquée au niveau service (pas de contrainte DB)');
    
    // 3. Test: Ordonnance expirée
    const expiredOrdonnanceResult = await client.query(
      `INSERT INTO ordonnances (consultation_id, patient_phone, doctor_phone, issued_at, expires_at, status)
       VALUES ($1, '+242069735418', '+242065207273', NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', 'active')
       RETURNING id`,
      [consultationId]
    );
    const expiredId = expiredOrdonnanceResult.rows[0].id;
    console.log(`✓ Ordonnance expirée créée (ID: ${expiredId})`);
    console.log('⚠️ NOTE: Ordonnance expirée doit être bloquée au niveau service (vérification expires_at)');
    
    // 4. Test: Clearing négatif
    // Note: La contrainte CHECK amount_fcfa > 0 doit être ajoutée à la table clearing_transactions
    const subClient = await pool.connect();
    try {
      await subClient.query('BEGIN');
      try {
        await subClient.query(
          `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
           VALUES ('+242065207274', 'pharmacie', $1, 'ordonnance', -1000.00, 'pending')`,
          [ordonnanceId]
        );
        console.log('❌ FAIL: Clearing négatif non bloqué (ajouter contrainte CHECK amount_fcfa > 0)');
        await subClient.query('ROLLBACK');
      } catch (error) {
        console.log('✓ PASS: Clearing négatif bloqué (contrainte CHECK)');
        await subClient.query('ROLLBACK');
      }
    } finally {
      subClient.release();
    }
    
    // 5. Test: Prescription labo non assignée
    const labPrescriptionResult = await client.query(
      `INSERT INTO lab_prescriptions (patient_phone, doctor_phone, examens, status, prescription_code)
       VALUES ('+242069735418', '+242065207273', 'Glycémie', 'pending', '999999')
       RETURNING id`
    );
    const labPrescriptionId = labPrescriptionResult.rows[0].id;
    console.log(`✓ Prescription labo créée (ID: ${labPrescriptionId})`);
    console.log('⚠️ NOTE: Labo non assigné doit être bloqué au niveau service (vérification lab_phone)');
    
    console.log('\n=== RÉSUMÉ SCÉNARIOS FRAUDE ===');
    console.log('⚠️ Double dispensation: Bloquer au niveau service (pharmacie.service.js)');
    console.log('⚠️ Ordonnance expirée: Bloquer au niveau service (vérification expires_at)');
    console.log('⚠️ Clearing négatif: Ajouter contrainte CHECK amount_fcfa > 0');
    console.log('⚠️ Labo non assigné: Bloquer au niveau service (vérification lab_phone)');
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
    
  } catch (error) {
    console.error('❌ Erreur scénarios fraude:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

testFraudScenarios();
