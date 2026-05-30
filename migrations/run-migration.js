const pool = require('../src/config/db');

async function createDocumentsTable() {
  try {
    // Table documents : uploaded_by est un numéro de téléphone (TEXT)
    // SANS clé étrangère car les documents sont uploadés AVANT
    // la création du compte utilisateur.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('[MIGRATION] Table documents prête');

    // Correction pour les bases existantes : retirer la FK et passer en TEXT
    await pool.query(`ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey`);
    await pool.query(`ALTER TABLE documents ALTER COLUMN uploaded_by TYPE TEXT`);
    console.log('[MIGRATION] Contrainte FK uploaded_by retirée, colonne en TEXT');

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id)`);
    console.log('[MIGRATION] Index documents créés avec succès');

    // Colonne JSONB pour stocker plusieurs documents par utilisateur
    // ex: {"diploma":"<file_id>","ordre":"<file_id>"} pour un médecin
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS documents_file_ids JSONB DEFAULT '{}'::jsonb`);
    console.log('[MIGRATION] Colonne users.documents_file_ids prête');

    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] Erreur:', error.message);
    process.exit(1);
  }
}

createDocumentsTable();
