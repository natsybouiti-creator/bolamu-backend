# BOLAMU — FRONTEND AUDIT
Généré : 27 mai 2026
Objectif : Audit complet des dashboards frontend vs modules backend

---

## DASHBOARDS EXISTANTS — CONTENU RÉEL

### public/admin/dashboard.html
**Rôle : admin**

#### Onglets/Sections/Menus
- **Vue générale**
  - Tableau de bord (overview)
  - Activité temps réel (activity)
- **Comptes**
  - En attente (pending)
  - Médecins (doctors)
  - Pharmacies (pharmacies)
  - Laboratoires (laboratories)
  - Patients (patients)
- **Plateforme**
  - Rendez-vous (appointments)
  - Ordonnances (prescriptions)
  - Paiements (payments)
  - Fraudes (fraud)
  - Journal d'audit (audit)
- **Paramètres**
  - Configuration (config)
  - Crédits (credits)
  - ⭐ Notations (ratings)

#### Appels API vers /api/v1/
- Utilise une fonction wrapper `api(path)` qui appelle l'API
- Endpoints appelés via `api()` (déduits des fonctions loadPanel):
  - `/admin/stats`
  - `/admin/pending`
  - `/admin/doctors`
  - `/admin/pharmacies`
  - `/admin/laboratories`
  - `/admin/patients`
  - `/admin/appointments`
  - `/admin/prescriptions`
  - `/admin/payments`
  - `/admin/fraud`
  - `/admin/audit`
  - `/admin/config`
  - `/admin/credits`
  - `/admin/ratings`

#### Fonctions JavaScript principales
- **Navigation** : `toggleSB()`, `closeSB()`, `go()`, `loadPanel()`, `refreshAll()`, `refreshPanel()`
- **Utils** : `sleep()`, `fetchTO()`, `api()`, `fd()`, `fs()`, `fn()`, `kpi()`, `badge()`, `toast()`, `filterTbl()`, `openModal()`, `closeModal()`, `logout()`
- **Chargement données** : `loadOverview()`, `loadActivity()`, `loadPending()`, `loadDoctors()`, `loadPharmacies()`, `loadLabos()`, `loadPatients()`, `loadAppts()`, `loadPresc()`, `loadPayments()`, `loadFraud()`, `loadAudit()`, `loadConfig()`, `loadCredits()`, `loadRatings()`
- **Actions admin** : `validateUser()`, `approveDoctor()`, `approvePharmacy()`, `approveLabo()`, `suspendUser()`, `activateUser()`, `banUser()`, `unbanUser()`, `deleteFraud()`, `resolveFraud()`, `updateConfig()`, `creditPartner()`, `debitPartner()`
- **Documents** : `getDocumentsHtml()`

---

### public/admin/content.html
**Rôle : content_admin**

#### Onglets/Sections/Menus
- **Contenu**
  - Articles & Blog (articles)
- **Page d'accueil**
  - Vitrine & Hero (vitrine)
  - Offres & Tarifs (plans)
  - Textes du site (textes)
  - Réseaux sociaux (reseaux)

#### Appels API vers /api/v1/
- `/api/v1/articles/admin/upload-vitrine` (POST)
- Endpoints appelés via `api()` :
  - `/articles/*`
  - `/content/*`

#### Fonctions JavaScript principales
- **Navigation** : `toggleSidebar()`, `closeSidebar()`, `showPanel()`, `loadPanel()`, `refreshAll()`
- **Utils** : `sleep()`, `fetchTO()`, `api()`, `showToast()`, `showModal()`, `closeModal()`, `logout()`, `spinnerHTML()`
- **Articles** : `loadArticles()`, `filterArticlesAdmin()`, `renderArticlesAdmin()`, `togglePub()`, `confirmDeleteArticle()`, `deleteArticle()`, `openArticleModal()`, `previewArtImg()`, `artFmt()`, `closeArticleModal()`, `saveArticle()`
- **Vitrine** : `loadVitrine()`, `vitPreview()`, `uploadVitrineImage()`, `saveVitrine()`
- **Plans** : `loadPlans()`, `savePlans()`
- **Textes** : `loadTextes()`, `saveTexte()`
- **Réseaux** : `loadReseaux()`, `saveReseaux()`
- **Boot banner** : `setBootBanner()`, `hideBootBanner()`

---

### public/medecin/dashboard.html
**Rôle : doctor**

#### Onglets/Sections/Menus
- **Desktop tabs**
  - 🏠 Tableau de bord (accueil)
  - 📅 Mes RDV (rdv)
  - 👥 Mes patients (patients)
  - 📹 Téléconsultation (telemedicine)
  - 👤 Mon profil (profil)
- **Mobile bottom nav**
  - Accueil, RDV, Vidéo, Patients, Profil

#### Appels API vers /api/v1/
- `/api/v1/doctors/profil?phone={phone}` (GET)
- `/api/v1/doctors/change-password` (POST)
- `/api/v1/appointments/doctor/{phone}` (GET)
- `/api/v1/appointments/{rdvId}/open` (POST)
- `/api/v1/reports/submit` (POST)
- `/api/v1/appointments/{rdvId}/validate` (POST)
- `/api/v1/prescriptions/create` (POST)
- `/api/v1/appointments/doctor/{phone}` (GET - pour téléconsultation)
- `/api/v1/telemedicine/start` (POST)
- `/api/v1/lab/prescribe` (POST)
- `/api/v1/auth/profile` (GET)
- `/api/v1/map/position` (PATCH)
- `/api/v1/patients/constantes/{phone}` (GET)
- `/api/v1/doctors/constantes-patient` (PATCH)

#### Fonctions JavaScript principales
- **Navigation** : `showTab()`, `showTabMobile()`
- **Profil** : `generateMedCode()`, `loadProfil()`, `pwdFormHtml()`, `submitChangePwd()`, `renderHoraires()`
- **RDV** : `loadRdv()`, `renderRdvList()`, `ouvrirValidation()`, `afficherEtapeCode()`, `nextBox()`, `prevBox()`, `verifierCode()`
- **Consultation** : `afficherEtapeCompteRendu()`, `soumettreCompteRendu()`, `afficherEtapeOrdonnance()`, `confirmerValidation()`, `fermerModal()`
- **Téléconsultation** : `loadTeleRdv()`, `demarrerTeleconsultation()`, `ouvrirJitsi()`, `initJaas()`, `closeJitsi()`, `onJitsiIFrameLoad()`
- **Labo** : `ouvrirModalLabo()`, `fermerModalLabo()`, `prescrireLabo()`
- **Constantes** : `ouvrirModalConstantes()`, `chargerConstantesPatient()`, `sauverConstantesPatient()`, `fermerModalConstantes()`
- **Géolocalisation** : `initGeolocation()`, `updatePosition()`
- **Logout** : `logout()`

---

### public/patient/dashboard.html
**Rôle : patient**

#### Onglets/Sections/Menus
- **Desktop tabs**
  - 🏠 Accueil (accueil)
  - 👨‍⚕️ Médecins (medecins)
  - 📋 Dossier médical (dossier)
  - 🗺️ Partenaires (carte)
  - 🪙 Mes Crédits (credits)
  - 👤 Mon profil (profil)
- **Mobile bottom nav**
  - Accueil, Médecins, Dossier, Carte, Crédits, Profil

#### Appels API vers /api/v1/
- `/api/v1/qr/generate` (GET)
- `/api/v1/payments/momo/request` (POST)
- `/api/v1/payments/momo/status/{referenceId}` (GET)
- `/api/v1/credits/balance` (GET)
- `/api/v1/credits/spend` (POST)
- `/api/v1/appointments/slots/{doctorId}?date={date}` (GET)
- `/api/v1/appointments/book` (POST)
- `/api/v1/appointments/patient/{phone}` (GET)
- `/api/v1/reports/patient/{phone}/timeline` (GET)
- `/api/v1/reports/access-log/{phone}` (GET)
- `/api/v1/qr/emergency/generate` (GET)
- `/api/v1/patients/profil?phone={phone}` (GET)
- `/api/v1/ratings/pending/{phone}` (GET)
- `/api/v1/ratings/submit` (POST)
- `/api/v1/patients/change-password` (POST)
- `/api/v1/patients/subscription?phone={phone}` (GET)
- `/api/v1/doctors/list` (GET - avec filtres)
- `/api/v1/map/intervenants` (GET)
- `/api/v1/patients/constantes/{phone}` (GET)
- `/api/v1/patients/constantes` (PATCH)

#### Fonctions JavaScript principales
- **Navigation** : `showTab()`, `showTabMobile()`
- **QR Code** : `generateCode()`, `initQR()`, `refreshQR()`
- **Paiements** : `handleRdv()`, `openPayment()`, `closePayment()`, `renderPlanSelect()`, `selectPlan()`, `initiatePayment()`, `showPaymentPending()`, `startPaymentCheck()`, `checkPaymentNow()`, `checkPaymentStatus()`, `showPaymentSuccess()`, `showPaymentError()`
- **Crédits** : `loadCredits()`, `openSpend()`, `updateDiscount()`, `confirmSpend()`
- **RDV** : `prendreRdv()`, `closeModal()`, `closeSuccess()`, `loadSlots()`, `selectSlot()`, `confirmerRdv()`, `loadRdv()`
- **Dossier médical** : `loadTimeline()`, `loadConstantes()`, `genererQRUrgence()`, `loadAccessLog()`
- **Profil** : `loadProfil()`, `checkPendingRatings()`, `openRatingModal()`, `submitRating()`, `submitChangePwd()`
- **Abonnement** : `loadSubscription()`
- **Médecins** : `loadDoctors()`, `filterDoctors()`
- **Carte** : `loadCarte()`, `filterMap()`, `initMap()`
- **Constantes** : `openConstantesModal()`, `saveConstantes()`, `editConstantes()`, `closeConstantesModal()`
- **Logout** : `logout()`

---

## DASHBOARDS MANQUANTS

### public/pharmacie/dashboard.html
**Rôle : pharmacie**
- **Statut backend** : Routes existantes dans `pharmacie.routes.js` (/api/v1/pharmacies)
- **Statut frontend** : ❌ ABSENT
- **Fonctionnalités attendues** :
  - Profil pharmacie
  - Géolocalisation
  - Liste des ordonnances à délivrer
  - Scan QR code tiers payant
  - Historique des délivrances
  - Changement mot de passe

### public/laboratoire/dashboard.html
**Rôle : laboratoire**
- **Statut backend** : Routes existantes dans `laboratoire.routes.js` (/api/v1/laboratories)
- **Statut frontend** : ❌ ABSENT
- **Fonctionnalités attendues** :
  - Profil laboratoire
  - Géolocalisation
  - Liste des prescriptions labo
  - Dépôt des résultats
  - Historique des analyses
  - Changement mot de passe

### public/secretariat/dashboard.html
**Rôle : secretaire**
- **Statut backend** : Routes existantes dans `secretariat.routes.js` (/api/v1/secretariat)
- **Statut frontend** : ❌ ABSENT
- **Fonctionnalités attendues** :
  - Gestion file d'attente
  - Agenda médecin
  - Prise de RDV au nom du médecin
  - Validation patients

---

## MODULES MANQUANTS PAR DASHBOARD

### public/admin/dashboard.html
**Modules backend créés mais absents du frontend** :
- `/api/v1/collecte/*` — Système collecte 4 canaux (OVP, MoMo annuel, Familial, SEPA diaspora)
- `/api/v1/admin/conventions/*` — Gestion conventions partenaires
- `/api/v1/tiers-payant/*` — Transactions tiers payant
- `/api/v1/conflicts/*` — Gestion conflits
- `/api/v1/coupons/*` — Gestion coupons
- `/api/v1/notifications/*` — Notifications système
- `/api/v1/secretariat/*` — Secrétariat
- `/api/v1/pre-rdv/*` — Formulaire pré-RDV

**Modules partiellement intégrés** :
- `/api/v1/payouts/*` — Versements partenaires (backend existe, frontend limité)
- `/api/v1/bank-transfer/*` — Virements bancaires (backend existe, frontend absent)
- `/api/v1/clearing/*` — Clearing mensuel (backend existe, frontend absent)

### public/medecin/dashboard.html
**Modules backend créés mais absents du frontend** :
- `/api/v1/conflicts/*` — Gestion conflits avec patients
- `/api/v1/coupons/*` — Attribution coupons patients
- `/api/v1/secretariat/*` — Délégation secrétariat
- `/api/v1/pre-rdv/*` — Formulaire pré-consultation

### public/patient/dashboard.html
**Modules backend créés mais absents du frontend** :
- `/api/v1/collecte/*` — Système collecte 4 canaux (OVP, MoMo annuel, Familial, SEPA diaspora)
- `/api/v1/conflicts/*` — Signalement conflits
- `/api/v1/coupons/*` — Utilisation coupons
- `/api/v1/pre-rdv/*` — Formulaire pré-RDV

### public/admin/content.html
**Modules backend créés mais absents du frontend** :
- Aucun — ce dashboard est spécifiquement dédié au contenu éditorial et semble complet pour sa fonction

---

## RECOMMANDATION ORDRE DE DÉVELOPPEMENT

### PRIORITÉ CRITIQUE — Impact business immédiat

#### 1. public/pharmacie/dashboard.html
**Justification** :
- Les pharmacies sont des partenaires essentiels du système Health Streaming
- Elles doivent pouvoir délivrer les ordonnances et gérer le tiers payant
- Le backend est complet et prêt
- Impact direct sur l'expérience patient

**Fonctionnalités à implémenter** :
- Profil pharmacie avec géolocalisation
- Liste des ordonnances en attente de délivrance
- Scan QR code pour authentification tiers payant
- Historique des délivrances
- Changement mot de passe

#### 2. public/laboratoire/dashboard.html
**Justification** :
- Les laboratoires sont des partenaires essentiels
- Ils doivent pouvoir recevoir les prescriptions labo et déposer les résultats
- Le backend est complet et prêt
- Impact direct sur le dossier médical patient

**Fonctionnalités à implémenter** :
- Profil laboratoire avec géolocalisation
- Liste des prescriptions labo en attente
- Interface dépôt résultats (upload Cloudinary)
- Historique des analyses
- Changement mot de passe

### PRIORITÉ HAUTE — Amélioration expérience utilisateur

#### 3. Module collecte 4 canaux dans admin/dashboard.html
**Justification** :
- Système critique pour la monétisation
- Permet d'élargir la base d'adhérents (diaspora, non bancarisés, entreprises)
- Backend complet et déployé
- Impact business majeur

**Fonctionnalités à implémenter** :
- Onglet "Collecte" dans sidebar admin
- Dashboard consolidé 4 canaux
- Validation OVP et SEPA
- Gestion bénéficiaires familiaux
- Export CSV Ecobank

#### 4. Module tiers payant dans admin/dashboard.html
**Justification** :
- Déjà implémenté et testé en production
- Nécessite une interface admin pour suivi
- Impact sur la trésorerie partenaires

**Fonctionnalités à implémenter** :
- Onglet "Tiers payant" dans sidebar admin
- Liste des transactions
- Validation et réconciliation

### PRIORITÉ MOYENNE — Fonctionnalités avancées

#### 5. Module conventions partenaires dans admin/dashboard.html
**Justification** :
- Permet de gérer les conventions et taux de remise
- Backend complet avec 3 conventions actives en base
- Améliore la flexibilité du système

**Fonctionnalités à implémenter** :
- Onglet "Conventions" dans sidebar admin
- CRUD conventions
- Gestion des taux par partenaire

#### 6. Module conflits dans medecin/dashboard.html et patient/dashboard.html
**Justification** :
- Système de résolution de conflits
- Améliore la satisfaction utilisateur
- Backend complet

**Fonctionnalités à implémenter** :
- Signalement conflits depuis dashboard patient
- Gestion et résolution depuis dashboard médecin
- Historique des conflits

#### 7. Module secrétariat
**Justification** :
- Permet la délégation de tâches administratives aux médecins
- Améliore l'efficacité des médecins
- Backend complet

**Fonctionnalités à implémenter** :
- Dashboard secrétariat complet
- Gestion file d'attente
- Prise de RDV déléguée
- Agenda médecin

### PRIORITÉ FAIBLE — Fonctionnalités secondaires

#### 8. Module coupons
**Justification** :
- Outil marketing pour acquisition
- Backend complet
- Impact business indirect

**Fonctionnalités à implémenter** :
- Gestion coupons dans admin
- Attribution coupons par médecin
- Utilisation coupons par patient

#### 9. Module pré-RDV
**Justification** :
- Améliore la qualité des consultations
- Permet de collecter des infos avant la consultation
- Backend complet

**Fonctionnalités à implémenter** :
- Formulaire pré-RDV pour patient
- Visualisation pour médecin
- Intégration dans flux consultation

#### 10. Module notifications
**Justification** :
- Améliore l'engagement utilisateur
- Backend complet mais VAPID keys optionnelles
- Dépend de configuration infrastructure

**Fonctionnalités à implémenter** :
- Interface gestion notifications dans admin
- Centre de notifications patient/médecin
- Configuration préférences utilisateur

---

## SYNTHÈSE

### Dashboards existants : 4/7
- ✅ public/admin/dashboard.html
- ✅ public/admin/content.html
- ✅ public/medecin/dashboard.html
- ✅ public/patient/dashboard.html
- ❌ public/pharmacie/dashboard.html
- ❌ public/laboratoire/dashboard.html
- ❌ public/secretariat/dashboard.html

### Couverture fonctionnelle
- **Admin** : ~70% (manque collecte, conventions, tiers payant, conflits, coupons, notifications, secrétariat, pre-rdv)
- **Content Admin** : ~95% (spécifique et complet)
- **Médecin** : ~80% (manque conflits, coupons, secrétariat, pre-rdv)
- **Patient** : ~75% (manque collecte, conflits, coupons, pre-rdv)
- **Pharmacie** : 0% (dashboard absent)
- **Laboratoire** : 0% (dashboard absent)
- **Secrétariat** : 0% (dashboard absent)

### Recommandation globale
Prioriser les dashboards partenaires (pharmacie et laboratoire) car ils sont critiques pour le fonctionnement du système Health Streaming. Ensuite, intégrer les modules financiers (collecte, tiers payant) dans l'admin pour maximiser le revenu. Enfin, ajouter les fonctionnalités avancées (conflits, secrétariat, coupons) pour améliorer l'expérience utilisateur.

---

**Fin de l'audit frontend — 27 mai 2026**
