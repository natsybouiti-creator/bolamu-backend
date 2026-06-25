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
