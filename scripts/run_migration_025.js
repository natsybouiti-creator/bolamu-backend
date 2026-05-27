// ============================================================
// BOLAMU — Script Execution Migration 025 (Sprint 9)
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration025() {
  try {
    console.log('🚀 Début migration_025_pre_rdv...');

    // Table pre_rdv_formulaires
    console.log('\n📋 Création table pre_rdv_formulaires...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pre_rdv_formulaires (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER REFERENCES appointments(id),
        patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        symptomes TEXT[] DEFAULT '{}',
        symptomes_libres TEXT,
        duree_symptomes VARCHAR(50),
        intensite INTEGER CHECK (intensite BETWEEN 1 AND 10),
        antecedents TEXT,
        medicaments_actuels TEXT,
        allergies TEXT,
        triage_couleur VARCHAR(10) DEFAULT 'vert' CHECK (triage_couleur IN 
          ('vert','orange','rouge')),
        triage_score INTEGER DEFAULT 0,
        triage_recommandation TEXT,
        ia_analyse TEXT,
        ia_questions_suggerees TEXT[],
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table pre_rdv_formulaires créée');

    // Table ai_consult_sessions
    console.log('\n📋 Création table ai_consult_sessions...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_consult_sessions (
        id SERIAL PRIMARY KEY,
        patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        session_type VARCHAR(20) DEFAULT 'symptomes' CHECK (session_type IN (
          'symptomes','suivi','information','renouvellement'
        )),
        messages JSONB DEFAULT '[]',
        triage_final VARCHAR(10),
        recommandation_finale TEXT,
        rdv_suggere BOOLEAN DEFAULT false,
        renouvellement_suggere BOOLEAN DEFAULT false,
        tokens_utilises INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table ai_consult_sessions créée');

    // Table renouvellement_demandes
    console.log('\n📋 Création table renouvellement_demandes...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS renouvellement_demandes (
        id SERIAL PRIMARY KEY,
        patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        prescription_id INTEGER NOT NULL,
        session_id_amina INTEGER REFERENCES ai_consult_sessions(id),
        statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
          'en_attente','valide','refuse'
        )),
        motif_refus TEXT,
        doctor_phone VARCHAR(20) REFERENCES users(phone),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table renouvellement_demandes créée');

    // Index
    console.log('\n📋 Création des index...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pre_rdv_patient ON pre_rdv_formulaires(patient_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pre_rdv_appointment ON pre_rdv_formulaires(appointment_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_sessions_patient ON ai_consult_sessions(patient_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_sessions_date ON ai_consult_sessions(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_renouvellement_patient ON renouvellement_demandes(patient_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_renouvellement_statut ON renouvellement_demandes(statut)`);
    console.log('✅ Index créés');

    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE pre_rdv_formulaires IS 'Formulaires pré-RDV avec symptômes et triage'`);
    await pool.query(`COMMENT ON TABLE ai_consult_sessions IS 'Sessions IA Amina pour assistance patients'`);
    await pool.query(`COMMENT ON TABLE renouvellement_demandes IS 'Demandes de renouvellement d ordonnances'`);
    console.log('✅ Commentaires ajoutés');

    // Vérification finale
    console.log('\n📋 Vérification des tables créées :');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('pre_rdv_formulaires', 'ai_consult_sessions', 'renouvellement_demandes')
      ORDER BY table_name
    `);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name} ✅`);
    });

    console.log('\n✅ Migration 025 terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration025();
