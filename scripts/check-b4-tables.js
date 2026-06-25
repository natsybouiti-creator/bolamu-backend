const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkB4Tables() {
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN (
         'consultations', 'ordonnances', 'ordonnance_items',
         'file_attente', 'rendez_vous', 'prescriptions',
         'medical_records', 'health_records', 'documents',
         'patient_consents', 'health_record_access_log'
       )
       ORDER BY table_name`
    );

    console.log('=== TABLES BOUCLE 4 EN BASE ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune table trouvée');
    } else {
      result.rows.forEach(row => {
        console.log(`✓ ${row.table_name}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkB4Tables();
