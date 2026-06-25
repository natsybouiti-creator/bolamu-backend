const { sendAutoMessage } = require('../src/services/whatsapp-web.service');

async function testWhatsApp() {
  try {
    console.log('=== TEST WHATSAPP B6 ===\n');
    console.log('Envoi message test bolamu_voucher_genere à +242069735418...\n');
    
    await sendAutoMessage('+242069735418', 'bolamu_voucher_genere', [
      'Antonio',
      'TESTB6',
      'MTN Congo'
    ]);
    
    console.log('✓ Message envoyé');
    console.log('\nEN ATTENTE CONFIRMATION NATSY');
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error.message);
  }
}

testWhatsApp();
