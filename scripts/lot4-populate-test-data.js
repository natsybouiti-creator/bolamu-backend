const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function populateTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== CRÉATION DONNÉES TEST LOT 4 ===\n');

    // Créer l'utilisateur animateur dans users s'il n'existe pas
    const userResult = await client.query(
      `SELECT phone FROM users WHERE phone = '242069735418'`
    );

    if (userResult.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('test123', 10);
      await client.query(
        `INSERT INTO users (phone, first_name, last_name, full_name, role, is_active, password_hash, created_at)
         VALUES ('242069735418', 'Animateur', 'Test', 'Animateur Test', 'animateur', true, $1, NOW())`,
        [passwordHash]
      );
      console.log('✓ Utilisateur animateur créé dans users');
    } else {
      console.log('✓ Utilisateur animateur existe déjà dans users');
    }

    // Récupérer un événement publié existant
    const eventResult = await client.query(
      `SELECT id, title FROM elonga_events WHERE status = 'published' LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      console.log('❌ Aucun événement publié trouvé');
      await client.query('ROLLBACK');
      return;
    }

    const eventId = eventResult.rows[0].id;
    console.log(`✓ Événement trouvé: ${eventResult.rows[0].title} (ID: ${eventId})`);

    // Récupérer une inscription existante
    const regResult = await client.query(
      `SELECT id, patient_phone FROM event_registrations WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );

    if (regResult.rows.length === 0) {
      console.log('❌ Aucune inscription trouvée pour cet événement');
      await client.query('ROLLBACK');
      return;
    }

    const regId = regResult.rows[0].id;
    const patientPhone = regResult.rows[0].patient_phone;
    console.log(`✓ Inscription trouvée (ID: ${regId}, Phone: ${patientPhone})`);

    // Créer un check-in
    await client.query(
      `UPDATE event_registrations SET status = 'checked_in', checked_in_at = NOW() WHERE id = $1`,
      [regId]
    );

    await client.query(
      `INSERT INTO event_checkin_log (registration_id, event_id, patient_phone, animateur_phone, scan_method, zora_credited, checked_in_at)
       VALUES ($1, $2, $3, $4, 'qr_scan', 50, NOW())`,
      [regId, eventId, patientPhone, '242069735418']
    );
    console.log('✓ Check-in créé');

    // Créer des points Elonga
    await client.query(
      `INSERT INTO elonga_points (phone, event_id, points, source, awarded_at)
       VALUES ($1, $2, 50, 'checkin', NOW())`,
      [patientPhone, eventId]
    );
    console.log('✓ Points Elonga créés');

    await client.query('COMMIT');
    console.log('\n✅ Données test créées avec succès');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur création données test:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

populateTestData();
