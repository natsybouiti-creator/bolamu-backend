// LOT 0 - Vérification état client whatsapp-web.js UNIQUEMENT
// Force mode local (pas Render)
process.env.RENDER = 'false';
process.env.NODE_ENV = 'development';

const { getClientStatus } = require('../src/services/whatsapp-web.service');

console.log('[LOT 0] État client whatsapp-web.js');
console.log('=====================================');

const status = getClientStatus();
console.log('État:', status);

if (status === 'READY') {
  console.log('✅ CONNECTÉ');
} else if (status === 'DISCONNECTED') {
  console.log('❌ DISCONNECTED');
  console.log('→ QR code à scanner');
} else if (status === 'DISABLED') {
  console.log('❌ DISABLED (mode Render)');
} else {
  console.log('⚠️ État inconnu:', status);
}
