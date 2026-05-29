const pool = require('../src/config/db');

async function createDocumentsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        uploaded_by VARCHAR(20) NOT NULL REFERENCES users(phone),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('[MIGRATION] Table documents créée avec succès');

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id)`);
    console.log('[MIGRATION] Index documents créés avec succès');

    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] Erreur:', error.message);
    process.exit(1);
  }
}

createDocumentsTable();
