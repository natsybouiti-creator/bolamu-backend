// Scénarios de fraude à tester pour LOT 4
// Ces tests nécessitent une connexion DB active

const fraudeScenarios = [
  {
    id: 'FRAUDE-001',
    name: 'Double check-in même patient',
    description: 'Tenter de scanner le même QR code deux fois pour le même événement',
    mitigation: 'La table event_registrations empêche le double check-in via status check-in unique + constraint',
    test: 'Vérifier que la mise à jour status="checked_in" est idempotente'
  },
  {
    id: 'FRAUDE-002',
    name: 'Check-in avec QR expiré',
    description: 'Utiliser un QR token expiré (JWT exp > 72h)',
    mitigation: 'La fonction checkinPatient vérifie jwt.verify() et rejette les tokens expirés',
    test: 'Vérifier que jwt.verify() lève une erreur pour les tokens expirés'
  },
  {
    id: 'FRAUDE-003',
    name: 'Check-in QR invalide',
    description: 'Scanner un QR token falsifié ou modifié',
    mitigation: 'La signature JWT empêche la falsification des tokens',
    test: 'Vérifier que jwt.verify() rejette les signatures invalides'
  },
  {
    id: 'FRAUDE-004',
    name: 'Création événement sans autorisation',
    description: 'Tenter de créer un événement sans être animateur',
    mitigation: 'Le middleware requireAnimateur vérifie req.user.role === "animateur"',
    test: 'Vérifier que POST /animateur/events renvoie 403 pour les non-animateurs'
  },
  {
    id: 'FRAUDE-005',
    name: 'Notification club non assigné',
    description: 'Tenter de notifier un club non assigné à l\'animateur',
    mitigation: 'La fonction notifyClub vérifie animateur_clubs avant envoi',
    test: 'Vérifier que la requête échoue si animateur_phone n\'est pas dans animateur_clubs'
  },
  {
    id: 'FRAUDE-006',
    name: 'Accès inscriptions événement autre animateur',
    description: 'Tenter de voir les inscriptions d\'un événement organisé par un autre animateur',
    mitigation: 'La route GET /events/:id/registrations vérifie organizer_phone === req.user.phone',
    test: 'Vérifier que la requête échoue avec 403 pour les événements non assignés'
  }
];

console.log('=== LOT 4 - SCÉNARIOS FRAUDE ===\n');
fraudeScenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.id} - ${scenario.name}`);
  console.log(`   Description: ${scenario.description}`);
  console.log(`   Mitigation: ${scenario.mitigation}`);
  console.log(`   Test: ${scenario.test}`);
  console.log('');
});

console.log('✅ LOT 4 - SCÉNARIOS FRAUDE DOCUMENTÉS');
console.log('⚠️ Ces scénarios nécessitent une connexion DB active pour les tests réels');
