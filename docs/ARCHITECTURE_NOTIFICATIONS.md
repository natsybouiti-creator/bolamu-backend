# BOLAMU — ARCHITECTURE NOTIFICATIONS

## SOURCE DE VÉRITÉ UNIQUE

Ce document est la source de vérité pour tous les templates de notifications WhatsApp.
Tout nouveau template doit être ajouté ici AVANT d'être implémenté dans `src/services/whatsapp-web.service.js`.

## CANAUX DE NOTIFICATION

- **WhatsApp** : sendAutoMessage(phone, templateName, params) dans src/services/whatsapp-web.service.js
- **Email** : Resend (optionnel)
- **Push** : Web Push VAPID (optionnel)

## TEMPLATES PAR RÔLE

### PATIENT

#### Inscription & Auth
- `bolamu_inscription` : Confirmation inscription + mot de passe généré
  - Params : [prenom, mot_de_passe]
  - Déclencheur : Après inscription patient

- `bolamu_mdp_oublie` : Nouveau mot de passe généré
  - Params : [nouveau_mdp]
  - Déclencheur : POST /api/v1/auth/forgot-password

#### Abonnements
- `bolamu_abonnement_active` : Confirmation activation abonnement
  - Params : [prenom, plan, montant, date_fin]
  - Déclencheur : Paiement validé

- `bolamu_abonnement_expire` : Rappel expiration
  - Params : [prenom, date_expiration]
  - Déclencheur : Cron J-7 avant expiration

#### RDV & Consultations
- `bolamu_rdv_confirme` : Confirmation RDV
  - Params : [prenom, medecin, date, heure]
  - Déclencheur : RDV créé

- `bolamu_rdv_rappel` : Rappel RDV J-1
  - Params : [prenom, medecin, date, heure]
  - Déclencheur : Cron J-1

#### Prescriptions & Labo
- `bolamu_prescription_dispo` : Prescription disponible
  - Params : [prenom, medecin]
  - Déclencheur : Prescription créée

- `bolamu_labo_resultats` : Résultats labo disponibles
  - Params : [prenom, labo]
  - Déclencheur : Résultats uploadés

### MÉDECIN

#### Validation
- `bolamu_medecin_valide` : Compte validé
  - Params : [prenom]
  - Déclencheur : Admin validation

#### RDV
- `bolamu_rdv_nouveau` : Nouveau RDV
  - Params : [patient, date, heure]
  - Déclencheur : Patient crée RDV

### PHARMACIE

#### Validation
- `bolamu_pharmacie_valide` : Compte validé
  - Params : [nom]
  - Déclencheur : Admin validation

#### Prescriptions
- `bolamu_prescription_recue` : Prescription reçue
  - Params : [patient, medecin]
  - Déclencheur : Prescription envoyée

### LABORATOIRE

#### Validation
- `bolamu_labo_valide` : Compte validé
  - Params : [nom]
  - Déclencheur : Admin validation

#### Analyses
- `bolamu_analyse_demandee` : Analyse demandée
  - Params : [patient, medecin]
  - Déclencheur : Labo prescription créée

### ADMIN

#### Alertes
- `bolamu_alerte_fraude` : Détection fraude
  - Params : [type, patient, score]
  - Déclencheur : fraud_score > 70

## BOUCLE 2 — COMMUNAUTÉ & ENGAGEMENT

### Groupes Sport
- `bolamu_groupe_rejoint` : Confirmation rejoindre groupe
  - Params : [nom_groupe, prenom_patient]
  - Déclencheur : POST /api/community/sport-groups/:id/join
  - Message : "Bienvenue dans le groupe {nom_groupe}, {prenom} ! Vous faites maintenant partie de l'équipe. Connectez-vous sur bolamu.co pour voir le classement. L'équipe Bolamu"

### Classement
- `bolamu_leaderboard_top3` : Top 3 du classement
  - Params : [prenom, rang, nom_groupe, solde_zora]
  - Déclencheur : Rang ≤ 3 après updateLeaderboard()
  - Message : "Bravo {prenom} ! Vous êtes {rang}e du classement du groupe {nom_groupe}. Solde Zora actuel : {solde_zora} points. L'équipe Bolamu"

### Streaks
- `bolamu_streak_milestone` : Jalon streak atteint
  - Params : [prenom, jours, bonus_zora]
  - Déclencheur : Streak atteint 7, 14, 30 jours
  - Message : "{jours} jours de streak consecutifs sur Bolamu, {prenom} ! Vous gagnez {bonus_zora} Zora bonus. Continuez comme ca ! L'équipe Bolamu"

## BOUCLE 3 — PRÉVENTION, ANIMATEURS & ELONGA

### Événements Elonga
- `bolamu_checkin_confirme` : Confirmation check-in événement
  - Params : [prenom_patient, nom_evenement, zora_awarded]
  - Déclencheur : POST /events/:id/checkin (animateur scanne QR)
  - Message : "Présence confirmée, {prenom_patient} ! Vous avez participé à {nom_evenement}. +{zora_awarded} Zora crédités sur votre compte. L'équipe Bolamu"

- `bolamu_event_rappel` : Rappel événement H-1
  - Params : [prenom_patient, nom_evenement, lieu]
  - Déclencheur : Cron 1 heure avant starts_at
  - Message : "Rappel, {prenom_patient} ! L'événement {nom_evenement} commence dans 1 heure. Lieu : {lieu}. L'équipe Bolamu"

### Clubs
- `bolamu_club_message` : Message animateur aux membres club
  - Params : [nom_club, message_text]
  - Déclencheur : POST /animateur/clubs/:id/notify
  - Message : "Message de votre club {nom_club} : {message_text}. Votre animateur Bolamu"

## BOUCLE 4 — PARCOURS DE SOINS

### Consultations
- `bolamu_consultation_terminee` : Consultation terminée
  - Params : [prenom_patient, nom_medecin, diagnostic]
  - Déclencheur : POST /api/v1/consultations/:id/close
  - Message : "Consultation terminée, {prenom_patient} ! Médecin : Dr. {nom_medecin}. Diagnostic : {diagnostic}. +50 Zora crédités. Téléchargez votre ordonnance sur bolamu.co. L'équipe Bolamu"

### RDV
- `bolamu_rdv_confirme` : RDV confirmé (secrétaire)
  - Params : [prenom_patient, nom_medecin, date_heure, lieu]
  - Déclencheur : PUT /secretariat/rdv/:id/status (status=confirmed)
  - Message : "RDV confirmé, {prenom_patient} ! Dr. {nom_medecin} — {date_heure}. Lieu : {lieu}. L'équipe Bolamu"

### Ordonnances
- `bolamu_ordonnance_prete` : Ordonnance prête en pharmacie
  - Params : [prenom_patient]
  - Déclencheur : POST /api/v1/ordonnances/:id/dispense
  - Message : "Votre ordonnance est prête, {prenom_patient}. Présentez-vous en pharmacie avec votre QR code Bolamu. L'équipe Bolamu"

## BOUCLE 5 — RÉSEAU PARTENAIRES SANTÉ

### Pharmacie
- `bolamu_ordonnance_dispensee` : Ordonnance dispensée
  - Params : [prenom_patient, nom_pharmacie, date_recuperation]
  - Déclencheur : POST /api/v1/ordonnances/:id/dispense
  - Message : "Bonne nouvelle, {prenom_patient} ! Votre ordonnance a été dispensée par la pharmacie {nom_pharmacie}. Médicaments récupérés le {date_recuperation}. L'équipe Bolamu"

- `bolamu_ordonnance_dispensee_medecin` : Ordonnance dispensée (notification médecin)
  - Params : [prenom_patient, nom_pharmacie]
  - Déclencheur : POST /api/v1/ordonnances/:id/dispense
  - Message : "Votre ordonnance pour {prenom_patient} a été dispensée par la pharmacie {nom_pharmacie}. L'équipe Bolamu"

- `bolamu_nouvelle_ordonnance_pharmacie` : Nouvelle ordonnance disponible (pharmacie)
  - Params : [nom_patient, nom_medecin]
  - Déclencheur : POST /api/v1/ordonnances
  - Message : "Nouvelle ordonnance disponible. Patient : {nom_patient} Médecin : Dr. {nom_medecin} Connectez-vous sur bolamu.co pour traiter. Bolamu"

### Laboratoire
- `bolamu_resultats_disponibles` : Résultats labo disponibles
  - Params : [prenom_patient, nom_laboratoire]
  - Déclencheur : POST /api/v1/lab/results/submit
  - Message : "{prenom_patient}, vos résultats d'analyses sont disponibles sur bolamu.co. Laboratoire : {nom_laboratoire} Consultez-les depuis votre espace patient. L'équipe Bolamu"

## BOUCLE 6 — PARTENAIRES RÉCOMPENSES & ÉCONOMIE ZORA

### Vouchers Zora
- `bolamu_voucher_genere` : Voucher Zora généré
  - Params : [prenom_patient, code_voucher, nom_partenaire]
  - Déclencheur : POST /api/v1/vouchers/generate
  - Message : "{prenom_patient}, votre voucher est prêt ! Code : {code_voucher} Valable chez : {nom_partenaire} Expire dans 48h. L'équipe Bolamu"

- `bolamu_voucher_utilise` : Voucher Zora validé
  - Params : [prenom_patient, nom_recompense, nom_partenaire]
  - Déclencheur : POST /api/v1/partenaire/voucher/validate
  - Message : "{prenom_patient}, votre voucher a été validé. Récompense : {nom_recompense} Partenaire : {nom_partenaire} Merci de votre fidélité — L'équipe Bolamu"

## RÈGLES D'ENVOI

1. **Volume** : Jamais de WhatsApp pour chaque message chat (trop élevé)
2. **Fréquence** : Maximum 1 notification/h par utilisateur
3. **Priorité** : Sécurité > Paiements > RDV > Engagement
4. **Opt-out** : Respecter préférences utilisateur (table user_preferences)
5. **Traçabilité** : Toute notification insérée dans table notifications avec sent_at

## PREUVE D'ENVOI

```sql
SELECT user_phone, type, canal, sent_at
FROM notifications
WHERE canal = 'whatsapp' AND sent_at IS NOT NULL
ORDER BY created_at DESC LIMIT 3;
```

## MISES À JOUR

- 25 juin 2026 : Création document + templates Boucle 2
- 25 juin 2026 : Ajout templates Boucle 3 (checkin_confirme, event_rappel, club_message)
- 25 juin 2026 : Ajout templates Boucle 4 (consultation_terminee, rdv_confirme, ordonnance_prete)
- 25 juin 2026 : Ajout templates Boucle 5 (ordonnance_dispensee, ordonnance_dispensee_medecin, nouvelle_ordonnance_pharmacie, resultats_disponibles)
- 25 juin 2026 : Ajout templates Boucle 6 (bolamu_voucher_genere, bolamu_voucher_utilise)
