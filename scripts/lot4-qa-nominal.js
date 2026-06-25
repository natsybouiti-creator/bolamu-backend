const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testNominalQA() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== LOT 4 - PARCOURS NOMINAL QA ===\n');

    // 1. Créer un événement test
    console.log('1. Création événement test...');
    const eventResult = await client.query(
      `INSERT INTO elonga_events (
        title, description, pillar, location_name, location_address,
        latitude, longitude, city, starts_at, ends_at,
        max_participants, zora_reward, proof_class, status, organizer_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published', $14)
       RETURNING id`,
      [
        'Test QA Event',
        'Événement test pour parcours nominal',
        'sport',
        'Stade Test',
        'Avenue Test, Brazzaville',
        -4.2634,
        15.2429,
        'Brazzaville',
        new Date(Date.now() + 86400000).toISOString(),
        new Date(Date.now() + 90000000).toISOString(),
        50,
        50,
        'ground_truth',
        '242069735418'
      ]
    );
    const eventId = eventResult.rows[0].id;
    console.log(`✓ Événement créé (ID: ${eventId})`);

    // 2. Inscrire un patient test
    console.log('\n2. Inscription patient test...');
    const regResult = await client.query(
      `INSERT INTO event_registrations (event_id, patient_phone, session_code, qr_token, status)
       VALUES ($1, $2, $3, $4, 'registered')
       RETURNING id`,
      [eventId, '242069735418', 'TEST-2026-1234', 'test_qr_token']
    );
    const regId = regResult.rows[0].id;
    console.log(`✓ Patient inscrit (ID: ${regId})`);

    // 3. Check-in patient
    console.log('\n3. Check-in patient...');
    await client.query(
      `UPDATE event_registrations SET status = 'checked_in', checked_in_at = NOW() WHERE id = $1`,
      [regId]
    );
    await client.query(
      `INSERT INTO event_checkin_log (registration_id, event_id, patient_phone, animateur_phone, scan_method, zora_credited)
       VALUES ($1, $2, $3, $4, 'qr_scan', 50)`,
      [regId, eventId, '242069735418', '242069735418']
    );
    console.log('✓ Check-in effectué');

    // 4. Créditer points Elonga
    console.log('\n4. Créditation points Elonga...');
    await client.query(
      `INSERT INTO elonga_points (phone, event_id, points, source, awarded_at)
       VALUES ($1, $2, 50, 'checkin', NOW())`,
      ['242069735418', eventId]
    );
    console.log('✓ Points Elonga crédités');

    // 5. Vérifier les stats
    console.log('\n5. Vérification stats...');
    const statsResult = await client.query(
      `SELECT 
        (SELECT COUNT(*) FROM elonga_events WHERE organizer_phone = '242069735418') as events,
        (SELECT COUNT(*) FROM event_checkin_log WHERE animateur_phone = '242069735418') as checkins,
        (SELECT COUNT(*) FROM elonga_points WHERE phone = '242069735418') as points`
    );
    console.log(`✓ Stats: ${statsResult.rows[0].events} événements, ${statsResult.rows[0].checkins} check-ins, ${statsResult.rows[0].points} points`);

    await client.query('ROLLBACK');
    console.log('\n✅ LOT 4 - PARCOURS NOMINAL VALIDÉ (ROLLBACK effectué)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur parcours nominal:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testNominalQA();
