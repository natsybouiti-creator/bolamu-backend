// ============================================================
// BOLAMU — Sprint 3 : Exécution Migration Marketplace
// ============================================================
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runMigration() {
  console.log('🚀 DÉBUT MIGRATION MARKETPLACE ZORA');
  
  try {
    const migrationPath = path.join(__dirname, '../database/migrations/migration_031_zora_marketplace.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    console.log('✅ Tables marketplace créées avec succès');
    
    // Vérification
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'zora_%'
    `);
    console.log(`📊 Tables Zora existantes : ${tables.rows.length}`);
    tables.rows.forEach(t => console.log(`   - ${t.table_name}`));
    
  } catch (error) {
    console.error('❌ ERREUR MIGRATION:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
