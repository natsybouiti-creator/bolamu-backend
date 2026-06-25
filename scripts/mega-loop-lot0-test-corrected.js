// LOT 0 - Test envoi après correction INSERT notifications
// Force mode local (pas Render)
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { sendAutoMessage, getClientStatus, initializeClient } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');
const pool = require('../src/config/db');

const TEST_PHONE = '+242069735418';

console.log('[LOT 0] Test envoi après correction INSERT');
console.log('===========================================');

const status = getClientStatus();
console.log('État client:', status);

if (status !== 'READY') {
  console.log('❌ Client non connecté - Initialisation...');
  initializeClient();
  console.log('→ Attente 30s pour connexion...');
  setTimeout(() => {
    const newStatus = getClientStatus();
    if (newStatus === 'READY') {
      console.log('✅ Client prêt - envoi test...');
      sendTest();
    } else {
      console.log('❌ Toujours déconnecté');
    }
  }, 30000);
} else {
  console.log('✅ Client connecté - envoi test...');
  sendTest();
}

async function sendTest() {
  try {
    const formattedPhone = normalizePhone(TEST_PHONE);
    console.log('Envoi à:', formattedPhone);
    
    await sendAutoMessage(
      formattedPhone,
      'test',
      ['Bolamu mega loop - test connexion 2']
    );
    
    console.log('✅ Message envoyé avec succès');
    
    // Vérification SELECT
    const result = await pool.query(
      `SELECT id, titre, message, sent_at 
       FROM notifications 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    console.log('\n=== PREUVE SQL ===');
    console.log('ID:', result.rows[0].id);
    console.log('Titre:', result.rows[0].titre);
    console.log('Message:', result.rows[0].message);
    console.log('Sent_at:', result.rows[0].sent_at);
    console.log('==================\n');
    
    console.log('→ Vérifiez votre téléphone (chat "Vous-même" si numéro lié)');
    console.log('→ Confirme la réception pour continuer le MEGA LOOP');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}
