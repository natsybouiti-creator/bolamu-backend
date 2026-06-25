// MEGA LOOP - ÉTAPE 2 : Consultation → ordonnance
require('dotenv').config();
const pool = require('../src/config/db');
const { sendAutoMessage } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');

const TEST_PHONE = '+242069735418'; // Numéro WhatsApp réel
const ALT_PHONE = '+242069735419'; // Numéro patient DB
const DOCTOR_PHONE = '+242060000001'; // Médecin test

async function etape2() {
  console.log('[ÉTAPE 2] Consultation → ordonnance');
  console.log('====================================\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Créer médecin test si nécessaire
    console.log('1. Vérification médecin test...');
    const doctorRes = await client.query('SELECT id, full_name FROM users WHERE phone = $1', [DOCTOR_PHONE]);
    let doctorId;
    
    if (doctorRes.rows.length === 0) {
      console.log('   Création médecin test...');
      const idRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 2000) + 1 AS next
         FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
      );
      const bolamuId = `BLM-${idRes.rows[0].next}`;
      
      const newDoctor = await client.query(
        `INSERT INTO users
          (phone, full_name, role, bolamu_id, is_active, created_at)
         VALUES ($1, $2, 'doctor', $3, TRUE, NOW())
         RETURNING id, full_name, bolamu_id`,
        [DOCTOR_PHONE, 'Dr. Test Mega Loop', bolamuId]
      );
      
      doctorId = newDoctor.rows[0].id;
      console.log(`   ✅ Médecin créé : ${newDoctor.rows[0].full_name}\n`);
    } else {
      doctorId = doctorRes.rows[0].id;
      console.log(`   ✅ Médecin existe : ${doctorRes.rows[0].full_name}\n`);
    }
    
    // 2. Ajouter patient à la file d'attente
    console.log('2. Ajout patient à la file d\'attente...');
    const queueRes = await client.query(
      `INSERT INTO file_attente
        (partenaire_phone, patient_phone, doctor_phone, motif, priorite, statut, numero_ordre, heure_arrivee, created_by)
       VALUES ($1, $2, $3, $4, 'normale', 'en_attente', 1, NOW(), $5)
       RETURNING id`,
      [DOCTOR_PHONE, ALT_PHONE, DOCTOR_PHONE, 'Consultation MEGA LOOP', DOCTOR_PHONE]
    );
    
    const queueId = queueRes.rows[0].id;
    console.log(`   ✅ Patient ajouté à la file (ID: ${queueId})\n`);
    
    // 3. Appeler patient (début consultation)
    console.log('3. Appel patient (début consultation)...');
    await client.query(
      `UPDATE file_attente
       SET statut = 'en_consultation', heure_appel = NOW()
       WHERE id = $1`,
      [queueId]
    );
    console.log('   ✅ Patient appelé\n');
    
    // 4. Créer health_record (dossier médical)
    console.log('4. Création dossier médical...');
    const patientRes = await client.query('SELECT id FROM users WHERE phone = $1', [ALT_PHONE]);
    const patientId = patientRes.rows[0].id;
    
    const healthRes = await client.query(
      `INSERT INTO health_records
        (patient_id, record_type, title, content, source_role, source_user_id, consent_granted, consent_date, created_at, updated_at)
       VALUES ($1, 'consultation', $2, $3, 'doctor', $4, true, NOW(), NOW(), NOW())
       RETURNING id`,
      [patientId, 'Consultation MEGA LOOP', '{"diagnostic": "Test diagnostic", "symptomes": ["Test symptome"]}', doctorId]
    );
    
    const healthId = healthRes.rows[0].id;
    console.log(`   ✅ Dossier médical créé (ID: ${healthId})\n`);
    
    // 5. Terminer consultation
    console.log('5. Fin consultation...');
    await client.query(
      `UPDATE file_attente
       SET statut = 'termine', heure_fin = NOW()
       WHERE id = $1`,
      [queueId]
    );
    console.log('   ✅ Consultation terminée\n');
    
    // 6. Créer ordonnance
    console.log('6. Création ordonnance...');
    const prescriptionRes = await client.query(
      `INSERT INTO prescriptions
        (patient_phone, doctor_phone, medications, instructions, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())
       RETURNING id`,
      [ALT_PHONE, DOCTOR_PHONE, '{"medicaments": [{"nom": "Paracétamol", "dosage": "500mg", "frequence": "3x/jour"}]}', 'Prendre après les repas']
    );
    
    const prescriptionId = prescriptionRes.rows[0].id;
    console.log(`   ✅ Ordonnance créée (ID: ${prescriptionId})\n`);
    
    await client.query('COMMIT');
    
    // 7. Messages WhatsApp
    console.log('7. Envoi messages WhatsApp...\n');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_rdv_confirme',
      ['2026-06-26', '10:00']
    );
    console.log('   ✅ Message RDV confirmé envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_consultation_terminee',
      ['Patient Test', 'Dr. Test Mega Loop', 'Test diagnostic']
    );
    console.log('   ✅ Message consultation terminée envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_ordonnance_prete',
      ['Patient Test']
    );
    console.log('   ✅ Message ordonnance prête envoyé\n');
    
    console.log('=== ÉTAPE 2 TERMINÉE ===');
    console.log('SQL : ✓');
    console.log('WhatsApp : ✓');
    console.log('File attente ID :', queueId);
    console.log('Health record ID :', healthId);
    console.log('Ordonnance ID :', prescriptionId);
    console.log('========================\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur ÉTAPE 2:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

etape2()
  .then(() => console.log('ÉTAPE 2 : SUCCESS'))
  .catch(err => console.error('ÉTAPE 2 : FAIL', err))
  .finally(() => pool.end());
