# AUDIT COMPLET DASHBOARD PATIENT

**Date**: 17 juin 2026  
**Fichier audité**: `public/patient/dashboard.html`  
**Objectif**: Brief technique pour refonte visuelle complète

---

## 1. STRUCTURE GÉNÉRALE

### Tabs / Sections
Le dashboard comporte **7 tabs** principaux accessibles via navigation desktop et mobile :

| Ordre | Nom Tab | ID HTML Panel | ID Tab Desktop | ID Tab Mobile |
|-------|---------|---------------|----------------|---------------|
| 1 | Accueil | `panel-accueil` | `tab-accueil` | `bnav-accueil` |
| 2 | Médecins | `panel-medecins` | `tab-medecins` | `bnav-medecins` |
| 3 | Dossier médical | `panel-dossier` | `tab-dossier` | `bnav-dossier` |
| 4 | Partenaires (Carte) | `panel-carte` | `tab-carte` | `bnav-carte` |
| 5 | Crédits | `panel-credits` | `tab-credits` | `bnav-credits` |
| 6 | Conflits | `panel-conflits` | `tab-conflits` | `bnav-conflits` |
| 7 | Profil | `panel-profil` | `tab-profil` | `bnav-profil` |

### Mécanisme de navigation
- **Classes CSS** : Les panels utilisent la classe `.panel` avec la classe `.active` pour afficher le panel actif
- **Navigation desktop** : Barre horizontale avec classe `.tab` + `.active`
- **Navigation mobile** : Barre inférieure avec classe `.bnav-item` + `.active`
- **Fonctions JS** : `showTab(name, btn)` pour desktop, `showTabMobile(name, btn)` pour mobile
- **Masquage** : Tous les panels sont masqués par défaut (`display: none`), seul le panel avec `.active` est visible

---

## 2. AUTHENTIFICATION & SESSION

### Clés localStorage
- **Token** : `bolamu_patient_token`
- **Phone** : `bolamu_patient_phone`

### Lecture au chargement
```javascript
const phone = localStorage.getItem('bolamu_patient_phone') || '+242060000001';
```

### Logique de redirection
- **Pas de redirection automatique** si token absent au chargement
- **Redirection sur banned** : Dans `loadProfil()`, si `d.banned === true`, redirection vers `/login.html?reason=banned` avec `localStorage.clear()`

### Endpoint de vérification de session
- **Aucun endpoint explicite** de vérification de session
- La vérification se fait implicitement via les appels API protégés par `authMiddleware` qui retournent 401 si token invalide

---

## 3. INVENTAIRE COMPLET DES FONCTIONS JS

### Fonctions globales et utilitaires

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `generateCode(p)` | Génère un code membre BLM à partir du numéro de téléphone | Aucun | Aucun | Entrée: phone (string) → Sortie: code membre (string) |
| `initQR()` | Initialise et affiche le QR code du patient | `qr-container`, `qr-countdown`, `btn-refresh-qr` | `GET /api/v1/qr/generate` | Reçoit: `{ qr_url, expires_at }` |
| `showTab(name, btn)` | Affiche le panel spécifié (desktop) | `panel-{name}`, tous les `.tab` | Aucun | Met à jour classes CSS `.active` |
| `showTabMobile(name, btn)` | Affiche le panel spécifié (mobile) | `panel-{name}`, tous les `.bnav-item` | Aucun | Met à jour classes CSS `.active` |
| `showAlert(msg, type)` | Affiche une alerte dans la boîte d'alerte | `alert-box` | Aucun | Affiche message avec classe `alert-{type}` |
| `logout()` | Déconnexion et redirection | Aucun | Aucun | Supprime `bolamu_patient_token` et `bolamu_patient_phone`, redirige vers `/` |
| `showToast(message, type)` | Affiche un toast temporaire | Crée élément temporaire | Aucun | Affiche toast 3 secondes puis supprime |
| `updateIntensityLabel(val)` | Met à jour le label d'intensité des symptômes | `intensity-label` | Aucun | Mappe valeur 1-10 vers label textuel |

### Fonctions Paiement MTN MoMo

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `openPayment(plan)` | Ouvre la modale de paiement | `modal-payment` | Aucun | Initialise `currentPlan` |
| `closePayment()` | Ferme la modale de paiement | `modal-payment` | Aucun | Arrête `paymentCheckInterval` |
| `renderPlanSelect()` | Affiche les plans d'abonnement | `payment-body` | Aucun | Génère HTML des plans Essentiel/Standard/Premium |
| `selectPlan(plan)` | Sélectionne un plan | `payment-body` | Aucun | Met à jour `currentPlan` et re-render |
| `initiatePayment()` | Initie le paiement MTN MoMo | `payment-body` | `POST /api/v1/payments/initiate` | Envoie: `{ amount, plan }` → Reçoit: `{ reference_id }` |
| `showPaymentPending()` | Affiche l'état d'attente de confirmation | `payment-body` | Aucun | Affiche countdown 30s |
| `startPaymentCheck()` | Démarre la vérification automatique | Aucun | `GET /api/v1/payments/momo/status/{reference_id}` | Vérifie statut toutes les 5s |
| `checkPaymentNow()` | Vérification manuelle du statut | Aucun | `GET /api/v1/payments/momo/status/{reference_id}` | Reçoit: `{ status }` |
| `checkPaymentStatus()` | Vérifie le statut du paiement | Aucun | `GET /api/v1/payments/momo/status/{reference_id}` | Reçoit: `{ status: 'SUCCESSFUL'\|'FAILED' }` |
| `showPaymentSuccess()` | Affiche le succès du paiement | `payment-body` | Aucun | Affiche message succès + crédits ajoutés |
| `showPaymentError(msg)` | Affiche l'erreur de paiement | `payment-body` | Aucun | Affiche message d'erreur |

### Fonctions Crédits

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadCredits()` | Charge le solde et historique des crédits | `cr-balance`, `cr-months`, `cr-earned`, `cr-spent`, `cr-partners-grid`, `cr-history` | `GET /api/v1/credits/balance` | Reçoit: `{ balance, consecutive_months, total_earned, total_spent, partners[], history[] }` |
| `openSpend(partnerId, partnerName, minCredits, discountPer100)` | Ouvre la modale de dépense | `modal-spend-body`, `modal-spend` | Aucun | Génère formulaire de dépense |
| `updateDiscount()` | Met à jour la remise calculée | `spend-discount` | Aucun | Calcule remise basée sur montant |
| `confirmSpend(partnerId, partnerName)` | Confirme la dépense de crédits | `modal-spend` | `POST /api/v1/credits/spend` | Envoie: `{ partner_id, amount }` → Reçoit: `{ discount_obtained, new_balance }` |

### Fonctions RDV / Appointments

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `prendreRdv(doctorId, doctorName)` | Ouvre la modale de prise de RDV | `modal-doctor-name`, `rdv-date`, `slots-container`, `btn-confirm-rdv`, `symptoms-motif`, `modal-rdv` | Aucun | Initialise variables de sélection |
| `closeModal()` | Ferme la modale RDV | `modal-rdv` | Aucun | Retire classe `.open` |
| `closeSuccess()` | Ferme la modale succès | `modal-success` | Aucun | Retire classe `.open` + recharge RDV |
| `loadSlots()` | Charge les créneaux disponibles | `slots-container` | `GET /api/v1/appointments/slots/{doctorId}?date={date}` | Reçoit: `{ slots[], pris[] }` |
| `selectSlot(time)` | Sélectionne un créneau horaire | Tous les `.slot-btn`, `btn-confirm-rdv` | Aucun | Met à jour `selectedTime` et UI |
| `confirmerRdv()` | Passe à l'étape de confirmation | `rdv-step-2` | Aucun | Vérifie abonnement actif |
| `toggleSymptom(tag)` | Toggle sélection symptôme | `.symptom-tag` | Aucun | Met à jour `selectedSymptoms[]` |
| `updateProgress(step)` | Met à jour la barre de progression | `step-{n}-circle`, `step-line-{n}` | Aucun | Met à jour classes CSS |
| `showStep(n)` | Affiche l'étape du wizard RDV | `rdv-step-1`, `rdv-step-2`, `rdv-step-3` | Aucun | Affiche/masque les étapes |
| `goToStep3()` | Passe à l'étape 3 avec validation | `symptoms-motif`, `recap-doctor-name`, `recap-datetime`, `recap-motif`, `recap-symptomes-section`, `recap-symptomes` | Aucun | Valide motif et affiche récap |
| `confirmerFinal()` | Confirme et crée le RDV | `btn-confirm-final` | `POST /api/v1/appointments/book` puis `POST /api/v1/appointments/{id}/symptoms` | Envoie: `{ patient_phone, doctor_id, date, time }` puis `{ motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient }` |
| `backToStep1()` | Retour à l'étape 1 | Aucun | Aucun | Appelle `showStep(1)` |
| `loadRdv()` | Charge la liste des RDV du patient | `rdv-list-accueil` | `GET /api/v1/appointments/patient/{phone}` | Reçoit: `{ appointments[] }` |

### Fonctions Dossier Médical

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadTimeline()` | Charge l'historique des consultations | `historique-list` | `GET /api/v1/reports/patient/{phone}/timeline` | Reçoit: `{ data[] }` avec motif, diagnostic, traitement, medications, resultats |
| `loadAccessLog()` | Charge l'historique des accès au dossier | `access-log-list` | `GET /api/v1/reports/access-log/{phone}` | Reçoit: `{ data[] }` avec accessed_by_role, access_type |
| `genererQRUrgence()` | Génère un QR code d'urgence | Crée `modal-qr-urgence`, `qr-urgence-container` | `GET /api/v1/qr/emergency/generate` | Reçoit: `{ emergency_url, expires_at }` |
| `fermerModalQRUrgence()` | Ferme la modale QR urgence | `modal-qr-urgence` | Aucun | Supprime l'élément DOM |
| `voirResultatLab(resultats, fichierUrl)` | Affiche les résultats labo dans une modale | Crée `modal-lab-resultats` | Aucun | Affiche résultats + bouton téléchargement |
| `fermerModalLabResultats()` | Ferme la modale résultats labo | `modal-lab-resultats` | Aucun | Supprime l'élément DOM |
| `loadConstantes()` | Charge les constantes médicales du patient | `dos-groupe-sanguin`, `dos-allergies`, `dos-maladies`, `dos-antecedents`, `dos-traitements`, `dos-poids`, `dos-taille`, `dos-contact-urgence`, `dos-constantes-source` | `GET /api/v1/patients/constantes/{phone}` | Reçoit: `{ groupe_sanguin, allergies, maladies_chroniques, antecedents_medicaux, traitements_en_cours, poids, taille, contact_urgence_nom, contact_urgence_phone, contact_urgence_lien, constantes_updated_at, constantes_remplies_par }` |
| `openEditConstantes()` | Ouvre la modale d'édition des constantes | `edit-groupe-sanguin`, `edit-allergies`, `edit-maladies`, `edit-antecedents`, `edit-traitements`, `edit-poids`, `edit-taille`, `edit-contact-nom`, `edit-contact-phone`, `edit-contact-lien`, `modal-constantes` | Aucun | Remplit les champs avec `_constantesData` |
| `closeEditConstantes()` | Ferme la modale d'édition | `modal-constantes` | Aucun | Masque la modale |
| `saveConstantes()` | Sauvegarde les constantes médicales | Tous les champs `edit-*` | `PATCH /api/v1/patients/constantes` | Envoie: `{ groupe_sanguin, allergies, maladies_chroniques, antecedents_medicaux, traitements_en_cours, poids, taille, contact_urgence_nom, contact_urgence_phone, contact_urgence_lien }` |

### Fonctions Profil

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadProfil()` | Charge les informations du profil | `profil-fullname`, `d-fullname`, `d-phone-profil`, `d-gender`, `d-city-profil`, `d-since-profil` | `GET /api/v1/patients/profil?phone={phone}` | Reçoit: `{ full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at, banned }` |
| `pwdFormHtml()` | Génère le HTML du formulaire de mot de passe | `pwd-form-container` | Aucun | Retourne HTML string |
| `submitChangePwd()` | Soumet le changement de mot de passe | `pwd-old`, `pwd-new`, `pwd-confirm` | `POST /api/v1/patients/change-password` | Envoie: `{ phone, old_password, new_password }` |

### Fonctions Abonnement

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadSubscription()` | Charge les infos d'abonnement | `card-plan`, `profil-plan-badge`, `stat-plan`, `stat-montant`, `stat-statut`, `stat-expiration`, `d-plan`, `d-montant`, `d-debut`, `d-fin`, `d-statut`, `dos-plan` | `GET /api/v1/patients/subscription?phone={phone}` | Reçoit: `{ plan, amount_fcfa, status, started_at, expires_at }` |

### Fonctions Médecins

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadDoctors()` | Charge la liste des médecins avec filtres | `filter-specialty`, `filter-city`, `doctors-grid`, `doctors-count`, `stat-doctors` | `GET /api/v1/doctors?specialty={sp}&city={ci}` | Reçoit: `{ doctors[], pagination: { total } }` |
| `handleRdv(doctorId, doctorName)` | Gère le clic sur bouton RDV | Aucun | Aucun | Appelle `prendreRdv()` si abonnement actif, sinon `openPayment()` |

### Fonctions Carte / Map

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadCarte()` | Charge la carte des intervenants | `map-container`, `map-list` | `GET /api/v1/map/intervenants` | Reçoit: `{ data[] }` avec type (doctor/pharmacie/laboratoire), latitude, longitude |
| `renderMapMarkers(intervenants)` | Affiche les marqueurs sur la carte | `map-container` (Leaflet) | Aucun | Utilise Leaflet.js pour afficher marqueurs |
| `renderMapList(intervenants)` | Affiche la liste des intervenants | `map-list` | Aucun | Génère HTML de la liste |
| `filterMap(type)` | Filtre les intervenants par type | `filter-all`, `filter-doctor`, `filter-pharmacie`, `filter-laboratoire` | Aucun | Filtre `allIntervenants` et re-render |

### Fonctions Conflits

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `loadConflits()` | Charge la liste des conflits du patient | `conflits-list` | `GET /api/v1/conflicts` | Reçoit: `{ data[] }` avec id, reference, sujet, statut, partner_type |
| `submitConflit()` | Soumet un nouveau conflit | `conflit-partner-type`, `conflit-partner-phone`, `conflit-subject`, `conflit-description`, `modal-nouveau-conflit` | `POST /api/v1/conflicts` | Envoie: `{ partner_type, partner_phone, subject, description }` → Reçoit: `{ data: { reference } }` |
| `openDetailConflit(id, ref, sujet)` | Ouvre le détail d'un conflit | `detail-conflit-ref`, `detail-conflit-sujet`, `detail-conflit-messages`, `modal-detail-conflit` | `GET /api/v1/conflicts/{id}` | Reçoit: `{ data: { messages[] } }` |
| `submitReplyConflit()` | Répond à un conflit | `conflit-reply` | `POST /api/v1/conflicts/{id}/messages` | Envoie: `{ message }` |

### Fonctions Notation / Ratings

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `checkPendingRatings()` | Vérifie les évaluations en attente | `rating-modal`, `rating-emoji`, `rating-title`, `rating-subtitle`, `rating-stars`, `rating-adjectives` | `GET /api/v1/ratings/pending/{phone}` | Reçoit: `{ data[], adjectives_positive[], adjectives_negative[] }` |
| `showNextRating()` | Affiche la prochaine évaluation à faire | `rating-modal`, `rating-emoji`, `rating-title`, `rating-subtitle`, `rating-stars`, `rating-adjectives` | Aucun | Met à jour UI avec prochaine évaluation |
| `selectStar(n)` | Sélectionne une note (étoile) | Tous les `.star-btn`, `rating-adjectives` | Aucun | Met à jour `selectedStar` et affiche adjectifs |
| `toggleAdj(adj)` | Toggle sélection d'adjectif | Élément avec `data-adj` | Aucun | Met à jour `selectedAdjectives[]` et UI |
| `submitRating()` | Soumet l'évaluation | Aucun | `POST /api/v1/ratings/submit` | Envoie: `{ patient_phone, intervenant_phone, intervenant_role, action_type, action_id, stars, adjectives }` |
| `skipRating()` | Passe l'évaluation actuelle | Aucun | Aucun | Appelle `showNextRating()` |

### Fonctions Jitsi / Téléconsultation

| Fonction | Description | IDs HTML manipulés | Endpoint API | Données envoyées/reçues |
|----------|-------------|-------------------|---------------|------------------------|
| `ouvrirJitsiPatient(rdvId, sessionCode)` | Ouvre la consultation vidéo | `jitsi-session-label`, `jitsi-code-display`, `modal-jitsi`, `jitsi-loading`, `jitsi-iframe`, `jaas-container` | Aucun | Charge Jitsi Meet External API dynamiquement |
| `initJaasPatient(roomName, displayName, container)` | Initialise Jitsi Meet | `jaas-container` | Aucun | Crée instance `JitsiMeetExternalAPI` |
| `closeJitsi()` | Ferme la consultation vidéo | `modal-jitsi`, `jitsi-iframe`, `jitsi-loading`, `jaas-container` | Aucun | Dispose API et nettoie DOM |

---

## 4. INVENTAIRE COMPLET DES ENDPOINTS API APPELÉS

### Authentification & Profil

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/patients/profil?phone={phone}` | `Authorization: Bearer {token}` | - | Données profil patient | `profil-fullname`, `d-fullname`, `d-phone-profil`, `d-gender`, `d-city-profil`, `d-since-profil` |
| POST | `/api/v1/patients/change-password` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ phone, old_password, new_password }` | Confirmation changement | `pwd-form-container` |
| GET | `/api/v1/patients/subscription?phone={phone}` | `Authorization: Bearer {token}` | - | Infos abonnement | `card-plan`, `profil-plan-badge`, `stat-plan`, `stat-montant`, `stat-statut`, `stat-expiration`, `d-plan`, `d-montant`, `d-debut`, `d-fin`, `d-statut`, `dos-plan` |

### RDV & Médecins

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/appointments/slots/{doctorId}?date={date}` | - | - | Créneaux disponibles | `slots-container` |
| POST | `/api/v1/appointments/book` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ patient_phone, doctor_id, date, time }` | Création RDV | `modal-success` (via `success-code`, `success-details`) |
| POST | `/api/v1/appointments/{id}/symptoms` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient }` | Enregistrement symptômes | Aucun (silencieux) |
| GET | `/api/v1/appointments/patient/{phone}` | `Authorization: Bearer {token}` | - | Liste RDV patient | `rdv-list-accueil` |
| GET | `/api/v1/doctors?specialty={sp}&city={ci}` | - | - | Liste médecins filtrés | `doctors-grid`, `doctors-count`, `stat-doctors` |

### Dossier Médical

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/reports/patient/{phone}/timeline` | `Authorization: Bearer {token}` | - | Historique consultations | `historique-list` |
| GET | `/api/v1/reports/access-log/{phone}` | `Authorization: Bearer {token}` | - | Historique accès | `access-log-list` |
| GET | `/api/v1/patients/constantes/{phone}` | `Authorization: Bearer {token}` | - | Constantes médicales | `dos-groupe-sanguin`, `dos-allergies`, `dos-maladies`, `dos-antecedents`, `dos-traitements`, `dos-poids`, `dos-taille`, `dos-contact-urgence`, `dos-constantes-source` |
| PATCH | `/api/v1/patients/constantes` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ groupe_sanguin, allergies, maladies_chroniques, antecedents_medicaux, traitements_en_cours, poids, taille, contact_urgence_nom, contact_urgence_phone, contact_urgence_lien }` | Mise à jour constantes | Recharge via `loadConstantes()` |

### QR Code

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/qr/generate` | `Authorization: Bearer {token}` | - | QR code patient | `qr-container` (via QRCode.js) |
| GET | `/api/v1/qr/emergency/generate` | `Authorization: Bearer {token}` | - | QR code urgence | `qr-urgence-container` (via QRCode.js) |

### Paiement

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| POST | `/api/v1/payments/initiate` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ amount, plan }` | Initiation paiement | `payment-body` + `currentReferenceId` |
| GET | `/api/v1/payments/momo/status/{reference_id}` | `Authorization: Bearer {token}` | - | Statut paiement | Déclenche `showPaymentSuccess()` ou `showPaymentError()` |

### Crédits

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/credits/balance` | `Authorization: Bearer {token}` | - | Solde et historique | `cr-balance`, `cr-months`, `cr-earned`, `cr-spent`, `cr-partners-grid`, `cr-history` |
| POST | `/api/v1/credits/spend` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ partner_id, amount }` | Dépense crédits | `modal-spend` + alert + recharge |

### Carte / Map

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/map/intervenants` | `Authorization: Bearer {token}` | - | Liste intervenants GPS | `map-container` (Leaflet), `map-list` |

### Conflits

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/conflicts` | `Authorization: Bearer {token}` | - | Liste conflits patient | `conflits-list` |
| POST | `/api/v1/conflicts` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ partner_type, partner_phone, subject, description }` | Création conflit | `modal-nouveau-conflit` + toast |
| GET | `/api/v1/conflicts/{id}` | `Authorization: Bearer {token}` | - | Détail conflit + messages | `detail-conflit-messages` |
| POST | `/api/v1/conflicts/{id}/messages` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ message }` | Réponse au conflit | Recharge messages |

### Notation

| Méthode | URL | Headers | Body | Réponse utilisée pour | Élément HTML mis à jour |
|---------|-----|---------|------|----------------------|------------------------|
| GET | `/api/v1/ratings/pending/{phone}` | `Authorization: Bearer {token}` | - | Évaluations en attente | `rating-modal` (UI complète) |
| POST | `/api/v1/ratings/submit` | `Authorization: Bearer {token}`, `Content-Type: application/json` | `{ patient_phone, intervenant_phone, intervenant_role, action_type, action_id, stars, adjectives }` | Soumission évaluation | Toast + prochaine évaluation |

---

## 5. INVENTAIRE COMPLET DES IDS ET ÉLÉMENTS CRITIQUES

### Structure principale
- `topbar-phone` - Affichage numéro téléphone topbar
- `alert-box` - Boîte d'alerte globale
- `btn-logout` - Bouton déconnexion

### Navigation Desktop
- `tab-accueil` - Tab Accueil
- `tab-medecins` - Tab Médecins
- `tab-dossier` - Tab Dossier médical
- `tab-carte` - Tab Partenaires
- `tab-credits` - Tab Crédits
- `tab-conflits` - Tab Conflits
- `tab-profil` - Tab Profil

### Navigation Mobile
- `bnav-accueil` - Nav Accueil
- `bnav-medecins` - Nav Médecins
- `bnav-dossier` - Nav Dossier
- `bnav-carte` - Nav Partenaires
- `bnav-credits` - Nav Crédits
- `bnav-conflits` - Nav Conflits
- `bnav-profil` - Nav Profil

### Panels
- `panel-accueil` - Panel Accueil
- `panel-medecins` - Panel Médecins
- `panel-dossier` - Panel Dossier
- `panel-carte` - Panel Carte
- `panel-credits` - Panel Crédits
- `panel-conflits` - Panel Conflits
- `panel-profil` - Panel Profil

### Accueil
- `card-phone` - Numéro téléphone carte membre
- `card-code` - Code membre
- `card-plan` - Plan abonnement
- `stat-plan` - Statut plan
- `stat-montant` - Montant abonnement
- `stat-statut` - Badge statut
- `stat-expiration` - Date expiration
- `stat-doctors` - Nombre médecins
- `rdv-list-accueil` - Liste RDV accueil
- `btn-nouveau-rdv` - Bouton nouveau RDV
- `btn-abonner-accueil` - Bouton s'abonner

### Médecins
- `filter-specialty` - Filtre spécialité
- `filter-city` - Filtre ville
- `btn-search-doctors` - Bouton recherche
- `doctors-grid` - Grille médecins
- `doctors-count` - Compteur médecins

### Dossier Médical
- `dos-phone` - Numéro téléphone dossier
- `dos-since` - Membre depuis
- `dos-plan` - Plan abonnement
- `dos-groupe-sanguin` - Groupe sanguin
- `dos-allergies` - Allergies
- `dos-maladies` - Maladies chroniques
- `dos-antecedents` - Antécédents
- `dos-traitements` - Traitements en cours
- `dos-poids` - Poids
- `dos-taille` - Taille
- `dos-contact-urgence` - Contact urgence
- `dos-constantes-source` - Source constantes
- `btn-edit-constantes` - Bouton éditer constantes
- `btn-generer-qr` - Bouton générer QR urgence
- `historique-list` - Liste historique
- `access-log-list` - Liste accès

### Carte
- `map-container` - Conteneur carte Leaflet
- `map-list` - Liste intervenants
- `filter-all` - Filtre tous
- `filter-doctor` - Filtre médecins
- `filter-pharmacie` - Filtre pharmacies
- `filter-laboratoire` - Filtre laboratoires

### Crédits
- `cr-balance` - Solde crédits
- `cr-months` - Mois consécutifs
- `cr-earned` - Total gagné
- `cr-spent` - Total dépensé
- `cr-partners-grid` - Grille partenaires
- `cr-history` - Historique transactions

### Conflits
- `conflits-list` - Liste conflits
- `conflit-partner-type` - Type partenaire formulaire
- `conflit-partner-phone` - Téléphone partenaire formulaire
- `conflit-subject` - Sujet formulaire
- `conflit-description` - Description formulaire
- `detail-conflit-ref` - Référence détail
- `detail-conflit-sujet` - Sujet détail
- `detail-conflit-messages` - Messages détail
- `conflit-reply` - Champ réponse

### Profil
- `profil-phone` - Numéro téléphone profil
- `profil-code` - Code membre profil
- `profil-fullname` - Nom complet profil
- `profil-plan-badge` - Badge plan
- `d-fullname` - Nom complet détail
- `d-phone-profil` - Téléphone détail
- `d-gender` - Genre détail
- `d-city-profil` - Ville détail
- `d-since-profil` - Membre depuis détail
- `d-plan` - Plan détail
- `d-montant` - Montant détail
- `d-debut` - Date début détail
- `d-fin` - Date fin détail
- `d-statut` - Statut détail
- `btn-renouveler` - Bouton renouveler
- `pwd-form-container` - Conteneur formulaire mot de passe
- `btn-change-pwd` - Bouton changer mot de passe

### Modale RDV
- `modal-rdv` - Modale RDV
- `modal-doctor-name` - Nom médecin modale
- `rdv-date` - Date RDV
- `slots-container` - Conteneur créneaux
- `btn-confirm-rdv` - Bouton confirmer RDV
- `symptoms-motif` - Motif symptômes
- `symptoms-duree` - Durée symptômes
- `symptoms-intensite` - Intensité symptômes
- `symptoms-traitements` - Traitements symptômes
- `symptoms-remarques` - Remarques symptômes
- `intensity-label` - Label intensité
- `step-1-circle`, `step-2-circle`, `step-3-circle` - Cercles progression
- `step-line-1`, `step-line-2` - Lignes progression
- `rdv-step-1`, `rdv-step-2`, `rdv-step-3` - Étapes wizard
- `recap-doctor-name` - Récap nom médecin
- `recap-datetime` - Récap date/heure
- `recap-motif` - Récap motif
- `recap-symptomes-section` - Section symptômes récap
- `recap-symptomes` - Conteneur symptômes récap
- `btn-close-modal` - Bouton fermer modale
- `btn-back-step1` - Bouton retour étape 1
- `btn-go-step3` - Bouton aller étape 3
- `btn-back-step2` - Bouton retour étape 2
- `btn-confirm-final` - Bouton confirmer final

### Modale Succès
- `modal-success` - Modale succès
- `success-code` - Code session succès
- `success-details` - Détails succès
- `btn-close-success` - Bouton fermer succès

### Modale Paiement
- `modal-payment` - Modale paiement
- `payment-body` - Corps modale paiement
- `countdown` - Countdown paiement
- `btn-refresh-qr` - Bouton rafraîchir QR

### Modale Crédits
- `modal-spend` - Modale dépense crédits
- `modal-spend-body` - Corps modale dépense
- `spend-amount` - Montant à dépenser
- `spend-discount` - Remise calculée

### Modale Constantes
- `modal-constantes` - Modale constantes
- `edit-groupe-sanguin` - Édition groupe sanguin
- `edit-allergies` - Édition allergies
- `edit-maladies` - Édition maladies
- `edit-antecedents` - Édition antécédents
- `edit-traitements` - Édition traitements
- `edit-poids` - Édition poids
- `edit-taille` - Édition taille
- `edit-contact-nom` - Édition contact nom
- `edit-contact-phone` - Édition contact téléphone
- `edit-contact-lien` - Édition contact lien
- `btn-close-constantes` - Bouton fermer constantes

### Modale Jitsi
- `modal-jitsi` - Modale Jitsi
- `jitsi-session-label` - Label session Jitsi
- `jitsi-code-display` - Affichage code Jitsi
- `jitsi-iframe` - Iframe Jitsi
- `jitsi-loading` - Loading Jitsi
- `jaas-container` - Conteneur JaaS
- `btn-close-jitsi` - Bouton fermer Jitsi

### Modale Notation
- `rating-modal` - Modale notation
- `rating-emoji` - Emoji notation
- `rating-title` - Titre notation
- `rating-subtitle` - Sous-titre notation
- `rating-stars` - Conteneur étoiles
- `rating-adjectives` - Conteneur adjectifs

### Modale Conflits
- `modal-nouveau-conflit` - Modale nouveau conflit
- `modal-detail-conflit` - Modale détail conflit

### QR Code
- `qr-container` - Conteneur QR code principal
- `qr-countdown` - Countdown QR
- `qr-urgence-container` - Conteneur QR urgence

### Accordéon
- `details-toggle` - Toggle détails
- `details-panel` - Panel détails
- `details-arrow` - Flèche détails

---

## 6. DONNÉES AFFICHÉES PAR SECTION

### Accueil
- **Numéro téléphone** : `localStorage.getItem('bolamu_patient_phone')` → `topbar-phone`, `card-phone`
- **Code membre** : Généré via `generateCode(phone)` → `card-code`
- **Plan abonnement** : API `/api/v1/patients/subscription` → `card-plan`, `stat-plan`, `stat-montant`, `stat-statut`, `stat-expiration`
- **Nombre médecins** : API `/api/v1/doctors` → `stat-doctors`
- **Liste RDV** : API `/api/v1/appointments/patient/{phone}` → `rdv-list-accueil` (cards avec médecin, date, heure, statut, code session, bouton Jitsi)

### Médecins
- **Liste médecins** : API `/api/v1/doctors?specialty={sp}&city={ci}` → `doctors-grid` (cards avec avatar, nom, ville, spécialité, nombre consultations, bouton RDV)
- **Filtres** : `filter-specialty`, `filter-city` (valeurs statiques)
- **Compteur** : API response → `doctors-count`

### Dossier Médical
- **Infos patient** : `localStorage` + API `/api/v1/patients/profil` → `dos-phone`, `dos-since`, `dos-plan`
- **Constantes médicales** : API `/api/v1/patients/constantes/{phone}` → `dos-groupe-sanguin`, `dos-allergies`, `dos-maladies`, `dos-antecedents`, `dos-traitements`, `dos-poids`, `dos-taille`, `dos-contact-urgence`, `dos-constantes-source`
- **Timeline consultations** : API `/api/v1/reports/patient/{phone}/timeline` → `historique-list` (timeline avec médecin, date, motif, diagnostic, traitement, ordonnance, résultats labo)
- **Access log** : API `/api/v1/reports/access-log/{phone}` → `access-log-list` (liste des accès avec rôle, type, date)

### Carte
- **Carte Leaflet** : API `/api/v1/map/intervenants` → `map-container` (marqueurs médecins/pharmacies/laboratoires)
- **Liste intervenants** : API `/api/v1/map/intervenants` → `map-list` (cards avec nom, type, spécialité, adresse, bouton appeler)
- **Filtres** : Boutons `filter-all`, `filter-doctor`, `filter-pharmacie`, `filter-laboratoire`

### Crédits
- **Solde** : API `/api/v1/credits/balance` → `cr-balance`, `cr-months`, `cr-earned`, `cr-spent`
- **Partenaires** : API `/api/v1/credits/balance` → `cr-partners-grid` (cards avec icône catégorie, nom, ville, remise)
- **Historique** : API `/api/v1/credits/balance` → `cr-history` (liste transactions avec type, raison, date, montant)

### Conflits
- **Liste conflits** : API `/api/v1/conflicts` → `conflits-list` (cards avec sujet, date, type partenaire, statut, référence)
- **Détail conflit** : API `/api/v1/conflicts/{id}` → `detail-conflit-messages` (messages chat-style avec rôle, contenu)
- **Formulaire** : `conflit-partner-type`, `conflit-partner-phone`, `conflit-subject`, `conflit-description`

### Profil
- **Infos profil** : API `/api/v1/patients/profil?phone={phone}` → `profil-phone`, `profil-code`, `profil-fullname`, `profil-plan-badge`, `d-fullname`, `d-phone-profil`, `d-gender`, `d-city-profil`, `d-since-profil`, `d-plan`, `d-montant`, `d-debut`, `d-fin`, `d-statut`
- **Abonnement** : API `/api/v1/patients/subscription` → `d-plan`, `d-montant`, `d-debut`, `d-fin`, `d-statut`
- **Formulaire mot de passe** : Généré dynamiquement → `pwd-form-container`

---

## 7. FONCTIONNALITÉS INTERACTIVES

### Formulaires

#### Formulaire RDV (multi-étapes)
- **Champs** : `rdv-date` (date), créneaux (sélection boutons), `symptoms-motif` (textarea), `symptoms-duree` (select), `symptoms-intensite` (range 1-10), `symptoms-traitements` (textarea), `symptoms-remarques` (textarea)
- **Validation** : Motif obligatoire, date obligatoire, créneau obligatoire
- **Endpoint cible** : `POST /api/v1/appointments/book` puis `POST /api/v1/appointments/{id}/symptoms`

#### Formulaire Paiement
- **Champs** : Sélection plan (Essentiel/Standard/Premium)
- **Validation** : Aucune (plan par défaut)
- **Endpoint cible** : `POST /api/v1/payments/initiate`

#### Formulaire Crédits
- **Champs** : `spend-amount` (number, min=minCredits, max=balance)
- **Validation** : Montant >= minCredits, <= balance
- **Endpoint cible** : `POST /api/v1/credits/spend`

#### Formulaire Constantes
- **Champs** : `edit-groupe-sanguin` (select), `edit-allergies` (textarea), `edit-maladies` (textarea), `edit-antecedents` (textarea), `edit-traitements` (textarea), `edit-poids` (number), `edit-taille` (number), `edit-contact-nom` (text), `edit-contact-phone` (tel), `edit-contact-lien` (text)
- **Validation** : Aucune
- **Endpoint cible** : `PATCH /api/v1/patients/constantes`

#### Formulaire Mot de passe
- **Champs** : `pwd-old` (password), `pwd-new` (password), `pwd-confirm` (password)
- **Validation** : Tous champs requis, new === confirm, new.length >= 6
- **Endpoint cible** : `POST /api/v1/patients/change-password`

#### Formulaire Conflit
- **Champs** : `conflit-partner-type` (select), `conflit-partner-phone` (tel), `conflit-subject` (text), `conflit-description` (textarea)
- **Validation** : partner_type, partner_phone, subject obligatoires
- **Endpoint cible** : `POST /api/v1/conflicts`

#### Formulaire Réponse Conflit
- **Champs** : `conflit-reply` (textarea)
- **Validation** : Message non vide
- **Endpoint cible** : `POST /api/v1/conflicts/{id}/messages`

### Modales / Overlays

| Modale | ID | Déclencheur | Contenu |
|--------|----|-------------|---------|
| RDV | `modal-rdv` | Bouton "Prendre rendez-vous" sur carte médecin | Wizard 3 étapes pour prise de RDV |
| Succès RDV | `modal-success` | Après confirmation RDV | Code session et détails RDV |
| Paiement | `modal-payment` | Bouton abonnement ou RDV sans abonnement | Sélection plan, confirmation MTN MoMo |
| Dépense crédits | `modal-spend` | Clic sur carte partenaire | Formulaire montant + calcul remise |
| Constantes | `modal-constantes` | Bouton "Éditer constantes" | Formulaire constantes médicales |
| QR urgence | `modal-qr-urgence` (créé dynamiquement) | Bouton "Générer QR urgence" | QR code temporaire 24h |
| Résultats labo | `modal-lab-resultats` (créé dynamiquement) | Bouton "Voir" dans timeline | Résultats + bouton téléchargement |
| Jitsi | `modal-jitsi` | Bouton "Rejoindre la consultation" | Iframe consultation vidéo |
| Notation | `rating-modal` | Détection automatique après RDV | Étoiles + adjectifs |
| Nouveau conflit | `modal-nouveau-conflit` | Bouton "+ Nouveau conflit" | Formulaire signalement |
| Détail conflit | `modal-detail-conflit` | Clic sur carte conflit | Messages + réponse |

### Boutons d'action

| ID | Libellé | Fonction appelée |
|----|---------|------------------|
| `btn-logout` | Déconnexion | `logout()` |
| `btn-nouveau-rdv` | + Nouveau RDV | Navigation vers tab Médecins |
| `btn-abonner-accueil` | S'abonner | `openPayment('essentiel')` |
| `btn-search-doctors` | Rechercher | `loadDoctors()` |
| `btn-edit-constantes` | Éditer constantes | `openEditConstantes()` |
| `btn-generer-qr` | Générer QR urgence | `genererQRUrgence()` |
| `btn-renouveler` | Renouveler | `openPayment('essentiel')` |
| `btn-change-pwd` | Changer mot de passe | Affiche formulaire `pwdFormHtml()` |
| `btn-close-jitsi` | Fermer | `closeJitsi()` |
| `btn-close-constantes` | Annuler | `closeEditConstantes()` |
| `btn-close-modal` | Fermer | `closeModal()` |
| `btn-confirm-rdv` | Choisir un créneau → / Confirmer à {time} → | `confirmerRdv()` |
| `btn-confirm-final` | Confirmer mon RDV | `confirmerFinal()` |
| `btn-close-success` | Accéder à mon espace → | `closeSuccess()` |
| `btn-back-step1` | ← Retour | `backToStep1()` |
| `btn-go-step3` | Continuer → | `goToStep3()` |
| `btn-back-step2` | ← Retour | `showStep(2)` |
| `btn-refresh-qr` | Rafraîchir QR | Recharge `initQR()` |

### Upload de fichiers
- **Aucun upload de fichier** dans le dashboard patient actuel

### QR Code / Scanner
- **QR Code patient** : Généré via `qrcodejs` library, affiché dans `qr-container`
- **QR Code urgence** : Généré dynamiquement via `qrcodejs`, valide 24h
- **Scanner** : Aucun scanner QR dans le dashboard patient (côté partenaire uniquement)

### Téléconsultation Jitsi
- **Library** : Jitsi Meet External API (8x8.vc JaaS)
- **Room name** : `vpaas-magic-cookie-9ca467330cb64541aa516c38dfe2e159/bolamu-{sessionCode}-{rdvId}`
- **Display name** : "Patient {4 derniers chiffres phone}"
- **Chargement** : Script chargé dynamiquement si pas déjà présent
- **Nettoyage** : Dispose API + vide DOM à la fermeture

---

## 8. DÉPENDANCES EXTERNES

### Librairies JS (CDN)

| Librairie | Version | URL | Usage |
|-----------|---------|-----|-------|
| Tailwind CSS | Latest (CDN) | `https://cdn.tailwindcss.com` | Framework CSS utilitaire |
| Lucide Icons | Latest | `https://unpkg.com/lucide@latest` | Icônes SVG |
| QRCode.js | 1.0.0 | `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js` | Génération QR codes |
| Leaflet | 1.9.4 | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` + CSS | Carte interactive |
| Jitsi Meet External API | Latest | `https://8x8.vc/vpaas-magic-cookie-9ca467330cb64541aa516c38dfe2e159/external_api.js` | Téléconsultation vidéo |

### Fonts

| Font | Variants | URL | Usage |
|------|----------|-----|-------|
| Plus Jakarta Sans | 300,400,500,600,700,800 | Google Fonts | Police principale (conforme design system) |
| Fraunces | 700,900 (italique 700) | Google Fonts | Titres et accents (NON conforme design system) |

### Icônes

| Library | Usage | Conformité design system |
|---------|-------|------------------------|
| Lucide Icons | Icônes SVG dans tout le dashboard | **NON conforme** (design system spécifie Material Symbols Outlined) |

---

## 9. PROBLÈMES IDENTIFIÉS

### Incohérences avec Design System

1. **Icônes** : Utilisation de Lucide Icons au lieu de Material Symbols Outlined spécifié dans `docs/design_system.md`
2. **Font secondaire** : Utilisation de Fraunces pour titres alors que le design system n'autorise que Plus Jakarta Sans
3. **Couleurs** : Utilisation de variables CSS personnalisées (`--bleu`, `--turquoise`, etc.) qui ne correspondent pas exactement aux tokens du design system

### Bugs visuels connus

1. **Dashboard admin panel En attente crashait** : Corrigé (catch variable shadowing) - mentionné dans règles permanentes mais non applicable au dashboard patient
2. **Render free plan dort après inactivité** : Risque de timeout lors de démo, nécessite ping avant

### Endpoints frontend vs backend

| Endpoint frontend | Route backend | Statut |
|-------------------|---------------|--------|
| `GET /api/v1/payments/momo/status/{reference_id}` | Non trouvé dans `payment.routes.js` | **PROBLÈME** : Endpoint n'existe pas, devrait être `GET /api/v1/payments/status/{reference}` ou similaire |
| `GET /api/v1/patients/constantes/{phone}` | `GET /api/v1/patients/constantes/:phone` dans `constantes-medicales.routes.js` | OK |
| `PATCH /api/v1/patients/constantes` | `PATCH /api/v1/patients/constantes` dans `constantes-medicales.routes.js` | OK |
| `GET /api/v1/conflicts` | `GET /api/v1/conflicts` dans `conflict.routes.js` | OK |
| `POST /api/v1/conflicts` | `POST /api/v1/conflicts` dans `conflict.routes.js` | OK |
| `GET /api/v1/conflicts/{id}` | `GET /api/v1/conflicts/:id` dans `conflict.routes.js` | OK |
| `POST /api/v1/conflicts/{id}/messages` | `POST /api/v1/conflicts/:id/messages` dans `conflict.routes.js` | OK |
| `GET /api/v1/ratings/pending/{phone}` | `GET /api/v1/ratings/pending/:phone` dans `ratings.routes.js` | OK |
| `POST /api/v1/ratings/submit` | `POST /api/v1/ratings/submit` dans `ratings.routes.js` | OK |
| `GET /api/v1/map/intervenants` | `GET /api/v1/map/intervenants` dans `map.routes.js` | OK |

### IDs dupliqués
- **Aucun ID dupliqué détecté** dans le HTML

### Fonctions définies mais jamais appelées
- **Aucune fonction morte détectée** : Toutes les fonctions définies sont appelées soit directement, soit via event listeners, soit via délégation d'événements

### Données hardcodées qui devraient venir de l'API
- **Filtres spécialité et ville** : Les options des selects `filter-specialty` et `filter-city` sont hardcodées en HTML. Elles pourraient être dynamiques depuis l'API.
- **Symptômes tags** : Les tags de symptômes dans le formulaire RDV sont hardcodés en HTML.

### URLs relatives vs absolues
- **Mixte** : Certains appels API utilisent l'URL absolue `https://api.bolamu.co/api/v1/...` (via constante `API`), d'autres utilisent des URLs relatives `/api/v1/...` (ex: `loadConstantes()`). 
- **Problème** : `loadConstantes()` utilise `/api/v1/patients/constantes/{phone}` (relatif) au lieu de l'URL absolue, ce qui peut causer des problèmes en environnement de dev vs prod.

---

## 10. RECOMMANDATIONS POUR LA REFONTE

### Ce qui doit absolument être conservé sans modification

1. **Tous les IDs HTML** : Chaque ID listé dans la section 5 doit être conservé identique pour ne pas casser le JavaScript
2. **Structure des panels** : Les 7 panels avec leurs classes `.panel` et `.active` doivent être conservés
3. **Mécanisme de navigation** : Les fonctions `showTab()` et `showTabMobile()` doivent continuer de fonctionner de la même manière
4. **LocalStorage keys** : `bolamu_patient_token` et `bolamu_patient_phone` ne doivent pas changer
5. **Endpoints API** : Toutes les URLs et structures de données API doivent rester identiques
6. **Fonctions JavaScript** : Toutes les fonctions listées dans la section 3 doivent être conservées avec leurs signatures exactes
7. **Modales** : Toutes les modales et leurs IDs doivent être conservés
8. **Data attributes** : Les `data-action`, `data-id`, `data-name`, etc. utilisés pour la délégation d'événements doivent être conservés

### Ce qui peut être restructuré visuellement sans risque

1. **Layout des panels** : La disposition interne de chaque panel peut être entièrement refaite
2. **Cartes et composants** : Le style des cards (RDV, médecins, partenaires) peut être refait
3. **Navigation** : L'apparence de la barre de tabs desktop et de la nav mobile peut être refaite
4. **Modales** : Le design visuel des modales peut être refait en conservant les IDs
5. **Typographie** : Les tailles de police, espacements, et hiérarchie visuelle peuvent être ajustés
6. **Couleurs** : Les variables CSS peuvent être mises en conformité avec le design system
7. **Responsive** : Le comportement mobile peut être amélioré

### Ce qui nécessite une coordination backend avant de pouvoir être amélioré

1. **Endpoint de statut paiement MoMo** : L'endpoint `GET /api/v1/payments/momo/status/{reference_id}` n'existe pas dans les routes backend. Il faut soit le créer, soit modifier le frontend pour utiliser un endpoint existant.
2. **Filtres dynamiques** : Pour rendre les filtres spécialité/ville dynamiques, il faut créer un endpoint backend qui retourne la liste des spécialités et villes disponibles.
3. **Symptômes dynamiques** : Pour rendre les tags de symptômes dynamiques, il faut créer un endpoint backend qui retourne la liste des symptômes prédéfinis.

### Ordre suggéré des tabs pour la nouvelle version

1. **Accueil** - Conserver en premier (vue d'ensemble)
2. **Médecins** - Conserver en second (action principale)
3. **Dossier médical** - Conserver en troisième (données personnelles)
4. **Crédits** - Déplacer avant Partenaires (plus utilisé)
5. **Partenaires (Carte)** - Déplacer après Crédits (fonctionnalité secondaire)
6. **Conflits** - Conserver avant Profil (support)
7. **Profil** - Conserver en dernier (configuration)

**Ordre actuel** : Accueil → Médecins → Dossier → Partenaires → Crédits → Conflits → Profil  
**Ordre suggéré** : Accueil → Médecins → Dossier → Crédits → Partenaires → Conflits → Profil

### Priorités de refonte

1. **Haute priorité** : Mise en conformité avec le design system (couleurs, icônes Material Symbols, police Plus Jakarta Sans uniquement)
2. **Haute priorité** : Correction de l'endpoint de statut paiement manquant
3. **Moyenne priorité** : Uniformisation des URLs API (toutes absolues ou toutes relatives)
4. **Moyenne priorité** : Réorganisation de l'ordre des tabs
5. **Basse priorité** : Filtres dynamiques (amélioration UX)
6. **Basse priorité** : Symptômes dynamiques (amélioration UX)

---

## CONCLUSION

Ce dashboard patient est fonctionnel mais présente plusieurs incohérences avec le design system établi. La refonte visuelle peut être réalisée sans toucher au backend à condition de :
1. Conserver strictement tous les IDs HTML
2. Conserver toutes les fonctions JavaScript et leurs signatures
3. Conserver la structure des données API
4. Corriger l'endpoint manquant pour le statut paiement MoMo
5. Mettre en conformité les icônes, fonts et couleurs avec le design system

La refonte devrait se concentrer sur l'UX/UI (layout, responsive, hiérarchie visuelle) tout en maintenant la compatibilité technique existante.
