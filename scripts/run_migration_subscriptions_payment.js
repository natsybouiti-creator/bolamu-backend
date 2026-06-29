// ============================================================
// BOLAMU — Runner : add_subscription_payment_fields
// Exécute chaque statement séparément (autocommit) :
// ALTER TYPE ... ADD VALUE ne peut pas tourner dans une transaction.
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('🚀 Migration subscriptions payment fields...');

    // 1. ENUM 'pending' (statement autonome, hors transaction)
    console.log("\n📋 ALTER TYPE subscription_status ADD VALUE 'pending'...");
    await pool.query(`ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending'`);
    console.log("✅ Valeur 'pending' présente");

    // 2. Colonnes manquantes (idempotent)
    console.log('\n📋 ALTER TABLE subscriptions ADD COLUMN...');
    await pool.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS operator          VARCHAR(10) CHECK (operator IN ('MTN','AIRTEL')),
        ADD COLUMN IF NOT EXISTS next_billing_date DATE,
        ADD COLUMN IF NOT EXISTS validated_by      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS validated_at      TIMESTAMPTZ
    `);
    console.log('✅ Colonnes ajoutées');

    // 3. FK validated_by -> users(phone) (idempotent)
    console.log('\n📋 Contrainte FK validated_by -> users(phone)...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_subscriptions_validated_by'
            AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscriptions_validated_by
            FOREIGN KEY (validated_by) REFERENCES users (phone) ON UPDATE CASCADE;
        END IF;
      END$$;
    `);
    console.log('✅ FK présente');

    // 4. Index pour les cron jobs
    console.log('\n📋 Index idx_subscriptions_next_billing...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing
        ON subscriptions (next_billing_date)
        WHERE status = 'active'
    `);
    console.log('✅ Index présent');

    // Vérification
    console.log('\n📋 Vérification colonnes :');
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'subscriptions'
        AND column_name IN ('operator','next_billing_date','validated_by','validated_at','payment_reference')
      ORDER BY column_name
    `);
    cols.rows.forEach(r => console.log(`  - ${r.column_name} ✅`));

    console.log('\n✅ Migration OK');
  } catch (error) {
    console.error('❌ Erreur migration :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
