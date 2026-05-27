const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration021() {
  try {
    console.log('🚀 Début migration_021_coupons...');
    
    // Table coupons
    console.log('\n📋 Création table coupons...');
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('pourcentage','fixe')),
          valeur NUMERIC(10,2) NOT NULL CHECK (valeur > 0),
          quota_total INTEGER,
          quota_utilise INTEGER DEFAULT 0,
          date_expiration TIMESTAMP,
          user_type_restriction VARCHAR(20) CHECK (user_type_restriction IN 
            ('patient','partner', NULL)),
          usage_unique_par_user BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          created_by VARCHAR(20) REFERENCES users(phone),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Table coupons créée (ou existe déjà)');
    } catch (e) {
      console.log('⚠️ Table coupons existe déjà, continuation...');
    }
    
    // Table coupon_usages
    console.log('\n📋 Création table coupon_usages...');
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coupon_usages (
          id SERIAL PRIMARY KEY,
          coupon_id INTEGER NOT NULL REFERENCES coupons(id),
          user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
          subscription_id INTEGER,
          montant_remise NUMERIC(10,2) NOT NULL,
          used_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Table coupon_usages créée (ou existe déjà)');
    } catch (e) {
      console.log('⚠️ Table coupon_usages existe déjà, continuation...');
    }
    
    // Table idempotency_keys
    console.log('\n📋 Création table idempotency_keys...');
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          id SERIAL PRIMARY KEY,
          idempotency_key VARCHAR(100) UNIQUE NOT NULL,
          endpoint VARCHAR(100) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          request_hash VARCHAR(64) NOT NULL,
          response_status INTEGER,
          response_body JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
        )
      `);
      console.log('✅ Table idempotency_keys créée (ou existe déjà)');
    } catch (e) {
      console.log('⚠️ Table idempotency_keys existe déjà, continuation...');
    }
    
    // Index
    console.log('\n📋 Création des index...');
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(user_phone)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key)`);
      console.log('✅ Index créés (ou existent déjà)');
    } catch (e) {
      console.log('⚠️ Index existent déjà, continuation...');
    }
    
    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE coupons IS 'Coupons de réduction pour abonnements'`);
    await pool.query(`COMMENT ON TABLE coupon_usages IS 'Historique d utilisation des coupons'`);
    await pool.query(`COMMENT ON TABLE idempotency_keys IS 'Cles d idempotence pour éviter les doubles paiements'`);
    await pool.query(`COMMENT ON COLUMN idempotency_keys.expires_at IS 'Expiration de la cle (24h par defaut)'`);
    console.log('✅ Commentaires ajoutés');
    
    // Vérification finale
    console.log('\n📋 Vérification des tables créées :');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('coupons', 'coupon_usages', 'idempotency_keys')
      ORDER BY table_name
    `);
    console.log(tables.rows.map(r => `  - ${r.table_name} ✅`).join('\n'));
    
    console.log('\n✅ Migration 021 terminée avec succès !');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration021();
