// ============================================================
// BOLAMU — Établissements partenaires (données TEMPORAIRES, codées en dur)
// ============================================================
// Source unique factorisée depuis public/carte.html (carte interactive
// publique) — réutilisée par le dashboard patient (Gagner > Santé > Réseau
// partenaires) en attendant que de vrais partenaires soient onboardés et
// actifs (is_active=true) avec coordonnées GPS en base.
//
// À SUPPRIMER quand GET /api/v1/map/intervenants renvoie des résultats
// exploitables en production (cf. audit Gagner/Santé, 15-16 juillet 2026 :
// à cette date, 8 partenaires actifs en base, 0 avec coordonnées GPS — cette
// liste statique est le seul jeu de données réel et vérifié disponible).
//
// Adresses textuelles confirmées fiables par le fondateur. Coordonnées GPS
// (lat/lng) non re-vérifiées terrain — cohérence grossière avec la ville
// (Brazzaville/Pointe-Noire) contrôlée, mais à re-géocoder avant un usage à
// plus fine échelle (ex. itinéraire précis).
window.ETABLISSEMENTS_CARTE_TEMP = [
  // ===== BRAZZAVILLE — CLINIQUES =====
  {
    id: 1,
    nom: "Clinique Médicale Securex (SAMU)",
    type: "clinique",
    ville: "brazza",
    adresse: "33 Avenue Amilcar Cabral, Centre-ville (angle avenue Alphonse Fondère), Brazzaville",
    tel: "+242 05 548 59 95",
    horaires: "24h/24 — 7j/7 (SAMU)",
    partenaire: true,
    lat: -4.27469,
    lng: 15.28569,
    photo: "/images/landing/68-securex.jpg",
    description: "Clinique privée avec SAMU intégré, 20 lits, urgences 24h/24. Partenaire Bolamu."
  },
  {
    id: 2,
    nom: "Clinique Internationale de Brazzaville",
    type: "clinique",
    ville: "brazza",
    adresse: "Boulevard du Maréchal Lyautey, en face du CHU-B (à côté Pâtisserie Parfaite), Brazzaville",
    tel: "+242 05 699 44 44",
    horaires: "Lun–Sam 07h–19h",
    partenaire: false,
    lat: -4.26731,
    lng: 15.26806,
    photo: "/images/landing/66-clinique-internationale.jpg",
    description: "Clinique privée pluridisciplinaire : pédiatrie, dermatologie, dentisterie, kinésithérapie."
  },
  {
    id: 3,
    nom: "Clinique COGEMO",
    type: "clinique",
    ville: "brazza",
    adresse: "8 rue Albert Bassandza, OCH, face CHU, Brazzaville",
    tel: "+242 06 665 60 46",
    horaires: "Lun–Sam 07h30–19h",
    partenaire: false,
    lat: -4.26881,
    lng: 15.26781,
    photo: "/images/landing/16-reseau-cliniques.jpg",
    description: "Clinique médico-chirurgicale, IRM, scanner, radiographie. Face au CHU."
  },
  {
    id: 4,
    nom: "Clinique Les Rosiers",
    type: "clinique",
    ville: "brazza",
    adresse: "OCH, Moungali 3, Case J416V, non loin de l'hôtel du boulevard, Brazzaville",
    tel: "+242 06 666 44 57",
    horaires: "Lun–Sam 07h–18h",
    partenaire: false,
    lat: -4.26441,
    lng: 15.26295,
    photo: "/images/landing/65-rosiers.jpg",
    description: "Clinique générale, soins et maternité, quartier OCH."
  },

  // ===== BRAZZAVILLE — PHARMACIES =====
  {
    id: 5,
    nom: "Pharmacie Daffé",
    type: "pharmacie",
    ville: "brazza",
    adresse: "111 Avenue des Trois Martyrs, Moungali, Brazzaville",
    tel: "+242 05 697 19 20",
    horaires: "Lun–Sam 07h30–20h | Dim 09h–13h",
    partenaire: true,
    lat: -4.25144,
    lng: 15.27656,
    photo: "/images/landing/67-pharmacie-daffe.jpg",
    description: "Pharmacie partenaire Bolamu, avenue des Trois Martyrs à Moungali. Médicaments essentiels OMS."
  },
  {
    id: 6,
    nom: "Pharmacie Mavré",
    type: "pharmacie",
    ville: "brazza",
    adresse: "Avenue Alphonse Fondère, Immeuble CNSS, Centre-ville (face siège ARC), Brazzaville",
    tel: "+242 22 283 53 20",
    horaires: "Lun–Ven 08h–18h30 | Sam 08h–12h",
    partenaire: false,
    lat: -4.27406,
    lng: 15.28470,
    photo: "/images/landing/64-mavre-brazza.jpg",
    description: "Pharmacie historique (1948), la plus ancienne de Brazzaville, large inventaire de médicaments."
  },

  // ===== BRAZZAVILLE — LABORATOIRES =====
  {
    id: 7,
    nom: "Laboratoire 3A Brazzaville",
    type: "laboratoire",
    ville: "brazza",
    adresse: "Centre-ville, Brazzaville",
    tel: "+242 06 655 00 00",
    horaires: "Lun–Sam 07h–17h",
    partenaire: true,
    lat: -4.24506,
    lng: 15.28819,
    // Audit Gagner/Santé (16 juillet 2026) : adresse texte fiable ("Centre-ville")
    // mais coordonnées GPS précises non re-vérifiées terrain, sensiblement
    // excentrées par rapport aux autres points "centre-ville" du même jeu de
    // données — à re-géocoder. Affiché comme position indicative tant que non
    // confirmé.
    gpsApproximatif: true,
    photo: "/images/landing/18-reseau-laboratoires.jpg",
    description: "Partenaire Bolamu. Analyses biologiques complètes : NFS, glycémie, bilan lipidique, PCR paludisme."
  },

  // ===== POINTE-NOIRE — CLINIQUES =====
  {
    id: 8,
    nom: "Clinique Louise Michel",
    type: "clinique",
    ville: "pnr",
    adresse: "Avenue Maréchal Lyautey, Pointe-Noire",
    tel: "+242 06 622 11 47",
    horaires: "Lun–Sam 07h–20h | Urgences 24h/24",
    partenaire: true,
    lat: -4.78019,
    lng: 11.85619,
    photo: "/images/landing/59-clinique-louise-michel.jpg",
    description: "Clinique partenaire Bolamu. Médecine générale, maternité, chirurgie. Urgences 24h/24."
  },
  {
    id: 9,
    nom: "Clinique Netcare (CMC Médico)",
    type: "clinique",
    ville: "pnr",
    adresse: "Avenue du Dr Moé-Poaty, Centre-ville, Pointe-Noire",
    tel: "+242 22 294 00 00",
    horaires: "Lun–Sam 07h–19h",
    partenaire: false,
    lat: -4.79374,
    lng: 11.84892,
    photo: "/images/landing/63-netcare.jpg",
    description: "Cabinets de consultations en médecine générale et spécialistes : dentiste, pédiatre."
  },

  // ===== POINTE-NOIRE — PHARMACIES =====
  {
    id: 10,
    nom: "Pharmacie Maria",
    type: "pharmacie",
    ville: "pnr",
    adresse: "Pointe-Noire, République du Congo",
    tel: "+242 06 436 78 47",
    horaires: "Lun–Sam 07h30–20h | Dim 09h–13h",
    partenaire: true,
    lat: -4.79714,
    lng: 11.84011,
    photo: "/images/landing/62-mavre-pnr.jpg",
    description: "Pharmacie partenaire Bolamu. Médicaments essentiels OMS disponibles."
  },
  {
    id: 11,
    nom: "Pharmacie Croix du Sud",
    type: "pharmacie",
    ville: "pnr",
    adresse: "91 Avenue Charles-de-Gaulle, Pointe-Noire",
    tel: "+242 05 541 74 29",
    horaires: "Lun–Sam 07h30–20h",
    partenaire: false,
    lat: -4.79499,
    lng: 11.85467,
    photo: "/images/landing/61-croix-du-sud.jpg",
    description: "Pharmacie généraliste, avenue Charles de Gaulle, quartier Losange."
  }
];
