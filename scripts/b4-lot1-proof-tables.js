const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function proofTables() {
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN (
         'rendez_vous', 'consultations', 'ordonnances',
         'ordonnance_items', 'medical_records',
         'file_attente', 'prescriptions', 'health_records'
       )
       ORDER BY table_name`
    );

    console.log('=== PREUVE LOT 1 — 8 TABLES REQUISES ===\n');
    const required = [
      'rendez_vous', 'consultations', 'ordonnances',
      'ordonnance_items', 'medical_records',
      'file_attente', 'prescriptions', 'health_records'
    ];
    
    const found = result.rows.map(r => r.table_name);
    const missing = required.filter(t => !found.includes(t));
    
    found.forEach(t => console.log(`✓ ${t}`));
    if (missing.length > 0) {
      console.log('\n❌ MANQUANTES:');
      missing.forEach(t => console.log(`✗ ${t}`));
    }
    
    console.log(`\nRésultat: ${found.length}/8 tables trouvées`);
    
    if (found.length === 8) {
      console.log('✅ LOT 1 — PREUVE VALIDÉE');
    } else {
      console.log('❌ LOT 1 — PREUVE ÉCHOUÉE');
    }
  } catch (error) {
    console.error('❌ Erreur preuve:', error.message);
  } finally {
    await pool.end();
  }
}

proofTables();
