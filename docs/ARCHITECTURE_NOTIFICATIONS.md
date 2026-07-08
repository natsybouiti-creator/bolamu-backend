# BOLAMU — ARCHITECTURE NOTIFICATIONS

## SOURCE DE VÉRITÉ UNIQUE

Ce document est la source de vérité pour tous les templates de notifications WhatsApp.
Tout nouveau template doit être ajouté ici AVANT d'être implémenté dans `src/services/whatsapp.service.js`.

## CANAUX DE NOTIFICATION

- **WhatsApp** : sendAutoMessage(phone, templateName, params) dans `src/services/whatsapp.service.js` — corrigé le 7 juillet 2026, ce fichier s'appelait à tort `whatsapp-web.service.js` dans une version antérieure de ce document (ce nom de fichier n'existe pas dans le repo)
- **Email** : Resend (optionnel)
- **Push** : Web Push VAPID (optionnel) — voir « CANAL PUSH (VAPID) — état réel » pour le détail
- **Socket.io** : event `notification` via `notifyLite()` — voir « CANAL SOCKET.IO » ci-dessous, absent des versions antérieures de ce document

## INFRASTRUCTURE WAHA

**Stack** : WAHA (WhatsApp HTTP API) — moteur GOWS — hébergé sur Render.
**Numéro cible (prod)** : SIM dédiée Bolamu (MTN ou Airtel Congo).

### Schéma d'architecture globale

```
[Événement plateforme]
        ↓
[Backend Node.js — trigger notification]
        ↓
[whatsapp.service.js — sendAutoMessage(phone, templateName, params)]
        ↓
[POST https://waha-bolamu.onrender.com/api/sendText]
   Header: X-Api-Key: WAHA_API_KEY
        ↓
[WAHA — moteur GOWS — session "default" — SIM dédiée Bolamu]
        ↓
[Destinataire reçoit le message WhatsApp]
        ↓
[INSERT → table notifications (user_phone, type, titre, message, canal, sent_at)]
```

### Règles fondamentales infra

- **Un seul numéro expéditeur** : la SIM dédiée Bolamu.
- **Un seul service d'envoi** : `whatsapp.service.js` → `sendAutoMessage(phone, templateName, params)`.
- **Un seul appel HTTP** : `POST /api/sendText` vers WAHA avec `X-Api-Key`.
- **Fallback** : si WAHA répond erreur → log erreur + INSERT `notifications` avec `sent_at = NULL`.
- **Moteur GOWS** : pas de Chrome/Puppeteer — aucun crash "Execution context destroyed".
- **Session persistée** : disque Render `/app/.sessions` — pas de QR à rescanner après redémarrage.
- **Meta API (`whatsapp.service.META.DEPRECATED.js`, `graph.facebook.com`) est abandonnée** — WAHA (`whatsapp.service.js`) est le seul canal WhatsApp actif. **Correction de nom de fichier le 7 juillet 2026** : une version antérieure de ce document attribuait par erreur le nom `whatsapp.service.js` au fichier Meta abandonné — c'est l'inverse, `whatsapp.service.js` est le fichier WAHA actif, le fichier Meta mort porte l'extension `.META.DEPRECATED.js`. Un seul appel résiduel à l'ancienne fonction Meta (`sendWhatsAppTemplate()`) subsiste, en commentaire, dans `elonga-events.service.js:282` — jamais exécuté.

### Procédure de bascule vers la SIM dédiée

1. Insérer la SIM dans un téléphone Android (pas iPhone — incompatible).
2. Créer un compte WhatsApp classique sur ce numéro.
3. Ouvrir le dashboard WAHA → `https://waha-bolamu.onrender.com/dashboard`.
4. Arrêter la session `default` → supprimer → recréer.
5. Scanner le nouveau QR code avec le téléphone Android SIM dédiée.
6. Mettre à jour `.env` : `BOLAMU_WA_PHONE=+242XXXXXXXXX`.
7. Tester un envoi vers un numéro personnel — confirmer réception.
8. Commit : `chore: bascule SIM dédiée Bolamu WhatsApp`.

## CANAL SOCKET.IO — notifyLite() (ajouté le 7 juillet 2026, absent des versions antérieures de ce document)

Canal temps réel distinct de WhatsApp/Email/Push, non couvert jusqu'ici par ce document alors qu'il est réellement utilisé en production.

- **Mécanisme** : `notifyLite()` (`src/services/notification.service.js:16`) émet `io.to('user:{user_phone}').emit('notification', result.rows[0])` (ligne 26) vers la room privée de l'utilisateur, initialisée par `socketService.js::initializeSocket()` avec authentification JWT par room `user:{phone}`.
- **Déclencheurs réels confirmés** : nouvel abonné (`follows.controller.js:78,101,306`), like sur un post (`feed.controller.js:205`), commentaire sur un post (`feed.controller.js:268`).
- **Portée** : uniquement des interactions sociales légères (follow/like/commentaire) — aucun lien avec les notifications WhatsApp/templates ci-dessous, canal totalement indépendant.
- Un event distinct, `leaderboard_updated`, est également émis en broadcast global (`io.emit`, `zora.service.js:206`) hors du système `notifications` — mentionné ici pour mémoire, sans lien avec `notifyLite()`.

## CANAL PUSH (VAPID) — état réel (clarifié le 7 juillet 2026)

- **Désactivé en pratique, faute de clés configurées** : `configurePush()` (`src/services/push.service.js:11-15`) vérifie `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` au démarrage — absentes de `.env` (confirmé, pas seulement vides) → log `[Push] VAPID keys non configurées - notifications push désactivées` et sortie immédiate de la fonction.
- **Dégradation silencieuse confirmée** : tant que `pushEnabled` reste `false`, `sendToUser()`/`sendToAll()` retournent `{ success: true, sent: 0 }` sans lever d'erreur — aucun appelant ne peut détecter l'échec autrement qu'en lisant ce champ.
- **Pas de BullMQ dans `push.service.js` lui-même** : l'envoi est synchrone (`webpush.sendNotification()` appelé directement), contrairement à la mention BullMQ trouvée ailleurs dans le repo (rôle `/notification-engineer` de `CLAUDE.md`, hors périmètre de cette mise à jour). `src/workers/notification-worker.js` importe bien `push.service.js`, mais son usage principal reste `sendAutoMessage` (WhatsApp).

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

#### Urgence
- `bolamu_urgence_dossier_consulte` : Alerte consultation dossier urgence
  - Params : [nom_patient, date, heure]
  - Déclencheur : GET /api/v1/qr/urgence (scan QR urgence public)
  - Message : "Alerte Bolamu\nLe dossier médical d'urgence de {nom_patient} vient d'être consulté le {date} à {heure}. Si vous n'êtes pas à l'origine de cet accès ou si la situation vous inquiète, contactez immédiatement le patient ou les secours. L'équipe Bolamu"

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

**⚠️ Deux systèmes parallèles distincts, confirmé par audit du 7 juillet 2026 — à ne pas confondre entre eux :**
- **`zora_vouchers`** (table legacy, marketplace) → service `zora-voucher.service.js` → templates ci-dessous, **réellement appelés**.
- **`partner_bons_zora`** (table utilisée aujourd'hui par le patient, voir `ARCHITECTURE_ZORA_BOLAMU.md` §4/§10) → service `bon-zora.service.js` → templates `bolamu_bon_zora_*` ci-dessous, **documentés mais non appelés à ce jour** (voir sous-section dédiée).

### Vouchers (`zora_vouchers`) — ACTIF, réellement envoyé (ajouté au catalogue le 7 juillet 2026, manquait jusqu'ici malgré son usage réel)
- `bolamu_voucher_genere` : Voucher marketplace généré
  - Déclencheur réel confirmé : `zora-voucher.service.js:125`, appel `sendAutoMessage()` à la génération d'un voucher
- `bolamu_voucher_utilise` : Voucher marketplace validé
  - Déclencheur réel confirmé : `zora-voucher.service.js:269`, appel `sendAutoMessage()` à la validation d'un voucher

### Bons Zora (`partner_bons_zora`) — CIBLE À IMPLÉMENTER, pas encore envoyé
- `bolamu_bon_zora_genere` : Bon Zora généré
  - Params : [prenom_patient, code_bon_zora, nom_partenaire]
  - Déclencheur cible : `POST /api/v1/bons-zora/generate` (`bon-zora.service.js::generateBonZora()`) — **lecture exhaustive du fichier confirmée le 7 juillet 2026 : aucun appel `sendAutoMessage()` ni aucune notification, tous canaux confondus, dans cette fonction à ce jour**
  - Message cible : "{prenom_patient}, votre Bon Zora est prêt ! Code : {code_bon_zora} Valable chez : {nom_partenaire} Expire dans 48h. L'équipe Bolamu"
  - **Implémentation cible** : réutiliser le pattern `sendAutoMessage()` déjà éprouvé dans `zora-voucher.service.js:125` (ci-dessus) — voir `ARCHITECTURE_ZORA_BOLAMU.md` §7.5 pour le détail complet du flux (WhatsApp + intégration QR/carte membre). Ce template reste **distinct** de `bolamu_voucher_genere` pour ne pas mélanger les deux systèmes en notification comme ils le sont déjà en base.

- `bolamu_bon_zora_utilise` : Bon Zora validé
  - Params : [prenom_patient, nom_recompense, nom_partenaire]
  - Déclencheur cible : `POST /api/v1/bons-zora/validate` (`bon-zora.service.js::validateBonZora()`) — même constat : **aucune notification implémentée à ce jour**
  - Message cible : "{prenom_patient}, votre Bon Zora a été validé. Récompense : {nom_recompense} Partenaire : {nom_partenaire} Merci de votre fidélité — L'équipe Bolamu"
  - **Implémentation cible** : même pattern que ci-dessus, voir `ARCHITECTURE_ZORA_BOLAMU.md` §7.5. Template distinct de `bolamu_voucher_utilise`.

- `bolamu_bon_zora_reglement` : Règlement Bon Zora partenaire
  - Params : [montant_fcfa, reference_reglement]
  - Déclencheur : POST /api/v1/clearing/bons-zora/run (`clearing.routes.js:453`) — **celui-ci est réellement appelé, à la différence des deux templates ci-dessus** (confirmé par audit du 7 juillet 2026)
  - Message : "Votre règlement Bon Zora de {montant_fcfa} FCFA a été généré. Référence : {reference_reglement}. L'équipe Bolamu"

## RÈGLES D'ENVOI

1. **Volume** : Jamais de WhatsApp pour chaque message chat (trop élevé)
2. **Fréquence** : Maximum 1 notification/h par utilisateur
3. **Priorité** : Sécurité > Paiements > RDV > Engagement
4. **Opt-out** : Respecter préférences utilisateur (table user_preferences)
5. **Traçabilité** : Toute notification insérée dans table notifications avec sent_at

## SCHÉMA SQL — TABLE NOTIFICATIONS

```sql
-- Schéma actuel (migration_023 + corrections session + migration_052 link/metadata)
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'rdv_confirme','rdv_rappel','rdv_annule','paiement_recu',
    'abonnement_expire','abonnement_renouvele','conflit_update',
    'message_recu','alerte_systeme','whatsapp_message','encouragement',
    'new_like','new_comment','new_follower'
  )),
  titre VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(300),
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  canal VARCHAR(20) DEFAULT 'push' CHECK (canal IN ('push','whatsapp','sms','email','in_app')),
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert type correct (PAS content — la colonne n'existe pas)
INSERT INTO notifications (user_phone, type, titre, message, canal, sent_at, created_at)
VALUES ($1, 'whatsapp_message', $2, $3, 'whatsapp', NOW(), NOW());
```

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
- 25 juin 2026 : Ajout templates Boucle 6 (bolamu_bon_zora_genere, bolamu_bon_zora_utilise)
- 6 juillet 2026 : Renommage voucher→bon_zora (terminologie produit)
- 25 juin 2026 : Ajout templates Boucle 4 (consultation_terminee, rdv_confirme, ordonnance_prete)
- 25 juin 2026 : Ajout templates Boucle 5 (ordonnance_dispensee, ordonnance_dispensee_medecin, nouvelle_ordonnance_pharmacie, resultats_disponibles)
- 25 juin 2026 : Ajout templates Boucle 6 (bolamu_voucher_genere, bolamu_voucher_utilise)
- 4 juillet 2026 : Fusion de l'infrastructure WAHA (schéma architecture, procédure bascule SIM, schéma SQL table notifications) depuis "ARCHITECTURE_NOTIFICATIONS_BOLAMU (1).md" (désormais SUPERSEDED) — Meta API confirmée abandonnée, WAHA seul canal actif
- 7 juillet 2026 : Correction du nom de fichier WhatsApp actif (`whatsapp.service.js`, pas `whatsapp-web.service.js` qui n'existe pas) et du nom du fichier Meta abandonné (`whatsapp.service.META.DEPRECATED.js`, inversé par erreur dans une version antérieure) ; ajout des templates `bolamu_voucher_genere`/`bolamu_voucher_utilise` au catalogue Boucle 6 (réellement actifs, manquaient jusqu'ici) ; `bolamu_bon_zora_genere`/`bolamu_bon_zora_utilise` reclassés CIBLE À IMPLÉMENTER (non appelés à ce jour, à distinguer explicitement des templates voucher) ; ajout des sections Canal Socket.io (`notifyLite()`) et Canal Push (VAPID, état réel) absentes des versions antérieures
