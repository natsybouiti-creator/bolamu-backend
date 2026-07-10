# BUGS - BOLAMU BACKEND

**Dernière mise à jour :** 11 juillet 2026

---

## BUGS CRITIQUES (BLOQUANTS)

### BUG-001: Authentification API - Login ne fonctionne pas
**Sévérité :** 🔴 CRITIQUE
**Module :** Authentification
**Description :** L'endpoint `/api/v1/auth/login` ne retourne pas de token valide pour le compte de test (+242069735418 / TestNouveau2026!)
**Impact :** Empêche tous les tests UI nécessitant une authentification
**Statut :** ✅ CORRIGÉ (11 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 21 juin 2026
**Correction appliquée :** Le code de login (`auth.controller.js`) était correct — compte existant, actif, non banni. Cause réelle : dérive de données, le hash bcrypt stocké ne correspondait plus au mot de passe documenté (probablement écrasé par un run de test antérieur). Mot de passe du compte de test réinitialisé à `TestNouveau2026!` via `scripts/reset-patient-password.js` (script déjà existant dans le repo pour cet usage). Vérifié : `bcrypt.compare` retourne `true`.

---

### BUG-002: Navigation par selectors textuels non fonctionnelle
**Sévérité :** 🔴 CRITIQUE
**Module :** Frontend - Dashboard Patient
**Description :** Les selectors `button:has-text("Gagner")`, `button:has-text("Suivre")`, `button:has-text("Récompenses")` ne trouvent pas les éléments
**Impact :** Empêche la navigation entre les onglets du dashboard
**Statut :** ✅ CORRIGÉ (déjà résolu, non daté précisément — confirmé le 11 juillet 2026)
**Assigné à :** Cascade (redesign antérieur)
**Date découverte :** 21 juin 2026
**Correction appliquée :** Déjà résolu par le redesign qui a fait de `dashboard-v3-design.html` le dashboard principal (23 juin, cf. BUG-004). Les boutons de nav portent désormais `data-testid` stables (`nav-gagner`, `nav-suivre`, `nav-recompenses`) et `tests/patient-dashboard.spec.js` les utilise déjà. Rien à corriger, doc seule était en retard.

---

### BUG-003: Bottom nav non visible en mobile
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** La classe `.bottom-nav` n'est pas visible lorsque la viewport est réduite à 375px
**Impact :** Navigation mobile non fonctionnelle
**Statut :** ✅ CORRIGÉ (déjà résolu, confirmé le 11 juillet 2026)
**Assigné à :** Cascade (redesign antérieur)
**Date découverte :** 21 juin 2026
**Correction appliquée :** `dashboard.html` (ex `dashboard-v3-design.html`) a `.bottom-nav { display: none; }` par défaut puis `@media (max-width: 880px) { .bottom-nav { display: flex !important; } }` — comportement correct, couvre 375px. Rien à corriger, doc seule était en retard.

---

### BUG-004: Gestion token invalide non gracieuse
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** Lorsqu'un token invalide est injecté dans localStorage, la page ne redirige pas vers login et n'affiche pas de message d'erreur
**Impact :** Mauvaise UX en cas de session expirée
**Statut :** ✅ CORRIGÉ (23 juin 2026)
**Assigné à :** Cascade
**Date découverte :** 21 juin 2026
**Correction appliquée :** `dashboard-v3-design.html` devient le dashboard patient principal, avec intercepteur 401 global (redirection automatique vers login sur token invalide/expiré). Commit `41386fb`.

---

### BUG-005: Bouton profil non trouvé
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** Le bouton profil avec initiales "AN" n'est pas trouvé via selector textuel
**Impact :** Empêche l'accès à la page profil
**Statut :** ✅ CORRIGÉ (déjà résolu, confirmé le 11 juillet 2026)
**Assigné à :** Cascade (redesign antérieur)
**Date découverte :** 21 juin 2026
**Correction appliquée :** Le bouton porte désormais `id="navbar-patient-avatar"` + `data-testid="btn-profil"`, déjà utilisé par `tests/patient-dashboard.spec.js`. Rien à corriger, doc seule était en retard.

---

## BUGS MINEURS (NON BLOQUANTS)

### BUG-006: Icône chat non trouvée
**Sévérité :** 🟡 FAIBLE
**Module :** Frontend - Dashboard Patient
**Description :** L'icône forum pour ouvrir le drawer chat n'est pas trouvée
**Impact :** Fonctionnalité chat non testable
**Statut :** ✅ CORRIGÉ (déjà résolu, confirmé le 11 juillet 2026)
**Assigné à :** Cascade (redesign antérieur)
**Date découverte :** 21 juin 2026
**Correction appliquée :** L'icône Material Symbols `forum` est présente (header + état vide du chat) et `tests/patient-dashboard.spec.js` la cible déjà via `.material-symbols-outlined` + `hasText: 'forum'`. Rien à corriger, doc seule était en retard.

---

### BUG-007: Subscriptions multiples actives pour un même patient
**Sévérité :** 🟠 MOYEN
**Module :** Backend - Subscriptions
**Description :** Les runs de test empilent des subscriptions actives sans désactiver les précédentes. Le patient +242069735418 a 3 subscriptions 'active' simultanées.
**Impact :** Incohérence de données - un patient ne devrait avoir qu'UNE subscription active
**Statut :** ✅ CORRIGÉ (11 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 30 juin 2026
**Correction appliquée :** La plupart des points de création de subscription désactivaient déjà l'ancienne (`admin.routes.js`, `payment.routes.js`, `airtel/momo.routes.js handlePaymentSuccess`, `bank-transfer.routes.js`). 4 points ne le faisaient pas — `agence.routes.js` (3 sites : inscription manuelle, inscription+paiement, import en masse) et `agent.routes.js` (`/inscrire-patient`) — corrigés en ajoutant `UPDATE subscriptions SET is_active=FALSE, status='expired' WHERE patient_phone=$1 AND is_active=TRUE` avant chaque `INSERT`. Data existante nettoyée : 3 comptes avaient effectivement des doublons actifs en base (`+242069000099` ×4, `+242068500020` ×2, `+242069999003` ×3) — un seul abonnement (le plus récent) gardé actif par compte, les autres passés à `expired`. Le compte +242069735418 cité dans le bug original n'avait déjà plus de doublon au moment de la vérification.

---

### BUG-008: handlePaymentSuccess n'écrit pas historique_abonnements pour upgrades
**Sévérité :** 🟠 MOYEN
**Module :** Backend - Paiements
**Description :** Lorsqu'un paiement upgrade est confirmé via webhook MoMo/Airtel, handlePaymentSuccess crée un nouvel abonnement mais n'écrit pas dans historique_abonnements. L'historique des upgrades est donc incomplet.
**Impact :** Historique d'audit manquant pour les upgrades payants
**Statut :** ✅ CORRIGÉ (11 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 1 juillet 2026
**Correction appliquée :** Corrigé dans `payment.routes.js POST /confirm/:reference` — le vrai flux de paiement en production (modèle manuel : patient paie sur numéro marchand → admin valide depuis le dashboard, cf. CLAUDE.md `/payment-specialist`). Réutilise la colonne `payment_type` déjà existante sur `payments` (déjà acceptée en entrée par `POST /initiate`, jamais exploitée) au lieu d'ajouter une nouvelle colonne : si `payment_type = 'upgrade'`, l'ancien plan actif est capturé avant désactivation puis `historique_abonnements` est écrit après le `COMMIT` (hors transaction critique, même pattern que `prorata.service.js`, non bloquant si l'insert échoue). `momo.routes.js`/`airtel.routes.js` (sandbox MTN/Airtel temps réel, non branché en usage production réel) volontairement non touchés — flux distinct et incohérent en l'état (`/request` insère dans `subscriptions` alors que `handlePaymentSuccess` lit `payments`), à traiter séparément si ce canal est un jour activé.

---

### BUG-009: Bouton notification animateur cassé
**Sévérité :** 🔴 CRITIQUE
**Module :** Frontend - Dashboard Animateur
**Description :** Les fonctions sendNotification() et sendClubNotif() envoient {message} mais le backend attend {message_type, params}. Le handler retourne 400 systématiquement. Les animateurs ne peuvent notifier aucun club.
**Impact :** Fonctionnalité critique inutilisable — les animateurs ne peuvent envoyer de messages WhatsApp à leurs clubs
**Statut :** ✅ CORRIGÉ (1 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 1 juillet 2026
**Recommandation :** Corrigé — les fonctions frontend envoient maintenant {message_type: 'bolamu_club_message', params: [nom_club, message]}.

---

### BUG-010: Comptage notification animateur non fiable
**Sévérité :** 🟠 HIGH
**Module :** Backend - Animateur Service
**Description :** notifyClub (animateur.service.js) incrémentait sentCount même quand l'envoi WhatsApp échouait. sendAutoMessage (whatsapp-web.service.js) retourne false en cas d'échec mais la valeur de retour n'était jamais vérifiée. Le try/catch de notifyClub ne pouvait jamais s'exécuter puisque sendAutoMessage ne throw jamais. Résultat : sent_count=1, failed_count=0 même avec un numéro fictif, signal trompeur pour l'animateur.
**Impact :** Un animateur pouvait croire avoir notifié son club alors que rien n'était parti. Comptage non fiable des notifications.
**Statut :** ✅ CORRIGÉ (1 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 1 juillet 2026
**Recommandation :** Corrigé — notifyClub vérifie maintenant explicitement le retour booléen de sendAutoMessage (const ok = await sendAutoMessage(...); if (ok) sentCount++; else { failedCount++; logger.warn(...) }). En même temps, le format de réponse du controller a été corrigé pour respecter le standard {success, data}. Fichiers modifiés : src/services/animateur.service.js + src/controllers/animateur.controller.js.

---

### BUG-011: Test S27 envoie un format incompatible à /zora/earn
**Sévérité :** 🟠 MOYEN
**Module :** Tests E2E - S27
**Description :** Le test appelle POST /zora/earn avec { phone, points, reason } mais la route exige { phone, action_type, proof_class, proof_reference } (voir src/routes/zora.routes.js). La requête échoue donc systématiquement en 400, et expect(zoraEarnRes.success).toBe(true) devrait faire échouer le test à cette étape -- à vérifier si c'était bien le cas en B1 ou si un autre mécanisme masquait l'échec.
**Impact :** Test S27 non fonctionnel - l'étape 4 (crédit Zora manuel) échoue systématiquement
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 1 juillet 2026
**Recommandation :** Corriger le test avec les vrais action_type/proof_class valides (consulter src/services/zora.service.js pour la liste des action_type acceptés par awardZora avant de choisir des valeurs). Traité en B2, pas dans ce chantier harnais.

---

### BUG-012: zora_rewards / zora_partners ne peuvent pas être purgées sans casser 2 dépendances vivantes
**Sévérité :** 🟡 DETTE TECHNIQUE (rien n'est cassé aujourd'hui, mais bloque une purge prévue)
**Module :** Backend - Système bon Zora / Clearing admin
**Description :** `zora_rewards` et `zora_partners` sont les tables d'un ancien système (`zora_vouchers`) remplacé par `partner_bons_zora`. La plupart des fichiers qui les référencent sont morts (voir GET /partenaire/stats et /partenaire/validations, neutralisés en 410 Gone — commit `9322e5c`), mais **2 dépendances vivantes bloquent un `DROP TABLE`** :
1. `src/routes/clearing.routes.js:487` — `GET /clearing/bons-zora/pending` (montée sur `/api/v1/clearing`, `server.js:203`), **réellement appelée par `public/admin/dashboard.html:2224,2252,2264`** pour la gestion des règlements/virements aux partenaires bon Zora (`LEFT JOIN zora_partners zp ON zp.phone = bzr.partner_phone` pour afficher `partner_name`). Un `DROP TABLE zora_partners` casserait cette route immédiatement (`relation does not exist`), même en `LEFT JOIN`.
2. `src/jobs/abonnement.job.js:212-242` — étape 7 du cron `jobAbonnement` (démarré sans condition dans `server.js:360`, donc actif en prod), rappel WhatsApp "voucher expire dans 48h" sur `zora_vouchers`/`zora_rewards`/`zora_partners`. Encapsulée dans un `try/catch` local — ne ferait pas planter le job, mais générerait une erreur silencieuse à chaque exécution.
**Impact :** Aucun aujourd'hui (les tables existent encore). Bloque la purge prévue de `zora_rewards`/`zora_partners` tant que ces 2 points ne sont pas traités.
**Statut :** ✅ CORRIGÉ (10 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 9 juillet 2026
**Correction appliquée :** (1) `clearing.routes.js` sourcé sur `users.full_name` via jointure sur `partner_phone` au lieu de `zora_partners` ; (2) étape 7 de `abonnement.job.js` (rappel voucher 48h, système `zora_vouchers` jamais mis en prod) retirée — commit `53dc209`. Purge effective de `zora_rewards`/`zora_partners` et du code mort associé (`zora-marketplace.service.js`, `zora-voucher.service.js`, `partenaire.controller.js`) — commit `84187db`.

---

### BUG-013: dossier-qr retiré temporairement — flux DMN scan/vérification jamais spécifié
**Sévérité :** 🟡 DETTE TECHNIQUE / DONNÉES DE SANTÉ (retiré préventivement, rien n'était exposé, mais aucun flux fiable n'existe pour le remplacer)
**Module :** Frontend - Dashboard Patient / DMN (BHP v1.2)
**Description :** `public/patient/dashboard.html:899` contenait un `<div id="dossier-qr">` statique dans la "carte membre" (panel Suivre → Dossier médical), jamais peuplé par aucune fonction JS (`A.renderQR()` existe et fonctionne pour 6 autres QR, mais n'était jamais appelée avec cet id). Retiré (commit à venir) plutôt que branché sur un flux mal défini, vu la sensibilité des données de santé en jeu.
Audit des 3 mécanismes QR existants avant décision — aucun n'est un match sûr :
1. **QR identification** (`hero-qr` / `GET /qr/generate` + `GET,POST /qr/verify`) — fonctionnel, mais n'expose aucune donnée de santé (identité, statut abonnement, convention).
2. **QR urgence** (`urg-qr` / `GET /qr/emergency/generate` + `GET /qr/urgence`) — fonctionnel, expose allergies/groupe sanguin/traitements, scan **public sans authentification** (conçu pour une urgence réelle), notifie le contact d'urgence à chaque scan.
3. **QR DMN** (`dmn-qr-med`, bouton "Générer mon QR médical", `GET /api/v1/dmn/qr-payload`) — **génère un JWT signé (type `dmn_qr`) mais aucune route ne le vérifie jamais**. `grep` exhaustif de `dmn_qr`/`QR_TOKEN_TYPE` dans tout le repo : 0 route de vérification. L'`acces_url` embarquée dans le payload (`https://bolamu.co/patient/dossier?qr=1&p=...`) pointe vers une page qui n'existe pas (ni fichier statique, ni route serveur). **Ce QR, déjà en production, ne peut être scanné-et-exploité par personne aujourd'hui.**
Découverte associée : **`dmn_access_log` et `dossier_access_log` sont deux tables de traçabilité d'accès au dossier distinctes, jamais réconciliées** (`dmn.service.js` écrit dans la première, `consultation-report.controller.js:logDossierAccess` — utilisée par le flux urgence — écrit dans la seconde). Même pattern de duplication que le classement Zora et les vouchers déjà documentés (BUG-012).
**Impact :** Aucune régression (l'élément retiré n'a jamais fonctionné). Fonctionnalité "accès dossier via QR" absente de la carte membre en attendant une vraie spécification.
**Statut :** ✅ CORRIGÉ (10 juillet 2026) — vérifié le 11 juillet 2026, avec 2 réserves ci-dessous
**Assigné à :** Cascade
**Date découverte :** 9 juillet 2026
**Correction appliquée :** Flux complet d'accès au dossier médical via QR implémenté — `GET /api/v1/dmn/verify` vérifie le token (type `dmn_qr`, rejette tout autre type), le rôle (`pharmacie`/`doctor`/`laboratoire` uniquement, jamais de scan anonyme), l'expiration (410 si expiré), logue l'accès, et le scan est réellement branché côté frontend dans les 3 dashboards professionnels (`medecin`, `pharmacie`, `laboratoire`) — commit `4f598e8`. Vérification du 11 juillet : le flux fonctionne bien de bout en bout, sans dépendre de l'`acces_url` mort (voir réserve ci-dessous).
**Réserve 1 (non corrigée) :** `dmn_access_log` et `dossier_access_log` restent deux tables de traçabilité distinctes, jamais réconciliées, comme documenté à la découverte initiale. Confirmé toujours vrai le 11 juillet (`dmn.service.js`/`dmn.routes.js` écrivent/lisent `dmn_access_log` ; `consultation-report.controller.js`, `constantes-medicales.controller.js`, `lab.controller.js`, `qr.controller.js` écrivent `dossier_access_log`). Sans impact fonctionnel aujourd'hui, dette technique inchangée.
**Réserve 2 (voir BUG-015, corrigé) :** l'absence de contrôle de consentement BHP v1.2 avant l'exposition du dossier complet à un professionnel scanneur a été documentée séparément puis corrigée — voir BUG-015.

---

### BUG-015: Scan QR dossier DMN par un professionnel — aucun contrôle de consentement BHP v1.2
**Sévérité :** 🔴 CRITIQUE / DONNÉES DE SANTÉ (non corrigé — trouvé en vérifiant BUG-013, volontairement pas patché sans validation explicite vu la sensibilité)
**Module :** Backend - DMN (BHP v1.2) / Conformité
**Description :** `GET /api/v1/dmn/verify` (`dmn.routes.js:184`) authentifie correctement le professionnel scanneur (rôle + token + expiration) puis appelle `getFullDossier()` (`dmn.service.js:20`) qui retourne **sans aucune vérification de consentement** : constantes médicales complètes (groupe sanguin, allergies, maladies chroniques, antécédents, traitements en cours), 5 dernières consultations, documents, actions wellness. Aucune requête vers une table `consentements` n'existe dans `dmn.service.js`. CLAUDE.md `/compliance-officer` exige pourtant : "Accès conditionnel par consentement granulaire" et "/compliance-officer valide TOUJOURS en dernier avant tout accès nouveau" pour toute donnée médicale.
**Impact :** N'importe quel pharmacien/médecin/labo authentifié qui scanne le QR dossier d'un patient (généré par ce même patient, valable 24h) accède à l'intégralité de son dossier de santé sans que le patient ait explicitement consenti à CE scan précis — seule la génération initiale du QR par le patient vaut consentement implicite global, pas granulaire par accès.
**Statut :** ✅ CORRIGÉ (11 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 11 juillet 2026 (lors de la vérification de BUG-013)
**Correction appliquée :** La table `consentements` mentionnée dans CLAUDE.md n'existe pas — la vraie table BHP existante est `patient_consents` (4 types déjà gérés via `consent.routes.js` : `ordonnances`, `prescriptions_labo`, `historique_medecin`, `stats_employeur`, jamais réellement vérifiés nulle part avant ce fix). Modèle retenu : générer le QR (`GET /dmn/qr-payload`) est l'acte de consentement explicite du patient — `dmn.service.js::generateQRPayload()` enregistre désormais `granted=true` pour `consent_type='dmn_qr_scan'` à chaque génération. `GET /dmn/verify` (`dmn.routes.js`) vérifie ce consentement via `hasDmnQrConsent()` avant d'appeler `getFullDossier()` — 403 si absent ou révoqué. `dmn_qr_scan` ajouté aux types valides de `consent.routes.js` : le patient peut donc révoquer l'accès à tout moment via `DELETE /api/v1/consent/dmn_qr_scan`, ce qui bloque immédiatement tout scan même avant l'expiration naturelle du JWT (24h) — capacité de révocation qui n'existait pas du tout avant. Champ `acces_url` mort (pointait vers une page jamais créée) retiré du payload signé au passage. Testé en base réelle : génération → consentement `true` ; révocation → `false` ; ré-génération → `true`. Aucune UI de gestion des consentements ajoutée côté frontend (hors périmètre) — `GET /api/v1/consent` existant permet déjà de lister ses consentements si une UI est construite plus tard.

---

## BUGS CORRIGÉS (HISTORIQUE)

### BUG-014: Production down — migration_072 rejouée en boucle au démarrage (crash-loop)
**Sévérité :** 🔴 CRITIQUE (production réellement en panne)
**Module :** Backend - Système de migration automatique
**Description :** `migration_072_add_zora_balance_check.sql` (`ALTER TABLE zora_points ADD CONSTRAINT zora_points_balance_check CHECK (balance >= 0)`) avait été appliquée manuellement en test réel (étape 3 de son propre commit `b96aaf8`, `UPDATE ... SET balance = -100` pour vérifier le rejet), mais **la ligne correspondante n'a jamais été insérée dans `migrations_applied`**. Au démarrage suivant, le système de migration automatique a retenté `migration_072`, provoqué `ERROR: constraint "zora_points_balance_check" already exists`, et crashé en boucle — service en ligne indisponible.
**Impact :** Panne de production complète jusqu'à correction.
**Statut :** ✅ CORRIGÉ
**Assigné à :** —
**Date découverte :** 10 juillet 2026
**Correction appliquée :**
1. Vérifié `SELECT * FROM migrations_applied WHERE filename LIKE '%072%'` → 0 ligne (cause confirmée), et `pg_constraint` → contrainte bien présente et correcte (`CHECK ((balance >= 0))`).
2. **Insertion manuelle en production** : `INSERT INTO migrations_applied (filename, applied_at) VALUES ('migration_072_add_zora_balance_check.sql', NOW())` — ligne `id=51`. Intervention manuelle directe en base, à noter explicitement pour toute personne qui consulterait l'historique des migrations plus tard : ce n'est pas le système automatique qui a créé cette ligne.
3. Fichier de migration rendu idempotent (`DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`) pour qu'un rejeu futur sur un autre environnement (ou après une nouvelle désynchronisation de `migrations_applied`) ne fasse plus jamais crasher le serveur.
**Recommandation pour l'avenir :** Ne jamais exécuter manuellement en prod le DDL d'un fichier de migration pas encore marqué dans `migrations_applied` (même pour un test rapide) sans soit (a) insérer la ligne `migrations_applied` dans la même opération, soit (b) écrire le DDL sous forme idempotente dès le départ.

---

## STATISTIQUES

- **Total bugs :** 15
- **Ouverts :** 1 (BUG-011 — test E2E, hors périmètre des sessions de correction backend/frontend/données)
- **Dette technique ouverte :** 0
- **Corrigés :** 14 (BUG-001, BUG-002, BUG-003, BUG-004, BUG-005, BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, BUG-012, BUG-013, BUG-014, BUG-015)

---

*Document généré automatiquement suite aux tests Playwright*
