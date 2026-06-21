# CATALOGUE SYSTÈMES & PARCOURS — Bolamu

> **3ᵉ couche de référence**, après `METHODE_BOLAMU.md` (comment on construit) et
> `INTERCONNEXIONS_BOLAMU.md` (le système nerveux). Celle-ci décrit **l'expérience
> vécue** : les parcours patient et professionnel, et chaque système fonctionnel avec
> ses points de contrôle.
>
> Chaque système est noté selon le triptyque **DOC / CODE / TEST** = est-il spécifié,
> câblé, prouvé ? Le statut réel (câblé vs fantôme) sort de l'audit code ; ici on
> pose la cible chirurgicale. Vue **expert** (tables, contrôles) + vue **utilisateur**
> (ce que ça change pour l'adhérent).

---

## Le fil rouge — la balade du patient

1. Il s'inscrit (téléphone + OTP), complète son onboarding **avec photo** et accepte
   les CGU → son identité est posée.
2. Il couvre éventuellement sa famille sous le même abonnement.
3. Au quotidien, il **découvre des événements/ateliers** près de chez lui (adresse,
   carte), s'y inscrit, **se rend sur place et valide sa présence par QR** → il gagne
   des Zora et reçoit une notification.
4. Il **crée ou rejoint un club** (groupe sportif), participe à des sessions validées
   par le coach (QR) → Zora.
5. Il **joue** pour gagner des Zora, suit son solde, son palier, le classement.
6. Il **échange ses Zora** contre des récompenses partenaires (MFR, sans cash-out).
7. Quand il a besoin de soin : il **prend RDV**, passe en consultation (assistée par
   **Amina**), reçoit une **ordonnance** qu'il retire en **pharmacie** (QR), ou des
   **analyses** déposées par le **labo** qu'il consulte dans son dossier.

Tout cela doit être vrai en base, pas seulement à l'écran (cf. les fantômes prouvés).

---

## Systèmes fonctionnels

### S1 — Inscription & identité (la porte d'entrée)
- **Tables.** `users` (`photo_url`, `id_card_url`, `document_url`, `documents_file_ids`,
  `secret_pin`, `cgu_accepted`, `onboarding_completed`, `onboarding_token`),
  `otp_codes`/`otps`, `push_subscriptions`.
- **Parcours.** Téléphone → OTP → profil → **photo du participant** → CGU → routage
  par rôle.
- **Points de contrôle.** OTP (canal), **photo d'identité** (anti-fraude — la photo
  sert à garantir que la personne est bien le titulaire), PIN secret, magic link
  interim (WhatsApp en attente de vérification business).
- **Vue utilisateur.** « Je m'inscris en quelques étapes, ma photo est prise, je suis
  reconnu. »
- **DOC / CODE / TEST.** À spécifier finement (clarifier doublon `otps`/`otp_codes`),
  vérifier la capture+stockage photo (Cloudinary), tester le parcours complet
  multi-étapes + routage rôle.

### S2 — Événements & ateliers (Elonga) + check-in
- **Tables.** `elonga_events` (`latitude`, `longitude`, `location_name`,
  `location_address`, `zora_reward`, `max_participants`, `proof_class`, `starts_at`),
  `elonga_registrations` (`checkin_at`, `checkin_by`, `zora_awarded`),
  `elonga_checkin_tokens`, `qr_tokens`.
- **Parcours.** Découvrir (carte + adresse) → s'inscrire → se rendre sur place →
  **QR check-in validé par l'organisateur/coach** → Zora crédité → notification.
- **Points de contrôle.** **Lieu** (adresse + géoloc), **point de validation = QR de
  check-in** (preuve `ground_truth`), `checkin_by` = qui a scanné.
- **Vue utilisateur.** « Je vois les ateliers près de moi, je m'inscris, je scanne sur
  place, je gagne mes Zora. »
- **DOC / CODE / TEST.** ❌ Inscription prouvée **fantôme** cette session → correctif
  en cours. Câbler check-in + crédit Zora + notif. Tester de bout en bout.

### S3 — Clubs / groupes sportifs
- **Tables.** `sport_groups`, `sport_group_members`.
- **Parcours.** **Créer un club** / **rejoindre** un club → sessions de groupe →
  **QR coach** à la session → Zora.
- **Points de contrôle.** Coach-side QR scan (vérification sport Phase 1) ; capteurs
  mobiles (`device_measured`) en Phase 2 ; jamais `device_declared` pour Zora.
- **Vue utilisateur.** « Je crée mon club de marche, mes amis le rejoignent, on valide
  nos séances ensemble. »
- **DOC / CODE / TEST.** À spécifier (rôles club : créateur/membre), câbler
  création/adhésion + session QR, tester.

### S4 — Jeux Zora
- **Tables.** `zora_games`, `zora_game_plays` (`server_seed`, `points_won`),
  `zora_game_prizes`, `zora_quiz_questions`, `zora_games_global_cap`,
  `zora_earn_rules`, `zora_category_caps`.
- **Parcours.** Jouer (roue / grattage / coffre / quiz) → gain **provably fair**
  (server_seed) → écriture `zora_game_plays` + `zora_ledger` → solde + palier.
- **Points de contrôle.** Caps par catégorie, cap global, anti-fraude, graine serveur.
- **Vue utilisateur.** « Je joue, je gagne des Zora, mon solde monte vraiment. »
- **DOC / CODE / TEST.** ❌ Prouvé **fantôme** (aucune écriture) → correctif en cours,
  à re-prouver par l'audit.

### S5 — Récompenses & économie Zora
- **Tables.** `zora_points` (`balance`, `tier`), `zora_ledger` (`expires_at`),
  `zora_rewards`, `zora_vouchers`, `zora_partners`, `leaderboard_weekly`,
  `user_streaks`, `zora_tiers_config`.
- **Parcours.** Solde → catalogue récompenses partenaires (MFR) → échange → voucher →
  utilisation chez le partenaire. Paliers Kimia/Liboso/Nkembo/Elonga.
- **Points de contrôle.** **MFR pur** (aucun cash-out MoMo), expiration (rolling
  12 mois recommandé), leaderboard = visibilité communautaire.
- **Vue utilisateur.** « J'échange mes points contre des avantages réels, je vois mon
  rang. »
- **DOC / CODE / TEST.** À spécifier l'expiry, câbler échange→voucher, tester.

### S6 — Parcours de soin (RDV → consult → ordonnance → délivrance)
- **Tables.** `appointments`, `time_slots`, `doctor_availabilities`, `queue_entries`,
  `file_attente`, `pre_rdv_formulaires`, `appointment_symptoms`,
  `consultation_reports`, `prescriptions`, `lab_prescriptions`, `lab_results`.
- **Parcours.** RDV → file/session → consultation → dossier → ordonnance/analyses.
- **Points de contrôle.** **Code de session** (téléconsult Jitsi), file d'attente, QR.
- **Vue utilisateur.** « Je prends RDV, je consulte, je récupère mon ordonnance / mes
  résultats. »
- **DOC / CODE / TEST.** Détaillé dans le cadrage prescription + interconnexions
  (N2/N3/N4). Tester en parcours inter-rôles.

### S7 — Professionnels : interactions & contrôles
- **Tables.** `doctors`, `secretaires`, `pharmacies`, `laboratories`, `clinics`,
  `doctor_payouts`, `qr_tokens`.
- **Interactions.** Secrétaire ↔ médecin (agenda, file) ; médecin → pharmacie
  (ordonnance) ; médecin → labo (analyses) ; labo/pharmacie → patient (résultats,
  délivrance).
- **Points de contrôle.** **QR codes** (présence patient, retrait pharmacie,
  validation), **codes de session**, anti-fraude (`qr_tokens`, `fraud_signals`).
- **Vue utilisateur (pro).** « Je valide une présence/un retrait par QR, sans
  ambiguïté ni fraude. »
- **DOC / CODE / TEST.** Cartographier chaque QR/code de session : où il est généré,
  où il est scanné, ce qu'il valide. Tester chaque contrôle.

### S8 — Amina (AI Consult)
- **Tables.** `ai_consult_sessions`, `consultation_reports`.
- **Parcours pro.** Briefing patient → brouillon SOAP → suggestions d'ordonnance →
  **le professionnel reste décideur et valide**.
- **Points de contrôle.** Périmètre d'accès aux données (consentement), journalisation,
  voix féminine en production (TTS).
- **Vue utilisateur.** « Une assistante prépare ma consultation et fait gagner du temps
  au médecin. »
- **DOC / CODE / TEST.** Spécifier le périmètre données + garde-fous (jamais de
  décision médicale autonome), tester les suggestions et leur validation humaine.

### S9 — Catalogue SSP & tarification
- **Tables.** `ssp_catalog`, `medicaments_catalogue`, `catalogue_pharmacie`,
  `platform_config` (les prix/taux).
- **Parcours.** Liste des **SSP** (soins/services de santé primaires) avec **prix
  affichés** ; gratuit au point de service (l'abonnement couvre).
- **Points de contrôle.** **Tous les tarifs viennent de `platform_config`**, jamais
  en dur. Cohérence prix catalogue ↔ config.
- **Vue utilisateur.** « Je vois quels services existent et leur valeur, et ils sont
  couverts par mon abonnement. »
- **DOC / CODE / TEST.** Spécifier la structure SSP + source de prix, câbler
  l'affichage depuis la config, tester l'absence de prix codé en dur.

---

## Mécanismes transverses (à unifier)

- **QR codes** — `qr_tokens`, `elonga_checkin_tokens`. Mêmes briques pour : check-in
  événement, retrait pharmacie, présence consultation, session sport. À documenter
  comme **un seul système QR** (génération, durée de vie, scan, action validée).
- **Codes de session** — téléconsultation, validation d'acte. Préciser génération +
  expiration.
- **Photo / identité** — capturée à l'onboarding ; sert de **preuve d'identité**
  (anti-usurpation d'abonnement). Décider si une vérification photo est requise à
  certains points (check-in, retrait).
- **Lieux / géolocalisation** — `latitude`/`longitude`/`address` sur `elonga_events`
  et établissements ; affichage carte + itinéraire côté patient.
- **Taxonomie de preuve anti-fraude** — `ground_truth` (QR), `system_event` (backend),
  `device_measured` (mobile Phase 2), `device_declared` (rejeté pour Zora). À appliquer
  uniformément à toute attribution de Zora.

---

## Rappel — ce qui est déjà prouvé fantôme (à corriger en priorité)

- Jeux Zora (S4) — aucune écriture en base.
- Inscription événement (S2) — aucune écriture.
- Constantes médicales (S1/dossier) — aucune écriture.
Correctifs en cours ; à re-prouver par l'audit avant de bâtir le reste dessus.

---

## Ordre chirurgical proposé

L'engagement (S2/S3/S4/S5) est le plus gros bloc **et** le plus touché par les
fantômes ; l'identité (S1) est la porte d'entrée de tout. Proposition :

1. **S1 — Inscription & identité** (la porte ; rien ne vaut sans elle, et la photo
   conditionne l'anti-fraude des points de contrôle).
2. **S2 — Événements + check-in QR + Zora** (le point où lieu + QR + Zora + notif
   convergent ; corrige le fantôme le plus visible).
3. **S3 — Clubs** puis **S4/S5 — Jeux & récompenses** (compléter la boucle d'engagement).
4. **S6/S7 — Soin & professionnels** (le cadrage prescription en est l'amorce).
5. **S8 — Amina**, **S9 — SSP/prix** (couches d'assistance et de catalogue).

Chaque système suit la chaîne de `METHODE_BOLAMU.md` : cadrage → câblage contract-first
→ UI liée → audit de persistance → gate. Un système n'est « fait » que DOC + CODE +
TEST au vert.
