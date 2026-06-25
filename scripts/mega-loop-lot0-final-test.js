// LOT 0 - Test final après correction store
// Force mode local (pas Render)
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { sendAutoMessage, getClientStatus, initializeClient, client } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');
const pool = require('../src/config/db');
const qrcode = require('qrcode');
const path = require('path');

console.log('[LOT 0] Test final - Store corrigé');
console.log('===================================\n');

// Purger la table
async function purgeTable() {
  await pool.query('DELETE FROM whatsapp_sessions');
  console.log('✅ Table purgée\n');
}

// Initialiser le client
async function initClient() {
  console.log('→ Initialisation client...\n');
  initializeClient();
}

// Vérifier session
async function checkSession() {
  const result = await pool.query(`
    SELECT id, octet_length(session) AS taille, updated_at
    FROM whatsapp_sessions
  `);
  
  if (result.rows.length === 0) {
    console.log('❌ Aucune session sauvegardée');
    return null;
  }
  
  const session = result.rows[0];
  console.log('=== SESSION ===');
  console.log('ID:', session.id);
  console.log('Taille:', session.taille, 'octets');
  console.log('MAJ:', session.updated_at);
  console.log('==============\n');
  
  return session;
}

// Test envoi message
async function testMessage() {
  try {
    await sendAutoMessage(
      '+242069735418',
      'test',
      ['Bolamu mega loop - test connexion OK']
    );
    console.log('✅ Message envoyé avec succès');
    console.log('→ Vérifiez votre téléphone\n');
  } catch (error) {
    console.error('❌ Erreur envoi:', error.message);
  }
}

// Exécution
(async () => {
  await purgeTable();
  await initClient();
  
  let qrGenerated = false;
  let clientReady = false;
  
  client.on('qr', async (qr) => {
    if (qrGenerated) return;
    qrGenerated = true;
    
    console.log('📱 QR CODE GÉNÉRÉ :\n');
    const qrPath = path.join(__dirname, '../qrcode-bolamu.png');
    await qrcode.toFile(qrPath, qr);
    console.log(`📱 QR code : ${qrPath}`);
    console.log('→ Scannez avec WhatsApp\n');
  });
  
  client.on('ready', () => {
    if (clientReady) return;
    clientReady = true;
    console.log('✅ WhatsApp Service prêt\n');
    console.log('⏱️  Attente 3 min pour sauvegarde session...\n');
  });
  
  // Vérification après 3 min
  setTimeout(async () => {
    console.log('\n=== VÉRIFICATION APRÈS 3 MIN ===\n');
    const session = await checkSession();
    
    if (session && session.taille > 0) {
      console.log('✅ SESSION PLEINE - Sauvegarde réussie !\n');
      console.log('→ COUPER le script (Ctrl+C)');
      console.log('→ RELANCEZ-le pour tester la restauration\n');
      
      await testMessage();
    } else {
      console.log('❌ SESSION VIDE - Échec sauvegarde\n');
    }
  }, 3 * 60 * 1000);
  
  // Vérification intermédiaire
  setInterval(async () => {
    const status = getClientStatus();
    console.log(`[${new Date().toLocaleTimeString()}] État: ${status}`);
    
    const session = await checkSession();
    if (session && session.taille > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Session sauvegardée !\n`);
    }
  }, 30 * 1000);
  
  console.log('→ En attente QR code...\n');
})();
