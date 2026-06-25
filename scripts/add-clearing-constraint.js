const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function addConstraint() {
  const client = await pool.connect();
  try {
    // Supprimer et recréer la table avec la contrainte
    await client.query('DROP TABLE IF EXISTS clearing_transactions CASCADE');
    console.log('✓ Table clearing_transactions supprimée');
    
    const sql = fs.readFileSync('./database/migrations/migration_049_b5_clearing.sql', 'utf8');
    await client.query(sql);
    console.log('✓ Table clearing_transactions recréée avec contrainte CHECK amount_fcfa > 0');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const fs = require('fs');
addConstraint();
