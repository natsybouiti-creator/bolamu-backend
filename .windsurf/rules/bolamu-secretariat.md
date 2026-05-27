# BOLAMU — Dashboard Secrétariat
**Sprint :** 8  
**Date :** 20 mai 2026

---

## SCHÉMA TABLES

### secretaires
Secrétaires associés aux partenaires (cliniques, médecins).

```sql
CREATE TABLE secretaires (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL REFERENCES users(phone),
  partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  partenaire_type VARCHAR(20) NOT NULL CHECK (partenaire_type IN ('clinic','doctor')),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### file_attente
File d'attente des patients pour consultations.

```sql
CREATE TABLE file_attente (
  id SERIAL PRIMARY KEY,
  partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  doctor_phone VARCHAR(20) REFERENCES users(phone),
  motif VARCHAR(255),
  priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN ('normale','urgente','critique')),
  statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_consultation','termine','annule')),
  numero_ordre INTEGER NOT NULL,
  heure_arrivee TIMESTAMP DEFAULT NOW(),
  heure_appel TIMESTAMP,
  heure_fin TIMESTAMP,
  notes TEXT,
  created_by VARCHAR(20) REFERENCES users(phone)
);
```

### agenda_blocs
Blocs agenda (disponibilités, pauses, congés) pour médecins.

```sql
CREATE TABLE agenda_blocs (
  id SERIAL PRIMARY KEY,
  doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  type VARCHAR(20) DEFAULT 'disponible' CHECK (type IN ('disponible','bloque','pause','conge')),
  motif_blocage VARCHAR(255),
  created_by VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## RÈGLES RBAC SECRÉTAIRE

- Toutes les routes secrétariat nécessitent `role = 'secretaire'`
- Un secrétaire ne peut accéder qu'aux données de son partenaire associé (`partenaire_phone`)
- Le middleware `secretaireOnly` vérifie le rôle et le partenaire_phone
- Les routes partenaires nécessitent `role IN ('doctor', 'pharmacy', 'laboratory')`

---

## LOGIQUE FILE D'ATTENTE

### numero_ordre
- Calculé avec `MAX(numero_ordre) + 1` pour le partenaire aujourd'hui
- Réinitialisé chaque jour (DATE(heure_arrivee) = CURRENT_DATE)

### priorite
- `normale` : Priorité standard
- `urgente` : Priorité haute (traite avant normale)
- `critique` : Priorité maximale (traite avant urgente)

### statuts
- `en_attente` : Patient en file d'attente
- `en_consultation` : Patient appelé, en consultation
- `termine` : Consultation terminée
- `annule` : RDV annulé

### Tri
- Par priorité DESC (critique > urgente > normale)
- Par numero_ordre ASC (ordre d'arrivée)

---

## LOGIQUE AGENDA

### blocs agenda
- `disponible` : Créneau disponible pour RDV
- `bloque` : Créneau bloqué (conflit, maintenance)
- `pause` : Pause médecin
- `conge` : Congé médecin

### Vérification conflits
- Avant de bloquer un créneau : vérifier pas de RDV existants
- Si conflit : throw Error avec liste des RDV impactés
- Soft delete sur RDV (is_active = false) pour annulation

### Timeline agenda
- Format : heure par heure 8h-20h
- Pour chaque heure : type (disponible/bloque/rdv) + motif

---

## ROUTES API SECRÉTIAT

### File d'attente
- `POST /api/v1/secretariat/file-attente` — Ajouter patient en file
- `GET /api/v1/secretariat/file-attente` — Liste file du jour
- `PATCH /api/v1/secretariat/file-attente/:id/appeler` — Appeler patient
- `PATCH /api/v1/secretariat/file-attente/:id/terminer` — Terminer consultation

### Agenda
- `POST /api/v1/secretariat/agenda/bloquer` — Bloquer créneau
- `GET /api/v1/secretariat/agenda/:doctor_phone/:date` — Agenda du jour

### RDV
- `DELETE /api/v1/secretariat/rdv/:id` — Soft delete RDV avec motif

### Stats
- `GET /api/v1/secretariat/stats` — Stats dashboard secrétariat

---

## ROUTES API PARTENAIRE (GESTION SECRÉTAIRES)

- `POST /api/v1/partner/secretaires` — Créer compte secrétaire (partenaire uniquement)
- `GET /api/v1/partner/secretaires` — Lister secrétaires du partenaire
- `PATCH /api/v1/partner/secretaires/:phone/toggle` — Activer/désactiver secrétaire (soft)

---

## notify() OBLIGATOIRE

Toutes les actions impactant un patient doivent déclencher notify() :

- Ajout file d'attente → notify(patient_phone, 'message_recu', { message: "Vous êtes en file d'attente, position N" })
- Appel patient → notify(patient_phone, 'message_recu', { message: "C'est votre tour" })
- Terminer consultation → notify(patient_phone, 'message_recu', { message: "Consultation terminée" })
- Annuler RDV → notify(patient_phone, 'rdv_annule', { motif }) + notify(doctor_phone, 'rdv_annule', { motif })

---

## RÈGLES TRANSACTIONS

- Toutes les opérations critiques dans une transaction (BEGIN/COMMIT/ROLLBACK)
- Audit log insert-only dans chaque transaction
- Soft delete uniquement (is_active = false)
- Jamais de DELETE sur users ou secretaires

---

## SÉCURITÉ

- Mot de passe temporaire généré avec crypto.randomBytes(8)
- Hash bcrypt sur tous les mots de passe
- Max 3 secrétaires actifs par partenaire
- RBAC strict sur toutes les routes
- Audit log sur toutes les actions sensibles

---

## PERFORMANCE

- Index sur secretaires(partenaire_phone)
- Index sur file_attente(partenaire_phone, statut)
- Index sur file_attente(heure_arrivee)
- Index sur agenda_blocs(doctor_phone, date)
- Tri optimisé par priorité + numero_ordre

---

## MONITORING

- Audit log sur toutes les actions secrétariat
- Winston logger pour toutes les erreurs
- Temps d'attente calculé côté serveur
- Stats dashboard en temps réel

---

**Statut :** ✅ PRÊT POUR UTILISATION  
**Dernière mise à jour :** 20 mai 2026
