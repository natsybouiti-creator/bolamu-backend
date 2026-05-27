const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration020() {
  try {
    console.log('🚀 Début migration_020_conflicts...');
    
    // Table conflicts
    console.log('\n📋 Création table conflicts...');
    await pool.query(`
      CREATE TABLE conflicts (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(20) UNIQUE NOT NULL,
        patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        partner_phone VARCHAR(20) REFERENCES users(phone),
        partner_type VARCHAR(20) CHECK (partner_type IN 
          ('doctor','pharmacy','lab','clinic')),
        sujet VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        statut VARCHAR(30) NOT NULL DEFAULT 'created' CHECK (statut IN (
          'created','pending_review','assigned','investigating',
          'waiting_response','resolved','closed','rejected','archived'
        )),
        priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN 
          ('normale','haute','critique')),
        agent_phone VARCHAR(20) REFERENCES users(phone),
        resolution TEXT,
        escalade_sup_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP
      )
    `);
    console.log('✅ Table conflicts créée');
    
    // Table conflict_messages
    console.log('\n📋 Création table conflict_messages...');
    await pool.query(`
      CREATE TABLE conflict_messages (
        id SERIAL PRIMARY KEY,
        conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
        sender_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        sender_role VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        pieces_jointes JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table conflict_messages créée');
    
    // Table conflict_actions
    console.log('\n📋 Création table conflict_actions...');
    await pool.query(`
      CREATE TABLE conflict_actions (
        id SERIAL PRIMARY KEY,
        conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
        action VARCHAR(50) NOT NULL,
        ancien_statut VARCHAR(30),
        nouveau_statut VARCHAR(30),
        acteur_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
        acteur_role VARCHAR(20) NOT NULL,
        commentaire TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table conflict_actions créée');
    
    // Index
    console.log('\n📋 Création des index...');
    await pool.query(`CREATE INDEX idx_conflicts_patient ON conflicts(patient_phone)`);
    await pool.query(`CREATE INDEX idx_conflicts_statut ON conflicts(statut)`);
    await pool.query(`CREATE INDEX idx_conflicts_agent ON conflicts(agent_phone)`);
    await pool.query(`CREATE INDEX idx_conflict_messages_conflict ON conflict_messages(conflict_id)`);
    await pool.query(`CREATE INDEX idx_conflict_actions_conflict ON conflict_actions(conflict_id)`);
    console.log('✅ Index créés');
    
    // Commentaires
    console.log('\n📋 Ajout des commentaires...');
    await pool.query(`COMMENT ON TABLE conflicts IS 'Conflits entre patients et partenaires de santé'`);
    await pool.query(`COMMENT ON TABLE conflict_messages IS 'Messages échangés sur un conflit'`);
    await pool.query(`COMMENT ON TABLE conflict_actions IS 'Historique des actions sur un conflit'`);
    await pool.query(`COMMENT ON COLUMN conflicts.escalade_sup_admin IS 'Indique si le conflit a été escaladé au super admin'`);
    console.log('✅ Commentaires ajoutés');
    
    // Vérification finale
    console.log('\n📋 Vérification des tables créées :');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('conflicts', 'conflict_messages', 'conflict_actions')
      ORDER BY table_name
    `);
    console.log(tables.rows.map(r => `  - ${r.table_name} ✅`).join('\n'));
    
    console.log('\n✅ Migration 020 terminée avec succès !');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration020();
