// LOT 0 - Vérification session whatsapp-web + test envoi
// Force mode local (pas Render) pour whatsapp-web.js
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { sendAutoMessage, getClientStatus, initializeClient, client } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');

const TEST_PHONE = '+242069735418';

console.log('[LOT 0] Vérification session whatsapp-web.js');
console.log('===========================================');

const status = getClientStatus();
console.log('État client:', status);

if (status === 'DISABLED') {
  console.log('❌ Client désactivé (mode Render)');
  console.log('→ Sur Render, le fallback utilise API Meta (whatsapp.service.js)');
  console.log('→ En local, IS_RENDER doit être false pour utiliser whatsapp-web.js');
  process.exit(1);
}

if (status === 'DISCONNECTED') {
  console.log('❌ Client déconnecté');
  console.log('→ Initialisation du client...');
  initializeClient();
  
  console.log('→ Attente génération QR code (30 secondes)...');
  setTimeout(() => {
    const newStatus = getClientStatus();
    console.log('Nouvel état:', newStatus);
    
    if (newStatus === 'READY') {
      console.log('✅ Client prêt - envoi test...');
      sendTestMessage();
    } else {
      console.log('❌ Toujours déconnecté - QR code à scanner');
      console.log('→ Le fichier qrcode-bolamu.png a été généré');
      console.log('→ Scannez-le avec WhatsApp sur votre téléphone');
      console.log('→ Relancez ce script après connexion');
    }
  }, 30000);
} else if (status === 'READY') {
  console.log('✅ Client connecté - envoi test...');
  sendTestMessage();
} else {
  console.log('⚠️ État inconnu:', status);
  console.log('→ Initialisation du client...');
  initializeClient();
}

async function sendTestMessage() {
  try {
    const formattedPhone = normalizePhone(TEST_PHONE);
    console.log('Envoi à:', formattedPhone);
    
    const result = await sendAutoMessage(
      formattedPhone,
      'mega_loop_test',
      ['Bolamu mega loop - test connexion OK']
    );
    
    console.log('✅ Message envoyé avec succès');
    console.log('→ Vérifiez votre téléphone (chat "Vous-même" si numéro lié)');
  } catch (error) {
    console.error('❌ Erreur envoi:', error.message);
  }
}
