// MEGA LOOP - ÉTAPE 1 : Inscription patient → check-in Elonga → Zora
require('dotenv').config();
const pool = require('../src/config/db');
const { sendAutoMessage } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');

const TEST_PHONE = '+242069735418'; // Numéro WhatsApp réel pour réception messages
const ALT_PHONE = '+242069735419'; // Numéro alternatif pour éviter foreign keys
const TEST_PATIENT = {
  phone: ALT_PHONE, // Utiliser ALT_PHONE pour l'inscription
  full_name: 'Patient Test Mega Loop',
  birth_date: '1990-01-01',
  gender: 'M',
  city: 'Brazzaville'
};

async function etape1() {
  console.log('[ÉTAPE 1] Inscription patient → check-in Elonga → Zora');
  console.log('====================================================\n');
  console.log('Patient DB:', ALT_PHONE);
  console.log('WhatsApp:', TEST_PHONE);
  console.log('================================\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Créer patient test
    console.log('1. Création patient test...');
    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [ALT_PHONE]);
    if (existing.rows.length > 0) {
      console.log('   Patient existe déjà, suppression...');
      const userId = existing.rows[0].id;
      await client.query('DELETE FROM notifications WHERE user_phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM zora_ledger WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM zora_points WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM zora_vouchers WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM zora_game_plays WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM user_streaks WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM elonga_registrations WHERE phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM health_records WHERE source_user_id = $1', [userId]);
      await client.query('DELETE FROM subscriptions WHERE patient_phone = $1', [ALT_PHONE]);
      await client.query('DELETE FROM users WHERE phone = $1', [ALT_PHONE]);
    }
    
    const idRes = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 1000) + 1 AS next
       FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
    );
    const bolamuId = `BLM-${idRes.rows[0].next}`;
    
    const newUser = await client.query(
      `INSERT INTO users
        (phone, full_name, birth_date, gender, role, bolamu_id, is_active, onboarding_completed, created_at)
       VALUES ($1, $2, $3, $4, 'patient', $5, TRUE, TRUE, NOW())
       RETURNING id, phone, full_name, bolamu_id`,
      [ALT_PHONE, TEST_PATIENT.full_name, TEST_PATIENT.birth_date, TEST_PATIENT.gender, bolamuId]
    );
    
    console.log(`   ✅ Patient créé : ${newUser.rows[0].bolamu_id} (phone: ${ALT_PHONE})\n`);
    
    // 2. Créer événement Elonga test
    console.log('2. Création événement Elonga test...');
    const eventRes = await client.query(
      `INSERT INTO elonga_events
        (title, description, location_name, location_address, city, pillar, starts_at, ends_at, max_participants, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '3 hours', 100, 'published', NOW())
       RETURNING id, title`,
      ['Test Event Mega Loop', 'Événement test pour MEGA LOOP', 'Brazzaville Centre', 'Avenue de la Paix, Brazzaville', 'Brazzaville', 'sport']
    );
    
    const eventId = eventRes.rows[0].id;
    console.log(`   ✅ Événement créé : ${eventRes.rows[0].title} (ID: ${eventId})\n`);
    
    // 3. Inscrire patient à l'événement
    console.log('3. Inscription patient à l\'événement...');
    
    await client.query(
      `INSERT INTO elonga_registrations
        (event_id, phone, status, registered_at, zora_awarded)
       VALUES ($1, $2, 'registered', NOW(), false)`,
      [eventId, ALT_PHONE]
    );
    
    console.log('   ✅ Inscription réussie\n');
    
    // 4. Check-in patient
    console.log('4. Check-in patient...');
    await client.query(
      `UPDATE elonga_registrations
       SET status = 'checked_in', checkin_at = NOW(), zora_awarded = true
       WHERE event_id = $1 AND phone = $2`,
      [eventId, ALT_PHONE]
    );
    
    console.log('   ✅ Check-in réussi\n');
    
    // 5. Créditer Zora
    console.log('5. Crédit Zora (50 points)...');
    const zoraPoints = 50;
    const proofRef = `event-${eventId}`;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6); // Expire dans 6 mois
    
    await client.query(
      `INSERT INTO zora_ledger
        (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'checkin', 'event_checkin', 'elonga_qr', 'elonga_events', 'qr_scan', $3, true, NOW(), $4)`,
      [ALT_PHONE, zoraPoints, proofRef, expiresAt]
    );
    
    console.log(`   ✅ ${zoraPoints} Zora crédités\n`);
    
    await client.query('COMMIT');
    
    // 6. Vérifier solde Zora
    console.log('6. Vérification solde Zora...');
    const zoraRes = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as solde FROM zora_ledger WHERE phone = $1`,
      [ALT_PHONE]
    );
    
    console.log(`   Solde Zora : ${zoraRes.rows[0].solde} points\n`);
    
    // 7. Messages WhatsApp
    console.log('7. Envoi messages WhatsApp...\n');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_bienvenue_patient_v4',
      [TEST_PATIENT.full_name, TEST_PHONE, 'https://bolamu.co/login']
    );
    console.log('   ✅ Message bienvenue envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_checkin_confirme',
      [TEST_PATIENT.full_name, 'Test Event Mega Loop', zoraPoints.toString()]
    );
    console.log('   ✅ Message check-in envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_zora_attribues',
      [TEST_PATIENT.full_name, zoraPoints.toString(), zoraRes.rows[0].solde.toString(), 'check-in événement']
    );
    console.log('   ✅ Message Zora envoyé\n');
    
    console.log('=== ÉTAPE 1 TERMINÉE ===');
    console.log('SQL : ✓');
    console.log('WhatsApp : ✓');
    console.log('Patient :', TEST_PATIENT.full_name);
    console.log('Événement ID :', eventId);
    console.log('Solde Zora :', zoraRes.rows[0].solde);
    console.log('========================\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur ÉTAPE 1:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

etape1()
  .then(() => console.log('ÉTAPE 1 : SUCCESS'))
  .catch(err => console.error('ÉTAPE 1 : FAIL', err))
  .finally(() => pool.end());
