const { sendAutoMessage } = require('../src/services/whatsapp-web.service');

async function testWhatsAppCheckin() {
  try {
    console.log('📱 Test WhatsApp template bolamu_checkin_confirme...');
    const result = await sendAutoMessage(
      '+242069735418',
      'bolamu_checkin_confirme',
      ['King', 'Session basket communautaire', '50']
    );
    console.log('✅ WhatsApp envoyé:', result);
    console.log('\n⚠️ EN ATTENTE CONFIRMATION NATSY');
    console.log('Veuillez vérifier la réception du message WhatsApp sur +242069735418');
    console.log('Message attendu: "Présence confirmée, King ! Vous avez participé à Session basket communautaire. +50 Zora crédités sur votre compte. L\'équipe Bolamu"');
  } catch (error) {
    console.error('❌ Erreur test WhatsApp:', error.message);
  }
}

testWhatsAppCheckin();
