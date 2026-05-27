const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    console.log('🚀 Début des migrations...');
    
    // Migration 018 : Table time_slots
    console.log('\n📋 Exécution migration_018_time_slots.sql...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        doctor_phone VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        heure_debut TIME NOT NULL,
        heure_fin TIME NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_time_slots_doctor FOREIGN KEY (doctor_phone) REFERENCES doctors(phone) ON DELETE CASCADE,
        CONSTRAINT chk_time_slots_hours CHECK (heure_fin > heure_debut),
        CONSTRAINT uq_time_slots UNIQUE (doctor_phone, date, heure_debut)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_slots_doctor_date ON time_slots(doctor_phone, date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_slots_available ON time_slots(is_available)`);
    await pool.query(`COMMENT ON TABLE time_slots IS 'Créneaux horaires disponibles pour les médecins'`);
    console.log('✅ Migration 018 terminée (table time_slots créée)');
    
    // Vérifier que la table time_slots existe
    const checkTable = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'time_slots'
    `);
    console.log(`🔍 Vérification table time_slots : ${checkTable.rows.length > 0 ? 'EXISTE ✅' : 'NEXISTE PAS ❌'}`);
    
    // Migration 019 : Colonne priorite dans lab_prescriptions
    console.log('\n📋 Exécution migration_019_lab_orders_priority.sql...');
    try {
      await pool.query(`
        ALTER TABLE lab_prescriptions 
        ADD COLUMN IF NOT EXISTS priorite VARCHAR(20) DEFAULT 'normale',
        ADD CONSTRAINT chk_lab_prescriptions_priorite CHECK (priorite IN ('normale', 'urgente', 'critique'))
      `);
      await pool.query(`COMMENT ON COLUMN lab_prescriptions.priorite IS 'Priorité de la prescription labo : normale, urgente, critique'`);
      console.log('✅ Migration 019 terminée (colonne priorite ajoutée)');
    } catch (e) {
      if (e.code === '42P01') {
        console.log('⚠️ Table lab_prescriptions n\'existe pas, migration 019 ignorée');
      } else {
        throw e;
      }
    }
    
    // Vérifier que la colonne priorite existe dans lab_prescriptions
    try {
      const checkColumn = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lab_prescriptions' AND column_name = 'priorite'
      `);
      console.log(`🔍 Vérification colonne priorite : ${checkColumn.rows.length > 0 ? 'EXISTE ✅' : 'NEXISTE PAS ❌'}`);
    } catch (e) {
      console.log('⚠️ Table lab_prescriptions n\'existe pas, vérification colonne ignorée');
    }
    
    // Vérification finale : lister toutes les tables
    console.log('\n📋 Liste de toutes les tables :');
    const allTables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(allTables.rows.map(r => `  - ${r.table_name}`).join('\n'));
    
    console.log('\n✅ Toutes les migrations terminées avec succès !');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors des migrations :', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
