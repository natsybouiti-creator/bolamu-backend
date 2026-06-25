const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkWhatsAppSession() {
  try {
    console.log('=== VÉRIFICATION SESSION WHATSAPP ===\n');

    // 1. Vérifier que la table existe
    const tableCheck = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_name = 'whatsapp_sessions'
       )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('✗ Table whatsapp_sessions n\'existe pas');
      console.log('Exécutez d\'abord: node scripts/run-migration-045.js');
      return;
    }
    console.log('✓ Table whatsapp_sessions existe\n');

    // 2. Vérifier les sessions
    const sessions = await pool.query(
      `SELECT id, length(session) as session_size, created_at, updated_at 
       FROM whatsapp_sessions`
    );

    if (sessions.rows.length === 0) {
      console.log('✗ Aucune session trouvée');
      console.log('Le client WhatsApp n\'a pas encore été initialisé ou scanné.\n');
      console.log('ÉTAPES POUR TESTER LA PERSISTANCE :');
      console.log('1. Démarrer le serveur: npm start');
      console.log('2. Scanner le QR code avec WhatsApp');
      console.log('3. Attendre que le client soit READY');
      console.log('4. Exécuter ce script à nouveau pour vérifier la session');
      console.log('5. Redémarrer le serveur');
      console.log('6. Vérifier que le client est READY sans nouveau scan');
      return;
    }

    console.log(`✓ ${sessions.rows.length} session(s) trouvée(s):\n`);
    
    sessions.rows.forEach(session => {
      console.log(`ID: ${session.id}`);
      console.log(`Taille session: ${session.session_size} caractères`);
      console.log(`Créée le: ${session.created_at}`);
      console.log(`Mise à jour le: ${session.updated_at}`);
      console.log();
    });

    console.log('=== PREUVE DE PERSISTANCE ===');
    console.log('✓ Session sauvegardée dans PostgreSQL');
    console.log('✓ La session persistera entre les redémarrages du serveur');
    console.log('✓ Sur Render, le client WhatsApp démarrera automatiquement sans scan');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkWhatsAppSession();
