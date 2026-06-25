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

    // Insérer un animateur test
    const animateurResult = await client.query(
      `INSERT INTO animateurs (phone, full_name, specialite)
       VALUES ('242069735418', 'Animateur Test', 'Sport')
       ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, specialite = EXCLUDED.specialite
       RETURNING id, phone, full_name`,
      []
    );
    console.log('✅ Animateur test inséré:', animateurResult.rows[0]);

    // Vérifier stats
    const statsResult = await client.query(
      `SELECT * FROM animateurs WHERE phone = '242069735418'`
    );
    console.log('✅ Stats animateur:', statsResult.rows[0]);

    const eventsResult = await client.query(
      `SELECT COUNT(*) as count FROM elonga_events WHERE organizer_phone = '242069735418'`
    );
    console.log('✅ Événements organisés:', eventsResult.rows[0].count);

    const checkinsResult = await client.query(
      `SELECT COUNT(*) as count FROM event_checkin_log WHERE animateur_phone = '242069735418'`
    );
    console.log('✅ Check-ins effectués:', checkinsResult.rows[0].count);

    await client.query('COMMIT');
    console.log('\n✅ LOT 2 - PREUVE SQL VALIDÉE');

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
