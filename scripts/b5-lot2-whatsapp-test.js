const { sendAutoMessage } = require('../src/services/whatsapp-web.service');

async function testWhatsApp() {
  console.log('=== TEST WHATSAPP B5 ===\n');
  console.log('Envoi message test à +242069735418');
  console.log('Template: bolamu_resultats_disponibles');
  console.log('Params: ["Antonio", "Laboratoire Central Brazza"]\n');
  
  try {
    await sendAutoMessage('+242069735418', 'bolamu_resultats_disponibles', ['Antonio', 'Laboratoire Central Brazza']);
    console.log('✓ Message envoyé avec succès');
    console.log('\n⚠️ EN ATTENTE CONFIRMATION NATSY');
    console.log('Vérifiez que le message a bien été reçu sur WhatsApp');
    console.log('STOP — Ne passe pas au lot 3 sans confirmation');
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error.message);
  }
}

testWhatsApp();
