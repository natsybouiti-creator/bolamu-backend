// Scénarios de fraude pour Boucle 4 - Parcours de Soins
// Documentation des risques et mitigations

const scenarios = [
  {
    id: 'FRAUDE-001',
    titre: 'Ouverture consultation non autorisée',
    description: 'Médecin ouvre consultation pour patient sans RDV valide',
    mitigation: 'Vérification rdv_id dans consultation.service.js avec rendez_vous.status = confirmed',
    test: 'Tenter POST /consultations/open avec rdv_id inexistant ou status != confirmed'
  },
  {
    id: 'FRAUDE-002',
    titre: 'Création ordonnance sans consultation active',
    description: 'Médecin crée ordonnance sans consultation ouverte/validée',
    mitigation: 'Vérification consultation.status = completed dans ordonnance.service.js',
    test: 'Tenter POST /ordonnances avec consultation_id inexistant ou status != completed'
  },
  {
    id: 'FRAUDE-003',
    titre: 'Dispensation ordonnance par pharmacie non autorisée',
    description: 'Pharmacie dispense ordonnance sans vérification consultation',
    mitigation: 'Vérification role = pharmacie dans ordonnance.controller.js',
    test: 'Tenter POST /ordonnances/:id/dispense avec token médecin'
  },
  {
    id: 'FRAUDE-004',
    titre: 'Accès historique patient sans consentement',
    description: 'Accès GET /consultations/patient/:phone/history sans consentement BHP',
    mitigation: 'bhpAccessMiddleware sur route historique avec vérification consent_granted',
    test: 'Tenter GET historique patient sans consentement actif'
  },
  {
    id: 'FRAUDE-005',
    titre: 'Double ouverture consultation même RDV',
    description: 'Médecin ouvre 2 consultations pour le même RDV',
    mitigation: 'Vérification unicité consultation.rdv_id dans consultation.service.js',
    test: 'Tenter 2x POST /consultations/open avec même rdv_id'
  },
  {
    id: 'FRAUDE-006',
    titre: 'Modification ordonnance après dispensation',
    description: 'Médecin modifie ordonnance déjà dispensée',
    mitigation: 'Vérification ordonnance.status = active avant modification',
    test: 'Tenter PUT ordonnance avec status = dispensed'
  },
  {
    id: 'FRAUDE-007',
    titre: 'Injection SQL dans motif/diagnostic',
    description: 'Injection SQL via champs texte libres',
    mitigation: 'Paramétrage PostgreSQL (pg) automatique, validation inputs',
    test: 'Tenter injection SQL dans motif consultation'
  },
  {
    id: 'FRAUDE-008',
    titre: 'Usurpation rôle médecin',
    description: 'Patient tente d\'accéder routes médecins',
    mitigation: 'authMiddleware + vérification role dans chaque controller',
    test: 'Tenter POST /consultations/open avec token patient'
  }
];

console.log('=== LOT 4 — SCÉNARIOS FRAUDE ===\n');
scenarios.forEach(s => {
  console.log(`[${s.id}] ${s.titre}`);
  console.log(`  Description: ${s.description}`);
  console.log(`  Mitigation: ${s.mitigation}`);
  console.log(`  Test: ${s.test}\n`);
});

console.log(`Total: ${scenarios.length} scénarios documentés`);
console.log('✅ LOT 4 — SCÉNARIOS FRAUDE DOCUMENTÉS');
