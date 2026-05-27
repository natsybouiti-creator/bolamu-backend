// ============================================================
// BOLAMU — Script Execution Migration 024 (Sprint 8)
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration024() {
  try {
    console.log('🚀 Début migration_024_secretariat...');

    // Ajouter rôle secrétaire si non existant
    console.log('\n📋 Ajout rôle secrétaire...');
    await pool.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
              CREATE TYPE role_enum AS ENUM ('patient', 'doctor', 'pharmacy', 'laboratory', 'admin');
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'secretaire' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'role_enum')) THEN
              ALTER TYPE role_enum ADD VALUE 'secretaire';
          END IF;
      END $$
    `);
    console.log('✅ Rôle secrétaire ajouté');

    // Table secretaires
    console.log('\n📋 Création table secretaires...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secretaires (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL REFERENCES users(phone),
        partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        partenaire_type VARCHAR(20) NOT NULL CHECK (partenaire_type IN 
          ('clinic','doctor')),
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table secretaires créée');

    // Table file_attente
    console.log('\n📋 Création table file_attente...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_attente (
        id SERIAL PRIMARY KEY,
        partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        doctor_phone VARCHAR(20) REFERENCES users(phone),
        motif VARCHAR(255),
        priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN 
          ('normale','urgente','critique')),
        statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
          'en_attente','en_consultation','termine','annule'
        )),
        numero_ordre INTEGER NOT NULL,
        heure_arrivee TIMESTAMP DEFAULT NOW(),
        heure_appel TIMESTAMP,
        heure_fin TIMESTAMP,
        notes TEXT,
        created_by VARCHAR(20) REFERENCES users(phone)
      )
    `);
    console.log('✅ Table file_attente créée');

    // Table agenda_blocs
    console.log('\n📋 Création table agenda_blocs...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agenda_blocs (
        id SERIAL PRIMARY KEY,
        doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        date DATE NOT NULL,
        heure_debut TIME NOT NULL,
        heure_fin TIME NOT NULL,
        type VARCHAR(20) DEFAULT 'disponible' CHECK (type IN (
          'disponible','bloque','pause','conge'
        )),
        motif_blocage VARCHAR(255),
        created_by VARCHAR(20) REFERENCES users(phone),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table agenda_blocs créée');

    // Index
    console.log('\n📋 Création des index...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_secretaires_partenaire ON secretaires(partenaire_phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_attente_partenaire ON file_attente(partenaire_phone, statut)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_attente_date ON file_attente(heure_arrivee)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agenda_blocs_doctor ON agenda_blocs(doctor_phone, date)`);
    console.log('✅ Index créés');

    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE secretaires IS 'Secrétaires associés aux partenaires (cliniques, médecins)'`);
    await pool.query(`COMMENT ON TABLE file_attente IS 'File d attente des patients pour consultations'`);
    await pool.query(`COMMENT ON TABLE agenda_blocs IS 'Blocs agenda (disponibilités, pauses, congés) pour médecins'`);
    console.log('✅ Commentaires ajoutés');

    // Vérification finale
    console.log('\n📋 Vérification des tables créées :');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('secretaires', 'file_attente', 'agenda_blocs')
      ORDER BY table_name
    `);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name} ✅`);
    });

    console.log('\n✅ Migration 024 terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration024();
