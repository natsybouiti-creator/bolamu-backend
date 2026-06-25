// Vérifier les colonnes phone dans les tables concernées
const pool = require('../src/config/db');

async function checkTables() {
  try {
    const tables = ['zora_ledger', 'elonga_registrations', 'health_records', 'subscriptions'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND (column_name LIKE '%phone%' OR column_name LIKE '%user%')
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`=== ${table} ===`);
      if (result.rows.length === 0) {
        console.log('Aucune colonne phone/user trouvée');
      } else {
        result.rows.forEach(row => {
          console.log(`${row.column_name} : ${row.data_type}`);
        });
      }
      console.log('');
    }
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
