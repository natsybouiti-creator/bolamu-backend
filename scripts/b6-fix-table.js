const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixTable() {
  const client = await pool.connect();
  try {
    // Drop table
    await client.query('DROP TABLE IF EXISTS zora_voucher_validations');
    console.log('✓ Table zora_voucher_validations supprimée');
    
    // Recreate with correct schema
    await client.query(`
      CREATE TABLE zora_voucher_validations (
        id SERIAL PRIMARY KEY,
        partner_phone VARCHAR(20) NOT NULL,
        voucher_code VARCHAR(36) NOT NULL,
        validated_at TIMESTAMPTZ DEFAULT NOW(),
        amount_fcfa NUMERIC(10,2),
        method VARCHAR(20) DEFAULT 'code_manual',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Table zora_voucher_validations recréée (voucher_code VARCHAR(36))');
    
    // Create indexes
    await client.query('CREATE INDEX idx_zora_voucher_validations_partner_phone ON zora_voucher_validations(partner_phone)');
    await client.query('CREATE INDEX idx_zora_voucher_validations_voucher_code ON zora_voucher_validations(voucher_code)');
    await client.query('CREATE INDEX idx_zora_voucher_validations_validated_at ON zora_voucher_validations(validated_at DESC)');
    console.log('✓ Indexes créés');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTable();
