const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditColumns() {
  try {
    console.log('=== AUDIT COLONNES elonga_events ===');
    const eventsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns
       WHERE table_schema = 'public' 
       AND table_name = 'elonga_events'
       ORDER BY ordinal_position`
    );
    eventsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n=== AUDIT COLONNES event_registrations ===');
    const regsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns
       WHERE table_schema = 'public' 
       AND table_name = 'event_registrations'
       ORDER BY ordinal_position`
    );
    regsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n=== AUDIT COLONNES elonga_registrations (pour comparaison) ===');
    const elongaRegsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns
       WHERE table_schema = 'public' 
       AND table_name = 'elonga_registrations'
       ORDER BY ordinal_position`
    );
    elongaRegsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Erreur audit:', error.message);
  } finally {
    await pool.end();
  }
}

auditColumns();
