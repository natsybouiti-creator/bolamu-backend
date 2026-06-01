const pool = require('./src/config/db');

async function listDoctors() {
  try {
    console.log('=== LISTE DES COMPTES MÉDECIN ===');
    const result = await pool.query(
      `SELECT id, phone, full_name, specialty, is_active, created_at 
       FROM users 
       WHERE role = 'doctor'
       ORDER BY created_at DESC`
    );
    
    console.log(`\nTotal: ${result.rows.length} médecins\n`);
    
    result.rows.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.full_name || '—'}`);
      console.log(`   Phone: ${doc.phone}`);
      console.log(`   Spécialité: ${doc.specialty || '—'}`);
      console.log(`   Statut: ${doc.is_active ? 'Actif' : 'Inactif'}`);
      console.log(`   Créé le: ${doc.created_at}`);
      console.log('');
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

listDoctors();
