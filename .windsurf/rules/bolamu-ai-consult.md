# BOLAMU — AI Consult Amina (Sprint 9)
**Date :** 20 mai 2026

---

## SCHÉMA TABLES

### pre_rdv_formulaires
Formulaires pré-RDV avec symptômes et triage.

```sql
CREATE TABLE pre_rdv_formulaires (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id),
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  symptomes TEXT[] DEFAULT '{}',
  symptomes_libres TEXT,
  duree_symptomes VARCHAR(50),
  intensite INTEGER CHECK (intensite BETWEEN 1 AND 10),
  antecedents TEXT,
  medicaments_actuels TEXT,
  allergies TEXT,
  triage_couleur VARCHAR(10) DEFAULT 'vert' CHECK (triage_couleur IN 
    ('vert','orange','rouge')),
  triage_score INTEGER DEFAULT 0,
  triage_recommandation TEXT,
  ia_analyse TEXT,
  ia_questions_suggerees TEXT[],
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### ai_consult_sessions
Sessions IA Amina pour assistance patients.

```sql
CREATE TABLE ai_consult_sessions (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  session_type VARCHAR(20) DEFAULT 'symptomes' CHECK (session_type IN (
    'symptomes','suivi','information','renouvellement'
  )),
  messages JSONB DEFAULT '[]',
  triage_final VARCHAR(10),
  recommandation_finale TEXT,
  rdv_suggere BOOLEAN DEFAULT false,
  renouvellement_suggere BOOLEAN DEFAULT false,
  tokens_utilises INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### renouvellement_demandes
Demandes de renouvellement d'ordonnances.

```sql
CREATE TABLE renouvellement_demandes (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  prescription_id INTEGER NOT NULL,
  session_id_amina INTEGER REFERENCES ai_consult_sessions(id),
  statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente','valide','refuse'
  )),
  motif_refus TEXT,
  doctor_phone VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ALGORITHME FEU TRICOLORE

### calculerTriage(symptomes, intensite, duree_symptomes, antecedents)

**ROUGE (urgence — score >= 7)** — symptômes critiques :
- douleur thoracique
- difficulté respiratoire
- perte de conscience
- paralysie
- convulsions
- saignement abondant
- traumatisme crânien
- douleur abdominale sévère
- fièvre > 40°C

→ recommandation : "Consultez les urgences immédiatement"
→ notify patient avec priorité maximale

**ORANGE (semi-urgent — score 4-6)** — symptômes modérés :
- fièvre 38-40°C
- douleur modérée
- vomissements
- diarrhée persistante
- infection visible
- symptômes depuis > 3 jours

→ recommandation : "Consultez un médecin dans les 24-48h"

**VERT (non urgent — score 1-3)** :
→ recommandation : "Consultation de routine possible"

### Score calculé ainsi :
- Chaque symptôme rouge présent : +3 points
- Intensite >= 8 : +2 points
- Durée > 7 jours : +1 point
- Antécédents cardiaques/diabète/HTA : +1 point
- Score final → couleur triage

---

## SYSTEM PROMPT AMINA

```
Tu es Amina, l'assistante santé de Bolamu, la plateforme de santé du Congo-Brazzaville. Tu es bienveillante, professionnelle et tu parles français. Tu peux aussi utiliser quelques mots en Lingala pour mettre à l'aise les patients (mbote = bonjour, malamu = bien, tosanola = au revoir).

TON RÔLE :
- Aider les patients à décrire leurs symptômes avant un RDV
- Orienter vers le bon type de soin (urgences, médecin généraliste, spécialiste)
- Rappeler les rendez-vous et suivis
- Aider au renouvellement d'ordonnances simples

TU NE DOIS JAMAIS :
- Poser un diagnostic médical
- Prescrire des médicaments
- Remplacer l'avis d'un médecin
- Donner des informations sur des pathologies graves sans rediriger vers un professionnel

À CHAQUE RÉPONSE :
- Sois concise (max 3 phrases)
- Si symptômes graves détectés : rediriger IMMÉDIATEMENT vers les urgences ou un médecin
- Termine toujours par une question ouverte pour mieux cerner le besoin du patient

DISCLAIMER OBLIGATOIRE (ajouter en fin de session) :
'Je suis une assistante IA et non un médecin. Pour tout problème de santé sérieux, consultez toujours un professionnel de santé.'
```

---

## RÈGLES AMINA

- Max 300 tokens par réponse Amina
- Disclaimer médical obligatoire en fin de session
- Triage ROUGE = notify immédiat patient + médecin
- Triage ORANGE = notify médecin avec résumé
- Limite tokens par session : 2000
- Si tokens > 2000 : terminer session gracieusement
- Logger coût estimé dans audit_log

---

## COÛT ESTIMÉ ANTHROPIC

- Modèle : claude-sonnet-4-20250514
- Coût estimé : ~0.003 USD par consultation Amina
- Max tokens par session : 2000
- Max tokens par réponse : 300

---

## ROUTES API PRÉ-RDV

### Formulaire pré-RDV
- POST /api/v1/pre-rdv/:appointment_id → Soumettre formulaire (patient)
- GET /api/v1/pre-rdv/:appointment_id/patient → Récupérer son formulaire (patient)
- GET /api/v1/pre-rdv/:appointment_id/briefing → Briefing médecin (doctor)

### AI Consult Amina
- POST /api/v1/ai/session → Démarrer session (patient)
- POST /api/v1/ai/session/:session_id/message → Envoyer message (patient)
- GET /api/v1/ai/session/:session_id → Historique session (patient)

### Renouvellement assisté
- POST /api/v1/renouvellement → Demander renouvellement (patient)
- PATCH /api/v1/renouvellement/:id/valider → Valider (doctor)
- PATCH /api/v1/renouvellement/:id/refuser → Refuser (doctor)
- GET /api/v1/renouvellement → Liste demandes (patient/doctor)

---

## VARIABLES D'ENVIRONNEMENT

```
ANTHROPIC_API_KEY=
# Coût estimé : ~0.003 USD par consultation Amina
```

---

## RÈGLES SÉCURITÉ

- L'IA ne remplace JAMAIS un médecin — rôle d'orientation uniquement
- Amina : voix féminine, bilingue français/lingala
- Toutes les réponses IA incluent disclaimer médical obligatoire
- notify() après chaque action impactant un patient
- Transactions sur toutes les opérations critiques

---

## PERFORMANCE

- Index sur pre_rdv_formulaires(patient_phone)
- Index sur pre_rdv_formulaires(appointment_id)
- Index sur ai_consult_sessions(patient_phone)
- Index sur ai_consult_sessions(created_at DESC)
- Index sur renouvellement_demandes(patient_phone)
- Index sur renouvellement_demandes(statut)

---

**Statut :** ✅ PRÊT POUR UTILISATION  
**Dernière mise à jour :** 20 mai 2026
