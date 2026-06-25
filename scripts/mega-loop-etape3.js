// MEGA LOOP - ÉTAPE 3 : Ordonnance → pharmacie → résultat labo
require('dotenv').config();
const pool = require('../src/config/db');
const { sendAutoMessage } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');

const TEST_PHONE = '+242069735418'; // Numéro WhatsApp réel
const ALT_PHONE = '+242069735419'; // Numéro patient DB
const PHARMACY_PHONE = '+242066226116'; // Pharmacie test
const LABO_PHONE = '+242068582563'; // Labo test
const PRESCRIPTION_ID = 21; // Ordonnance créée en ÉTAPE 2

async function etape3() {
  console.log('[ÉTAPE 3] Ordonnance → pharmacie → résultat labo');
  console.log('==================================================\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Créer pharmacie test si nécessaire
    console.log('1. Vérification pharmacie test...');
    const pharmacyRes = await client.query('SELECT id, name FROM pharmacies WHERE phone = $1', [PHARMACY_PHONE]);
    let pharmacyId;
    
    if (pharmacyRes.rows.length === 0) {
      console.log('   Création pharmacie test...');
      const pharmacyUserRes = await client.query('SELECT id FROM users WHERE phone = $1', [PHARMACY_PHONE]);
      
      if (pharmacyUserRes.rows.length === 0) {
        const idRes = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 3000) + 1 AS next
           FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
        );
        const bolamuId = `BLM-${idRes.rows[0].next}`;
        
        await client.query(
          `INSERT INTO users
            (phone, full_name, role, bolamu_id, is_active, created_at)
           VALUES ($1, $2, 'pharmacie', $3, TRUE, NOW())
           RETURNING id`,
          [PHARMACY_PHONE, 'Pharmacie Test Mega Loop', bolamuId]
        );
      }
      
      const newPharmacy = await client.query(
        `INSERT INTO pharmacies
          (user_id, name, phone, city, is_active, status, member_code, created_at)
         VALUES ((SELECT id FROM users WHERE phone = $1), $2, $1, 'Brazzaville', TRUE, 'active', 'PHM-001', NOW())
         RETURNING id`,
        [PHARMACY_PHONE, 'Pharmacie Test Mega Loop']
      );
      
      pharmacyId = newPharmacy.rows[0].id;
      console.log(`   ✅ Pharmacie créée\n`);
    } else {
      pharmacyId = pharmacyRes.rows[0].id;
      console.log(`   ✅ Pharmacie existe : ${pharmacyRes.rows[0].name}\n`);
    }
    
    // 2. Créer labo test si nécessaire
    console.log('2. Vérification labo test...');
    const laboRes = await client.query('SELECT id, name FROM laboratories WHERE phone = $1', [LABO_PHONE]);
    let laboId;
    
    if (laboRes.rows.length === 0) {
      console.log('   Création labo test...');
      const laboUserRes = await client.query('SELECT id FROM users WHERE phone = $1', [LABO_PHONE]);
      
      if (laboUserRes.rows.length === 0) {
        const idRes = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 4000) + 1 AS next
           FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
        );
        const bolamuId = `BLM-${idRes.rows[0].next}`;
        
        await client.query(
          `INSERT INTO users
            (phone, full_name, role, bolamu_id, is_active, created_at)
           VALUES ($1, $2, 'laboratoire', $3, TRUE, NOW())
           RETURNING id`,
          [LABO_PHONE, 'Labo Test Mega Loop', bolamuId]
        );
      }
      
      const newLabo = await client.query(
        `INSERT INTO laboratories
          (user_id, name, phone, city, is_active, status, member_code, created_at)
         VALUES ((SELECT id FROM users WHERE phone = $1), $2, $1, 'Brazzaville', TRUE, 'active', 'LAB-001', NOW())
         RETURNING id`,
        [LABO_PHONE, 'Labo Test Mega Loop']
      );
      
      laboId = newLabo.rows[0].id;
      console.log(`   ✅ Labo créé\n`);
    } else {
      laboId = laboRes.rows[0].id;
      console.log(`   ✅ Labo existe : ${laboRes.rows[0].name}\n`);
    }
    
    // 3. Assigner pharmacie à l'ordonnance
    console.log('3. Assignation pharmacie à l\'ordonnance...');
    await client.query(
      `UPDATE prescriptions
       SET pharmacie_phone = $1, status = 'assigned'
       WHERE id = $2`,
      [PHARMACY_PHONE, PRESCRIPTION_ID]
    );
    console.log('   ✅ Pharmacie assignée\n');
    
    // 4. Pharmacie traite l'ordonnance
    console.log('4. Traitement ordonnance par la pharmacie...');
    await client.query(
      `UPDATE prescriptions
       SET status = 'delivered', delivered_at = NOW()
       WHERE id = $1`,
      [PRESCRIPTION_ID]
    );
    console.log('   ✅ Ordonnance délivrée\n');
    
    // 5. Créer analyse labo
    console.log('5. Création analyse labo...');
    const labPrescriptionRes = await client.query(
      `INSERT INTO lab_prescriptions
        (patient_phone, doctor_phone, lab_phone, examens, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id`,
      [ALT_PHONE, '+242060000001', LABO_PHONE, '{"examens": [{"nom": "NFS", "code": "NFS001"}]}']
    );
    
    const labPrescriptionId = labPrescriptionRes.rows[0].id;
    console.log(`   ✅ Analyse créée (ID: ${labPrescriptionId})\n`);
    
    // 6. Labo dépose le résultat
    console.log('6. Dépôt résultat labo...');
    const labResultRes = await client.query(
      `INSERT INTO lab_results
        (patient_phone, lab_phone, doctor_phone, lab_prescription_id, resultats, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
       RETURNING id`,
      [ALT_PHONE, LABO_PHONE, '+242060000001', labPrescriptionId, '{"NFS": {"hemoglobine": "14.5 g/dL", "globules_rouges": "4.8 M/µL"}}']
    );
    
    const labResultId = labResultRes.rows[0].id;
    console.log(`   ✅ Résultat déposé (ID: ${labResultId})\n`);
    
    await client.query('COMMIT');
    
    // 7. Messages WhatsApp
    console.log('7. Envoi messages WhatsApp...\n');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_nouvelle_ordonnance_pharmacie',
      ['Patient Test', 'Dr. Mbemba Jean']
    );
    console.log('   ✅ Message pharmacie envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_ordonnance_dispensee',
      ['Patient Test', 'Pharmacie Test Mega Loop', '2026-06-26']
    );
    console.log('   ✅ Message ordonnance délivrée envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_resultats_disponibles',
      ['Patient Test', 'Labo Test Mega Loop']
    );
    console.log('   ✅ Message résultats disponibles envoyé\n');
    
    console.log('=== ÉTAPE 3 TERMINÉE ===');
    console.log('SQL : ✓');
    console.log('WhatsApp : ✓');
    console.log('Ordonnance ID :', PRESCRIPTION_ID);
    console.log('Lab prescription ID :', labPrescriptionId);
    console.log('Lab result ID :', labResultId);
    console.log('========================\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur ÉTAPE 3:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

etape3()
  .then(() => console.log('ÉTAPE 3 : SUCCESS'))
  .catch(err => console.error('ÉTAPE 3 : FAIL', err))
  .finally(() => pool.end());
