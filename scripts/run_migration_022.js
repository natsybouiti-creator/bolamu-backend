// ============================================================
// BOLAMU — Script Execution Migration 022 (Sprint 6)
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration022() {
  try {
    console.log('🚀 Début migration_022_production_optimizations...');

    // Index manquants
    console.log('\n📋 Création des index manquants...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(patient_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
    console.log('✅ Index créés');

    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE users IS 'Table principale des utilisateurs (patients, médecins, pharmacies, laboratoires, admins)'`);
    await pool.query(`COMMENT ON TABLE subscriptions IS 'Abonnements patients (Essentiel, Standard, Premium)'`);
    await pool.query(`COMMENT ON TABLE audit_log IS 'Journal d audit insert-only (jamais UPDATE ou DELETE)'`);
    await pool.query(`COMMENT ON TABLE payments IS 'Paiements MTN MoMo et Airtel Money'`);
    console.log('✅ Commentaires ajoutés');

    // Vérification finale
    console.log('\n📋 Vérification des index créés :');
    const indexResult = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE indexname LIKE 'idx_%' 
      ORDER BY tablename, indexname
    `);
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.tablename}.${row.indexname} ✅`);
    });

    console.log('\n✅ Migration 022 terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration022();
