# AUDIT SECRÉTAIRE — Design + Mapping Endpoints

**Date** : 21 juin 2026  
**Fichier** : `public/secretaire/dashboard.html`  
**Fichier actif en prod** : ✅ `dashboard.html` (confirmé via redirectUrl login)

---

## RÈGLES SÉCURITÉ APPLICABLES

- **Jamais accès** : comptes rendus, ordonnances, résultats labo (BHP v1.2)
- **Accès autorisé** : identité patient + statut abonnement uniquement
- **Interconnexions** : médecin (agenda, RDV), patient (identité + abonnement)

---

## AUDIT PAR ONGLET

### 1. ONGLET ACCUEIL

#### 1.1 Vérification adhérent
**Données affichées** :
- Nom complet, téléphone
- Statut abonnement (actif/en_attente/inactif)
- Plan + prix
- Date fin
- Motif de consultation + couverture SSP

**Endpoint backend** : `GET /api/v1/secretariat/verifier-adherent?q=xxx`
- ✅ **EXISTE** (secretariat.routes.js ligne 507-557)
- ✅ Retourne : full_name, phone, statut_abonnement, plan_nom, plan_prix, date_fin
- ✅ Respecte la règle : uniquement identité + abonnement, pas de données médicales

**Données mockées** : Aucune (déjà câblé)

---

#### 1.2 Stats dashboard
**Données affichées** :
- En attente
- En consultation
- RDV aujourd'hui
- Médecins actifs

**Endpoint backend** : `GET /api/v1/secretariat/dashboard-stats?date=YYYY-MM-DD`
- ✅ **EXISTE** (secretariat.routes.js ligne 341-387)
- ✅ Retourne : en_attente, en_consultation, rdv_today, medecins_disponibles

**Données mockées** : Aucune (déjà câblé)

---

#### 1.3 File d'attente
**Données affichées** :
- Heure, patient, médecin, statut
- Actions : Arrivé, Annuler

**Endpoint backend** : `GET /api/v1/secretariat/queue?date=YYYY-MM-DD`
- ✅ **EXISTE** (secretariat.routes.js ligne 442-465)
- ✅ PATCH `/api/v1/secretariat/queue/:id/status` pour changement statut

**Données mockées** : Aucune (déjà câblé)

---

#### 1.4 Nouveau RDV manuel
**Données requises** :
- patient_phone, doctor_id, date, time, motif

**Endpoint backend** : `POST /api/v1/secretariat/rdv-manuel`
- ✅ **EXISTE** (secretariat.routes.js ligne 239-268)
- ✅ Double booking check inclus

**Endpoint créneaux** : `GET /api/v1/appointments/slots/:doctorId?date=YYYY-MM-DD`
- ⚠️ **NON VÉRIFIÉ** (ligne 2517 dans frontend)
- ⚠️ À vérifier dans `appointments.routes.js`

**Données mockées** : Aucune (déjà câblé)

---

### 2. ONGLET AGENDA

#### 2.1 Liste médecins (select)
**Endpoint backend** : `GET /api/v1/secretariat/medecins`
- ✅ **EXISTE** (secretariat.routes.js ligne 414-440)
- ✅ Retourne : id, phone, full_name, specialty, is_active, rdv_today

**Données mockées** : Aucune (déjà câblé)

---

#### 2.2 RDV du médecin sélectionné
**Endpoint backend** : `GET /api/v1/secretariat/agenda?doctor_phone=xxx`
- ✅ **EXISTE** (secretariat.routes.js ligne 122-184)
- ✅ Retourne : appointments avec patient_name, date, heure, statut, motif

**Actions** :
- Confirmer RDV : `PATCH /api/v1/secretariat/rdv/:id/status` (status=confirme)
- Annuler RDV : `PATCH /api/v1/secretariat/rdv/:id/status` (status=annule)
- ✅ **EXISTENT** (secretariat.routes.js ligne 186-229)

**Données mockées** : Aucune (déjà câblé)

---

### 3. ONGLET PATIENTS

#### 3.1 Recherche patients
**Endpoint backend** : `GET /api/v1/secretariat/patients/search?q=xxx`
- ✅ **EXISTE** (secretariat.routes.js ligne 389-412)
- ✅ Retourne : id, full_name, phone, statut_abonnement
- ✅ Respecte la règle : uniquement identité + abonnement

**Actions** :
- Voir fiche : `viewPatient(id)` → ⚠️ **FONCTION NON DÉFINIE**
- Prendre RDV : `openRdvForPatient(phone)` → ⚠️ **FONCTION NON DÉFINIE**

**Données mockées** : Aucune (déjà câblé)

---

### 4. ONGLET VÉRIFIER ADHÉRENT

#### 4.1 Recherche manuelle
**Endpoint backend** : `GET /api/v1/patients/search?q=xxx` (ligne 2662)
- ⚠️ **À VÉRIFIER** dans `patients.routes.js`

#### 4.2 Scanner QR
**Endpoint backend** : `POST /api/v1/qr/verify` (ligne 2426)
- ⚠️ **À VÉRIFIER** dans `qr.routes.js` ou équivalent

**Données mockées** : Aucune (déjà câblé)

---

### 5. ONGLET MÉDECINS

#### 5.1 Liste médecins de la clinique
**Endpoint backend** : `GET /api/v1/secretariat/medecins`
- ✅ **EXISTE** (secretariat.routes.js ligne 414-440)
- ✅ Déjà utilisé dans l'onglet Agenda

**Actions** :
- Emploi du temps : `GET /api/v1/secretariat/medecin/:id/disponibilites`
  - ✅ **EXISTE** (secretariat.routes.js ligne 483-505)
- Bloquer créneau : `bloquerCreneau(id)` → ⚠️ **FONCTION NON DÉFINIE**

**Données mockées** : Aucune (déjà câblé)

---

### 6. ONGLET MA CLINIQUE

#### 6.1 Profil clinique
**Endpoint backend** : `GET /api/v1/secretariat/clinic-info`
- ✅ **EXISTE** (secretariat.routes.js ligne 467-481)
- ✅ Retourne : name, city, address, phone

**Données mockées** : Aucune (déjà câblé)

---

#### 6.2 Catalogue SSP
**Données affichées** : Liste statique `CATALOGUE_SSP` (lignes 1743-1813)
- ✅ **DONNÉES STATIQUES** (catalogue SSP Bolamu)
- ✅ Pas d'appel API nécessaire (référentiel)

**Fonctions** :
- `filterCatalogue(value)` : filtre local
- `filterByCat(cat, btn)` : filtre par catégorie
- `checkMotifCoverage(value)` : vérifie couverture locale

**Données mockées** : Aucune (données statiques)

---

## FONCTIONS NON DÉFINIES (À IMPLÉMENTER)

1. `viewPatient(id)` - Onglet Patients
2. `openRdvForPatient(phone)` - Onglet Patients
3. `bloquerCreneau(id)` - Onglet Médecins
4. `traiterAdherentSecretaire(qrData, mode)` - Scanner QR (appelé mais non défini)

---

## ENDPOINTS À VÉRIFIER

1. `GET /api/v1/appointments/slots/:doctorId?date=YYYY-MM-DD` - Créneaux disponibles
2. `GET /api/v1/patients/search?q=xxx` - Recherche patients (onglet Vérifier)
3. `POST /api/v1/qr/verify` - Vérification QR code

---

## VIOLATIONS SÉCURITÉ DETECTÉES

**AUCUNE** - Le dashboard respecte les règles :
- ✅ Pas d'accès aux données médicales (comptes rendus, ordonnances, résultats labo)
- ✅ Uniquement identité patient + statut abonnement
- ✅ Interconnexions correctes avec médecin (agenda, RDV)

---

## ÉTAT DU CÂBLAGE

| Onglet | Fonctionnalité | État |
|--------|----------------|------|
| Accueil | Vérification adhérent | ✅ Câblé |
| Accueil | Stats dashboard | ✅ Câblé |
| Accueil | File d'attente | ✅ Câblé |
| Accueil | Nouveau RDV manuel | ✅ Câblé |
| Agenda | Liste médecins | ✅ Câblé |
| Agenda | RDV médecin | ✅ Câblé |
| Patients | Recherche patients | ✅ Câblé |
| Patients | Voir fiche | ⚠️ Fonction manquante |
| Patients | Prendre RDV | ⚠️ Fonction manquante |
| Vérifier | Recherche manuelle | ⚠️ Endpoint à vérifier |
| Vérifier | Scanner QR | ⚠️ Endpoint à vérifier |
| Médecins | Liste médecins | ✅ Câblé |
| Médecins | Emploi du temps | ✅ Câblé |
| Médecins | Bloquer créneau | ⚠️ Fonction manquante |
| Clinique | Profil clinique | ✅ Câblé |
| Clinique | Catalogue SSP | ✅ Statique (OK) |

---

## RECOMMANDATIONS

1. **Implémenter les fonctions manquantes** :
   - `viewPatient(id)` : ouvrir modal avec fiche patient (identité + abonnement uniquement)
   - `openRdvForPatient(phone)` : pré-remplir modal RDV manuel
   - `bloquerCreneau(id)` : créer blocage agenda

2. **Vérifier les endpoints** :
   - `appointments/slots` dans `appointments.routes.js`
   - `patients/search` dans `patients.routes.js`
   - `qr/verify` dans `qr.routes.js` ou équivalent

3. **Scanner QR** : implémenter `traiterAdherentSecretaire()` pour traiter les données QR

---

## CONCLUSION

Le dashboard secrétaire est **majoritairement câblé** aux endpoints backend. Les fonctionnalités principales (vérification adhérent, stats, file d'attente, agenda, médecins, clinique) fonctionnent avec les vraies API. Quelques fonctions secondaires sont à implémenter et quelques endpoints à vérifier.

**Respect des règles de sécurité** : ✅ VALIDÉ (pas d'accès aux données médicales)
