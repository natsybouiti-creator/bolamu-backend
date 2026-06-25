// ÉTAPE 2 - Initialiser whatsapp-web et laisser tourner 7 min
// Force mode local (pas Render)
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { sendAutoMessage, getClientStatus, initializeClient, client } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');
const pool = require('../src/config/db');
const qrcode = require('qrcode');
const path = require('path');

console.log('[LOT 0] Initialisation whatsapp-web.js');
console.log('========================================\n');

// Initialiser le client
initializeClient();

let qrGenerated = false;
let clientReady = false;

// Écouter QR
client.on('qr', async (qr) => {
  if (qrGenerated) return;
  qrGenerated = true;
  
  console.log('\n📱 QR CODE GÉNÉRÉ :\n');
  const qrPath = path.join(__dirname, '../qrcode-bolamu.png');
  await qrcode.toFile(qrPath, qr);
  console.log(`📱 QR code sauvegardé : ${qrPath}`);
  console.log('→ Scannez ce QR code avec WhatsApp sur votre téléphone\n');
});

// Écouter ready
client.on('ready', () => {
  if (clientReady) return;
  clientReady = true;
  console.log('✅ WhatsApp Service prêt\n');
  console.log('⏱️  Laissez tourner 7 minutes minimum pour la sauvegarde session...');
  console.log('⏱️  Backup RemoteAuth toutes les 2 minutes\n');
});

// Vérification session après 7 min
setTimeout(async () => {
  console.log('\n=== VÉRIFICATION SESSION APRÈS 7 MIN ===\n');
  
  try {
    const result = await pool.query(`
      SELECT id, octet_length(session) AS taille, updated_at
      FROM whatsapp_sessions
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Aucune session sauvegardée');
    } else {
      const session = result.rows[0];
      console.log('ID:', session.id);
      console.log('Taille:', session.taille, 'octets');
      console.log('MAJ:', session.updated_at);
      
      if (session.taille && session.taille > 0) {
        console.log('\n✅ SESSION PLEINE - Sauvegarde réussie !');
        console.log('→ Vous pouvez maintenant couper le service');
        console.log('→ La session sera restaurée automatiquement au prochain démarrage\n');
        
        // Test envoi message
        console.log('=== TEST ENVOI MESSAGE ===');
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
      } else {
        console.log('\n❌ SESSION VIDE - Attendre encore...');
        console.log('→ La sauvegarde peut prendre plus de temps\n');
      }
    }
  } catch (error) {
    console.error('❌ Erreur vérification:', error.message);
  }
}, 7 * 60 * 1000); // 7 minutes

// Vérification intermédiaire toutes les 2 min
setInterval(async () => {
  const status = getClientStatus();
  console.log(`[${new Date().toLocaleTimeString()}] État client: ${status}`);
  
  try {
    const result = await pool.query(`
      SELECT octet_length(session) AS taille
      FROM whatsapp_sessions
    `);
    
    if (result.rows.length > 0) {
      const taille = result.rows[0].taille;
      console.log(`[${new Date().toLocaleTimeString()}] Taille session: ${taille || 'null'} octets`);
    }
  } catch (error) {
    // Ignorer erreurs pendant les vérifications
  }
}, 2 * 60 * 1000); // 2 minutes

console.log('→ En attente de génération QR code...\n');
