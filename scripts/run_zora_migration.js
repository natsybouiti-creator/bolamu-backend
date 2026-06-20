const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runZoraMigration() {
  try {
    console.log('🚀 Début migration Zora Points...');
    
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, '../database/migrations/migration_030_zora_points.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Exécuter la migration
    console.log('📋 Exécution migration_030_zora_points.sql...');
    await pool.query(migrationSQL);
    console.log('✅ Migration 030 terminée (tables Zora créées)');
    
    // Vérifier que les tables existent
    const checkTables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('zora_points', 'zora_ledger', 'zora_tiers_config', 'zora_earn_rules', 'zora_category_caps')
      ORDER BY table_name
    `);
    console.log(`🔍 Vérification tables Zora : ${checkTables.rows.length} tables créées ✅`);
    checkTables.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    console.log('\n✅ Migration Zora terminée avec succès !');
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration Zora :', error.message);
    await pool.end();
    process.exit(1);
  }
}

runZoraMigration();
