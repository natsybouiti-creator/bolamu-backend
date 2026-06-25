const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function proofTables() {
  try {
    const result = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN (
         'animateurs', 'animateur_clubs', 'elonga_points',
         'elonga_events', 'event_registrations', 'event_checkin_log'
       )`
    );
    
    console.log('=== PREUVE LOT 1 - TABLES B3 ===');
    console.log(`Tables trouvées: ${result.rows.length}/6`);
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    if (result.rows.length === 6) {
      console.log('\n✅ LOT 1 - PREUVE VALIDÉE (6/6 tables)');
    } else {
      console.log('\n❌ LOT 1 - PREUVE ÉCHOUÉE (tables manquantes)');
    }
    
  } catch (error) {
    console.error('❌ Erreur preuve:', error.message);
  } finally {
    await pool.end();
  }
}

proofTables();
