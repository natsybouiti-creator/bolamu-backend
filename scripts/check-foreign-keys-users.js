// Trouver toutes les foreign keys vers users(phone)
const pool = require('../src/config/db');

async function checkForeignKeys() {
  try {
    const result = await pool.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'phone'
      ORDER BY tc.table_name
    `);
    
    console.log('=== FOREIGN KEYS VERS users(phone) ===');
    result.rows.forEach(row => {
      console.log(`${row.table_name}.${row.column_name} → users.phone`);
    });
    console.log('======================================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkForeignKeys();
