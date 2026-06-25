// LOT 0 - Vérification session whatsapp-web.js
// Force mode local (pas Render)
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { sendAutoMessage, getClientStatus, initializeClient, client } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');
const qrcode = require('qrcode');
const path = require('path');

const TEST_PHONE = '+242069735418';

console.log('[LOT 0] Vérification session whatsapp-web.js');
console.log('===========================================');

// Vérifier si le client est déjà initialisé et connecté
const status = getClientStatus();
console.log('État client:', status);

if (status === 'READY') {
  console.log('✅ Client CONNECTÉ - envoi message test...');
  sendTest();
} else {
  console.log('❌ Client DISCONNECTED');
  console.log('→ Initialisation du client pour générer QR code...');
  
  // Initialiser le client
  initializeClient();
  
  // Écouter l'événement QR
  client.on('qr', async (qr) => {
    console.log('\n📱 QR CODE GÉNÉRÉ :\n');
    const qrPath = path.join(__dirname, '../qrcode-bolamu.png');
    await qrcode.toFile(qrPath, qr);
    console.log(`📱 QR code sauvegardé : ${qrPath}`);
    console.log('→ Scannez ce QR code avec WhatsApp sur votre téléphone');
    console.log('→ Relancez ce script après connexion');
  });
  
  // Écouter l'événement ready
  client.on('ready', () => {
    console.log('✅ Client prêt - envoi message test...');
    sendTest();
  });
  
  console.log('→ En attente de génération QR code (30 secondes max)...');
  
  // Timeout si pas de QR après 30s
  setTimeout(() => {
    const newStatus = getClientStatus();
    if (newStatus !== 'READY') {
      console.log('❌ Timeout - QR code non généré ou client non connecté');
      console.log('→ Vérifiez que Puppeteer/Chromium est installé');
      console.log('→ npm install puppeteer');
    }
  }, 30000);
}

async function sendTest() {
  try {
    const formattedPhone = normalizePhone(TEST_PHONE);
    console.log('Envoi à:', formattedPhone);
    
    const result = await sendAutoMessage(
      formattedPhone,
      'test',
      ['Bolamu mega loop - test connexion']
    );
    
    console.log('✅ Message envoyé avec succès');
    console.log('→ Vérifiez votre téléphone (chat "Vous-même" si numéro lié)');
    console.log('→ Confirme la réception pour continuer le MEGA LOOP');
  } catch (error) {
    console.error('❌ Erreur envoi:', error.message);
  }
}
