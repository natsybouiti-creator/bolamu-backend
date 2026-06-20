// ============================================================
// BOLAMU — Sprint 3 : Exécution Seed Marketplace
// ============================================================
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runSeed() {
  console.log('🚀 DÉBUT SEED MARKETPLACE ZORA');
  
  try {
    const seedPath = path.join(__dirname, '../database/migrations/seeds/seed_zora_marketplace.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    
    await pool.query(sql);
    console.log('✅ Données marketplace insérées avec succès');
    
    // Vérification partenaires
    const partners = await pool.query('SELECT COUNT(*) as count FROM zora_partners');
    console.log(`📊 Partenaires insérés : ${partners.rows[0].count}`);
    
    // Vérification récompenses
    const rewards = await pool.query('SELECT COUNT(*) as count FROM zora_rewards');
    console.log(`📊 Récompenses insérées : ${rewards.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ ERREUR SEED:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runSeed();
