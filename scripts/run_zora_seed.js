const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runZoraSeed() {
  try {
    console.log('🚀 Début seed Zora Points...');
    
    // Lire le fichier de seed
    const seedPath = path.join(__dirname, '../database/migrations/seeds/seed_zora.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    // Exécuter le seed
    console.log('📋 Exécution seed_zora.sql...');
    await pool.query(seedSQL);
    console.log('✅ Seed Zora terminé (paliers, caps, règles insérés)');
    
    // Vérifier les données insérées
    const checkTiers = await pool.query('SELECT * FROM zora_tiers_config ORDER BY min_points');
    console.log(`🔍 Paliers insérés : ${checkTiers.rows.length} ✅`);
    
    const checkCaps = await pool.query('SELECT * FROM zora_category_caps');
    console.log(`🔍 Caps insérés : ${checkCaps.rows.length} ✅`);
    
    const checkRules = await pool.query('SELECT * FROM zora_earn_rules ORDER BY phase, action_type');
    console.log(`🔍 Règles insérées : ${checkRules.rows.length} ✅`);
    console.log(`  - Phase 'now' : ${checkRules.rows.filter(r => r.phase === 'now').length} actives`);
    console.log(`  - Phase 'sprint5' : ${checkRules.rows.filter(r => r.phase === 'sprint5').length} inactives`);
    console.log(`  - Phase 'phase2' : ${checkRules.rows.filter(r => r.phase === 'phase2').length} inactives`);
    
    console.log('\n✅ Seed Zora terminé avec succès !');
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors du seed Zora :', error.message);
    await pool.end();
    process.exit(1);
  }
}

runZoraSeed();
