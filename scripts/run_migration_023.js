// ============================================================
// BOLAMU — Script Execution Migration 023 (Sprint 7)
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration023() {
  try {
    console.log('🚀 Début migration_023_notifications...');

    // Table push_subscriptions
    console.log('\n📋 Création table push_subscriptions...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device_type VARCHAR(20) DEFAULT 'web',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_phone, endpoint)
      )
    `);
    console.log('✅ Table push_subscriptions créée');

    // Table notifications
    console.log('\n📋 Création table notifications...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        type VARCHAR(50) NOT NULL CHECK (type IN (
          'rdv_confirme','rdv_rappel','rdv_annule',
          'paiement_recu','abonnement_expire','abonnement_renouvele',
          'conflit_update','message_recu','alerte_systeme',
          'whatsapp_message'
        )),
        titre VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        canal VARCHAR(20) DEFAULT 'push' CHECK (canal IN 
          ('push','whatsapp','sms','email')),
        is_read BOOLEAN DEFAULT false,
        sent_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table notifications créée');

    // Index
    console.log('\n📋 Création des index...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_phone, is_read)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_phone)`);
    console.log('✅ Index créés');

    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE push_subscriptions IS 'Abonnements Web Push API pour notifications push'`);
    await pool.query(`COMMENT ON TABLE notifications IS 'Historique des notifications envoyées (push, WhatsApp, SMS, email)'`);
    console.log('✅ Commentaires ajoutés');

    // Vérification finale
    console.log('\n📋 Vérification des tables créées :');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('push_subscriptions', 'notifications')
      ORDER BY table_name
    `);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name} ✅`);
    });

    console.log('\n✅ Migration 023 terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration023();
