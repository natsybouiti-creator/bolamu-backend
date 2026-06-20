// ============================================================
// BOLAMU — Système de migration automatique
// ============================================================
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

/**
 * Créer la table de suivi des migrations si elle n'existe pas
 */
async function ensureMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations_applied (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Table migrations_applied vérifiée');
  } catch (error) {
    console.error('❌ Erreur création table migrations_applied:', error.message);
    throw error;
  }
}

/**
 * Lister les fichiers de migration triés par ordre chronologique
 */
function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.startsWith('migration_') && file.endsWith('.sql'))
    .sort();
  return files;
}

/**
 * Récupérer les migrations déjà appliquées
 */
async function getAppliedMigrations() {
  try {
    const result = await pool.query('SELECT filename FROM migrations_applied ORDER BY applied_at');
    return result.rows.map(row => row.filename);
  } catch (error) {
    console.error('❌ Erreur récupération migrations appliquées:', error.message);
    throw error;
  }
}

/**
 * Parser SQL pour séparer les instructions
 */
function parseSQL(sql) {
  const instructions = [];
  let current = '';
  let inDoBlock = false;
  let depth = 0;
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('DO $$')) {
      inDoBlock = true;
      depth = 1;
      current += line + '\n';
      continue;
    }
    
    if (inDoBlock) {
      current += line + '\n';
      const matches = line.match(/\$\$/g);
      if (matches) {
        depth += matches.length;
        if (depth % 2 === 0) {
          inDoBlock = false;
          if (current.trim()) {
            instructions.push(current.trim());
          }
          current = '';
        }
      }
      continue;
    }
    
    if (trimmed.endsWith(';')) {
      current += line;
      if (current.trim()) {
        instructions.push(current.trim());
      }
      current = '';
    } else if (trimmed.length > 0) {
      current += line + '\n';
    }
  }
  
  if (current.trim()) {
    instructions.push(current.trim());
  }
  
  return instructions;
}

/**
 * Exécuter une migration
 */
async function executeMigration(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  const instructions = parseSQL(sql);
  
  console.log(`🔄 Exécution de ${filename} (${instructions.length} instructions)`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      await client.query(instruction);
    }
    
    // Enregistrer la migration comme appliquée
    await client.query(
      'INSERT INTO migrations_applied (filename) VALUES ($1)',
      [filename]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Migration ${filename} appliquée avec succès`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Erreur lors de la migration ${filename}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Exécuter toutes les migrations en attente
 */
async function runMigrations() {
  try {
    console.log('🚀 Démarrage du système de migration automatique\n');
    
    await ensureMigrationsTable();
    
    const migrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    
    const pendingMigrations = migrationFiles.filter(
      file => !appliedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ Aucune migration en attente');
      return;
    }
    
    console.log(`📋 ${pendingMigrations.length} migration(s) en attente:\n`);
    pendingMigrations.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    for (const file of pendingMigrations) {
      await executeMigration(file);
    }
    
    console.log('\n✅ Toutes les migrations ont été appliquées avec succès');
  } catch (error) {
    console.error('\n❌ Erreur fatale lors des migrations:', error.message);
    console.error('Le serveur ne démarrera pas tant que les migrations ne seront pas résolues');
    throw error;
  }
}

module.exports = { runMigrations };
