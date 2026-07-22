const { Pool } = require('pg');
const fs = require('fs');

// Lire DATABASE_URL depuis .env
const envContent = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!dbUrl) {
  console.error('DATABASE_URL non trouvé dans .env');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: dbUrl, 
  ssl: { rejectUnauthorized: false } 
});

async function checkSchema() {
  try {
    console.log('Connexion à Neon...');
    
    const doctorCheck = await pool.query(
      "SELECT id, phone, role, is_active FROM users WHERE phone = '+242068541236'"
    );
    console.log('\n=== VÉRIFICATION MÉDECIN +242068541236 ===\n');
    console.table(doctorCheck.rows);
    
    for (const tableName of ['dossier_access_requests']) {
      const columns = await pool.query(`
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      console.log(`\n=== SCHÉMA RÉEL DE ${tableName} ===\n`);
      console.table(columns.rows);
      
      const fks = await pool.query(`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
      `, [tableName]);
      
      console.log(`\n=== FOREIGN KEYS DE ${tableName} ===\n`);
      console.table(fks.rows);
    }
    
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
