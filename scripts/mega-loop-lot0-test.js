// LOT 0 - Test envoi texte libre WhatsApp
const { notifyEventRegistration } = require('../src/services/whatsapp.service');

const TEST_PHONE = '+242069735418';
const TEST_EVENT = {
    title: 'Bolamu Mega Loop - Test Connexion',
    starts_at: new Date().toISOString(),
    location_name: 'Test System'
};
const TEST_SESSION_CODE = 'TEST-001';

console.log('[LOT 0] Envoi message test à', TEST_PHONE);
console.log('Message: "Bolamu mega loop - test connexion"');

notifyEventRegistration(TEST_PHONE, TEST_EVENT, TEST_SESSION_CODE)
    .then(result => {
        console.log('[LOT 0] Résultat:', result);
        if (result) {
            console.log('✅ Message envoyé avec succès - Vérifiez votre téléphone');
        } else {
            console.log('❌ Échec envoi');
        }
    })
    .catch(err => {
        console.error('[LOT 0] Erreur:', err);
    });
