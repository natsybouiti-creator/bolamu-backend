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
    
    // Vérifier si la table voucher_payouts existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voucher_payouts'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('La table voucher_payouts n\'existe pas.');
      return;
    }
    
    // Récupérer les colonnes de voucher_payouts
    const columns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length,
             is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'voucher_payouts'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n=== SCHÉMA RÉEL DE voucher_payouts ===\n');
    console.table(columns.rows);
    
    // Sauvegarder dans un fichier
    const schemaFile = 'database/voucher_payouts_schema.txt';
    fs.writeFileSync(schemaFile, columns.rows.map(c => 
      `${c.column_name} | ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''} | ${c.is_nullable} | ${c.column_default || 'NULL'}`
    ).join('\n'));
    console.log(`\nSchéma sauvegardé dans ${schemaFile}`);
    
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
