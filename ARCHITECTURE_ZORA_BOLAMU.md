# ARCHITECTURE_ZORA_BOLAMU.md

> ✅ **STATUT DE CE DOCUMENT** : ce document décrit **l'existant réel** — backend, frontend, base de données — vérifié dans le code au 7 juillet 2026. Il remplace l'ancienne version "spécification cible" (schéma `zora_wallets`/`zora_offers`/`zora_campaigns` qui n'a jamais existé en base). Chaque affirmation ci-dessous est sourcée par un fichier exact. Le contenu qui reste un objectif futur non implémenté est regroupé en fin de document, section 16 "Roadmap / non implémenté à ce jour" — il ne doit pas être confondu avec l'existant.

**Version 2.0 — 7 juillet 2026 — Réécriture intégrale sur base du code réel**
**Sources : `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5 et §3, lecture directe de `src/services/zora.service.js`, `src/services/bon-zora.service.js`, `src/routes/*.js`, `public/*/dashboard.html`.**

| Version | Date | Modifications |
|---|---|---|
| 1.0 | Juillet 2026 | Version initiale (vision produit, jamais implémentée telle quelle) |
| 1.1 | Juillet 2026 | Ajout de sections vision supplémentaires (19-23) |
| 2.0 | 7 juillet 2026 | Réécriture intégrale : documente l'existant réel vérifié dans le code, déplace tout ce qui n'est pas implémenté en section Roadmap |
| 2.1 | 10 juillet 2026 | Clôture du Chantier 3 (§7.5) : flux bon Zora + WhatsApp + QR partenaire confirmé complet et testé de bout en bout. Incident police Plus Jakarta Sans/`FONTCONFIG_FILE` documenté et résolu (§7.6). `dossier-qr` retiré des points ouverts du Chantier 3 : repris par le flux DMN (`GET /api/v1/dmn/qr-payload`), sans rapport avec les bons Zora (§12.1) |
| 2.2 | 12 juillet 2026 | Audit et correction de la chaîne de mise à jour du solde Zora après action patient (§3.4) : règles manquantes `zora_earn_rules` pour Roue/Coffre/Quiz, deadlock inter-connexion sur `zora_points`, silence sur échec de crédit consultation, resynchronisation frontend absente. Score Bolamu documenté pour la première fois (§3.5) : corrélation Zora existante (composante "Régularité Zora") mise en évidence côté frontend, 2 composantes sur 5 corrigées (Assiduité RDV, Engagement Elonga — tables/filtres ne captaient jamais de données réelles). Corrige une inexactitude préexistante en §3.3 (`scoreBolamu` n'appelle pas `awardZora()`) |

---

## Table des matières

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Acteurs du système](#2-acteurs-du-système)
3. [Flux EARN — Gain de points (réel)](#3-flux-earn--gain-de-points-réel)
4. [Flux BURN — Dépense de points (réel)](#4-flux-burn--dépense-de-points-réel)
5. [Marketplace — Offres et programmes partenaires (réel)](#5-marketplace--offres-et-programmes-partenaires-réel)
6. [Tiers Zora — Niveaux réels](#6-tiers-zora--niveaux-réels)
7. [Flux digital complet — Bon d'achat et validation (réel, avec ses ruptures)](#7-flux-digital-complet--bon-dachat-et-validation-réel-avec-ses-ruptures)
8. [Feed social et Zora](#8-feed-social-et-zora)
9. [Modèle économique](#9-modèle-économique)
10. [Schéma base de données (réel)](#10-schéma-base-de-données-réel)
11. [Architecture backend — Fichiers réels](#11-architecture-backend--fichiers-réels)
12. [Architecture frontend — Par dashboard (réel)](#12-architecture-frontend--par-dashboard-réel)
13. [Règles métier et anti-fraude (réel)](#13-règles-métier-et-anti-fraude-réel)
14. [Notifications (réel)](#14-notifications-réel)
15. [Administration et configuration (réel)](#15-administration-et-configuration-réel)
16. [Dette technique et zones floues](#16-dette-technique-et-zones-floues)
17. [Roadmap / non implémenté à ce jour](#17-roadmap--non-implémenté-à-ce-jour)
18. [Glossaire](#18-glossaire)

---

## 1. Vision et positionnement

**Bolamu est le système nerveux des programmes de fidélité santé au Congo.** Les patients gagnent des **Zora Points** en prenant soin de leur santé et de leur bien-être ; ils les dépensent chez des partenaires via des bons numériques. Ce principe reste la vision produit valide — mais son implémentation réelle est plus simple que ce que décrivait la version 1.1 : un seul mécanisme de burn (bons Zora à coût fixe), pas de marketplace multi-types (gift card / discount / offer access), pas de campagnes bonus, pas de multiplicateur de tier sur le gain.

---

## 2. Acteurs du système

Rôles réels en base (`SELECT DISTINCT role FROM users`, cf. modèle de données §0) qui interagissent avec Zora aujourd'hui :

- **Patient** : gagne des points (`awardZora()`), consulte son solde (`GET /zora/balance`), génère des bons (`POST /bons-zora/generate`), consulte son historique (`GET /zora/ledger`).
- **Médecin, pharmacie, laboratoire, animateur** : déclenchent indirectement des crédits Zora via leurs actions métier respectives (voir section 3) — jamais via un appel Zora direct depuis leur dashboard.
- **Pharmacie / laboratoire** (dashboards `pharmacie/dashboard.html`, `laboratoire/dashboard.html`) : tentent de valider des bons Zora via un bouton "Vérifier" — flux **cassé**, voir section 7 et 16.
- **Rôle `partenaire`** (`partenaire.routes.js`, `partenaire/dashboard.html`) : existe dans le code, aligné avec le middleware `requirePartenaire` des routes `/bons-zora/validate*`, mais **0 compte réel** en base à ce jour (modèle de données §0). Le dashboard `partenaire` liste les programmes (`GET /bons-zora/programs`) et affiche des stats (`GET /partenaire/stats`), sans formulaire de création de programme.
- **Admin** : ne gère aujourd'hui que le **règlement financier** des bons validés (`clearing.routes.js` → `/clearing/bons-zora/*`), pas la création ou l'approbation d'offres — il n'existe aucune interface de ce type.

Il n'existe **aucun rôle `reward_partner`/`health_partner`** en base — ces noms de rôle, mentionnés dans la v1.1 puis explicitement abandonnés par sa propre note (§19), n'ont jamais été implémentés.

---

## 3. Flux EARN — Gain de points (réel)

**Point d'entrée unique confirmé : `awardZora()` dans `src/services/zora.service.js:34`.** Aucune autre fonction ne crédite `zora_ledger` (confirmé par le modèle de données §1.5 : "insert-only confirmé").

### 3.1 Logique réelle de `awardZora({ phone, action_type, proof_class, proof_source, recording_method, proof_reference })`

Étapes exactes du code (`zora.service.js:34-260`) :

1. Charge la règle depuis `zora_earn_rules WHERE action_type = $1`. Si absente ou `is_active = FALSE` → refus silencieux (`{success:false, reason:'rule_unknown'|'rule_inactive'}`).
2. Contrôle de preuve : `proof_class = 'device_declared'` → **rejet total**. Hiérarchie réelle codée en dur (`ground_truth`:3, `system_event`:2, `device_measured`:1, `device_declared`:0) comparée à `rule.required_proof_class`. `device_measured` + `recording_method='manual_entry'` → rejet.
3. Idempotence : `SELECT COUNT(*) FROM zora_ledger WHERE action_type=$1 AND proof_reference=$2 AND points>0` → si déjà créditée, refus (`already_credited`). C'est la vraie mécanique d'idempotence, pas une contrainte UNIQUE explicite en base sur `proof_reference` seul (l'index réel est `(action_type, proof_reference) WHERE points > 0`, cf. modèle de données §1.5).
4. Plafond journalier : `rule.daily_cap` comparé au nombre de crédits du jour pour ce `phone`+`action_type`.
5. Plafond catégorie : **uniquement si `total_earned >= 500`**, compare la somme de la catégorie sur 12 mois glissants à `cap_percent` (depuis `zora_category_caps`) appliqué au nouveau total. En dessous de 500 points cumulés, **aucun plafond catégorie n'est appliqué**.
6. Crédit : `INSERT INTO zora_ledger` avec `rule.points` **tel quel, sans aucune multiplication** — puis `INSERT ... ON CONFLICT UPDATE` sur `zora_points` (balance recalculée par `SUM(points)` depuis le ledger, `total_earned` incrémenté).
7. Recalcul du tier : relit `zora_tiers_config` (via cache mémoire 5 min, `getTiersConfig()`), compare `total_earned` à `tier.min_points` pour chaque palier et prend le dernier atteint. **Le tier est réellement recalculé et persisté**, mais uniquement à des fins d'affichage/de badge — voir 3.2.
8. Audit : `INSERT INTO audit_log (event_type='zora_award', ...)`.
9. Effets non bloquants (hors transaction) : émission Socket.io `leaderboard_updated`, mise à jour du streak (`updateStreak()`), post automatique dans le feed pour certaines `action_type` (`bilan_annuel`, `vaccination`, `event_checkin`, `streak_7`, `streak_30` — `chatService.postAchievement()`).

### 3.2 Le tier est-il branché dans la logique earn, ou juste peuplé sans effet ?

**Réponse vérifiée : les trois tables (`zora_tiers_config`, `zora_earn_rules`, `zora_category_caps`) sont réellement lues et ont un effet réel** — `zora_earn_rules` détermine les points et les plafonds, `zora_category_caps` limite le gain par catégorie au-delà de 500 points cumulés, `zora_tiers_config` détermine le badge de palier affiché. **Mais contrairement à la v1.1 (§3.3, "multiplicateur de tier"), le tier n'a AUCUN effet multiplicateur sur les points crédités.** `rule.points` est inséré tel quel — il n'existe aucune colonne `multiplier` lue ni appliquée dans `awardZora()`. Le tableau "× 1.0 / × 1.2 / × 1.5 / × 2.0" de la v1.1 ne correspond à aucun code réel.

### 3.3 Appelants réels de `awardZora()`

Confirmé par le modèle de données §1.5 : `routes/clubs.routes.js`, `controllers/{clubs,qr}.controller.js`, `services/{event,notification,zora-voucher,zora-games,communityService,bon-zora,wellness,zora-marketplace,leaderboard}.service.js`, `routes/{admin,patient,elonga-events}.routes.js`, `cron/zora-expiration.js`. Autrement dit, le crédit Zora est déclenché depuis des points d'ancrage dispersés dans le code (clubs, QR, événements Elonga, jeux, encouragements), **pas** depuis une carte d'intégration centralisée façon "table 17.1" de la v1.1 — cette carte reste une bonne intention de documentation, pas un fait vérifié fichier par fichier dans le cadre de cette réécriture.

**Correction du 12 juillet 2026** : `scoreBolamu.service.js` était listé ici dans une version antérieure de ce document — vérifié inexact (grep exhaustif, zéro occurrence de `awardZora` dans ce fichier). La relation réelle entre Zora et le Score Bolamu est **unidirectionnelle et inverse** : le score *lit* `zora_ledger` (fréquence de gains, pas de crédit), il n'écrit jamais dedans. Voir §3.5.

### 3.4 Jeux Zora (scratch/wheel/chest/quiz) — règles manquantes et resynchronisation frontend, résolu le 12 juillet 2026

**Symptôme rapporté** : le solde Zora affiché ne se mettait pas à jour de façon fiable après une partie de jeu (grattage, roue, coffre, quiz).

**Cause confirmée par audit (lecture de code + tests HTTP/DB réels)**, deux bugs indépendants cumulés :

1. **`zora_earn_rules` n'avait de ligne active que pour `action_type='game_scratch'`.** `awardZora()` rejetait systématiquement `game_wheel`/`game_chest`/`game_quiz` (`reason:'rule_unknown'`, étape 1 de §3.1) — mais `zora-games.service.js` (`playGame()`/`submitQuizAnswer()`) **n'a jamais vérifié le retour de `awardZora()`** avant de répondre `success:true` avec un `points_won` correspondant au prix tiré, jamais réellement crédité. Preuve en base avant correctif : 3 parties de roue réelles gagnantes, 40 pts affichés au total, **zéro entrée `game_wheel` dans `zora_ledger`**.
2. **`consultation-report.controller.js`** (`submitReport()`, awardZora `action_type='consultation'`, cf. §7.5) capturait déjà le retour de `awardZora()` mais ne traitait que le cas succès — un échec (notamment `daily_cap_reached`, `zora_earn_rules.consultation.daily_cap = 1` : un seul crédit consultation par jour et par patient) passait totalement inaperçu, sans log ni trace.

**Corrections apportées** :
- `migration_080_zora_game_rules_missing.sql` : ajoute les 3 règles manquantes — `points` aligné sur le plafond de gain déjà défini par jeu dans `zora_games.daily_gain_cap` (wheel=50, chest=75, quiz=40), `daily_cap=3`, `category='engagement'`, `required_proof_class='system_event'` — identique au seul précédent existant (`game_scratch`).
- `zora-games.service.js` : le retour de `awardZora()` est désormais vérifié dans les deux fonctions ; `points_won` renvoyé au frontend reflète le crédit réel (0 si le crédit échoue), pas le prix tiré ; le message WhatsApp de gain n'est envoyé que si le crédit a réellement eu lieu ; échec loggé explicitement.
- **Effet de bord découvert en testant** : une fois les règles actives, l'appel à `awardZora()` (connexion/transaction séparée, cf. §3.1) entrait en **deadlock inter-connexion** avec la transaction de `playGame()` sur une partie `'paid'` gagnante — les deux verrouillaient la même ligne `zora_points` pour le même `phone`, chacune attendant l'autre indéfiniment. Corrigé en déplaçant l'appel à `awardZora()` **après** le `COMMIT` de la transaction de jeu (scratch/wheel/chest/quiz).
- `consultation-report.controller.js` : ajoute un log explicite (`raison=zoraResult.reason`) sur échec de crédit — le plafond `daily_cap=1` lui-même n'est pas modifié (comportement anti-abus voulu), seul le silence est corrigé.
- **Frontend** (`dashboard.html`) : `A.addZora(n)` incrémentait `A.state.zora`, une variable **jamais lue par `renderScalars()`** (qui affiche `.b-zoraTxt` à partir de `A._zoraBalance` uniquement, confirmé par preuve DOM réelle) — l'incrément optimiste après un jeu n'avait donc aucun effet visible à l'écran. `A.addZora()` déclenche désormais `A.syncZoraBalance()`, un vrai `fetch('/zora/balance')` qui met à jour `A._zoraBalance` et re-render.

**Non corrigé, hors périmètre de cette session** : le montant réellement crédité reste celui de la règle (`points` fixe), pas le prix affiché au joueur (`zora_game_prizes.points_value`, variable) — limitation déjà présente sur `game_scratch` avant ce correctif, étendue par construction aux 3 jeux nouvellement corrigés. Passer le montant réel à `awardZora()` nécessiterait de faire évoluer sa signature, utilisée par une dizaine d'appelants (§3.3) — non fait ici.

**Testé en conditions réelles** (compte QA) : partie de roue payante gagnante → `zora_ledger` contient une entrée `game_wheel` pour la première fois, solde cohérent, aucun deadlock. 2ᵉ compte-rendu de consultation le même jour → rapport enregistré normalement, `zora_ledger` reste vide (plafond respecté), log serveur explicite désormais présent.

### 3.5 Score Bolamu — corrélation avec Zora, rendu pleinement opérationnel le 12 juillet 2026

**Ce que c'est** : `src/services/scoreBolamu.service.js` (`calculerScoreBolamu()`), exposé via `GET /api/v1/patients/score-bienetre` (`patient.routes.js:165`), affiché à l'accueil du dashboard patient (`A._scoreBolamu`, anneau SVG + label). N'apparaissait dans aucune version antérieure de ce document.

**Composition réelle** — 5 composantes pondérées, tendance calculée vs période précédente :

| Composante | Poids | Source réelle | Fenêtre | Plafond |
|---|---|---|---|---|
| Assiduité RDV | 30% | `appointments` (`status='termine'` / `IN ('confirme','en_cours','termine')`) | 90 j | ratio plafonné à 100% |
| Engagement Elonga | 25% | `event_registrations` × `elonga_events` (`status='checked_in'`) | 90 j | 5 événements |
| Activité club | 20% | `club_members` (`is_active=true`) | 30 j (adhésions récentes) | 3 clubs |
| **Régularité Zora** | **15%** | `zora_ledger` (**nombre de transactions**, pas leur montant) | 30 j | 10 transactions |
| Suivi médical | 10% | `consultations` | 6 mois | 2 consultations |

**Corrélation avec Zora** : directe, via "Régularité Zora" — chaque ligne `zora_ledger` (jeux, consultations, événements, etc., cf. §3.1) compte pour la fréquence d'activité, indépendamment du nombre de points. Relation strictement unidirectionnelle (Zora → score) : `scoreBolamu.service.js` ne crédite jamais `zora_ledger` (voir correction §3.3).

**Bugs trouvés par audit et corrigés** :
- **Assiduité RDV (30%, le poids le plus important)** lisait une table `rendez_vous` — vérifié : **aucun code applicatif n'y écrit** (grep exhaustif, seulement 4 lignes de test manuelles trouvées) — toujours 0 pour n'importe quel patient réel. Remplacée par `appointments`, la vraie table utilisée par toute la plateforme. Le ratio lui-même était aussi incorrect (comparait deux ensembles de statuts mutuellement exclusifs, sans plafonnement à 100% contrairement aux 4 autres composantes) — corrigé au passage.
- **Engagement Elonga (25%)** filtrait sur `e.pillar = 'activite'` — vérifié : 33 des 40 événements réels en base utilisent `pillar='sport'` (le reste : nutrition/sante/anti_infectieux), et le seul check-in réel jamais enregistré dans toute la plateforme portait sur un événement `pillar='nutrition'`. Aucun check-in réel ne matchait donc jamais ce filtre. Filtre retiré.

**Confirmées correctes sans modification** (données réelles vérifiées, mêmes tables déjà auditées ailleurs dans ce document) : Activité club, Régularité Zora (capte automatiquement les nouveaux `game_wheel`/`game_chest` de §3.4, aucune modification nécessaire — la requête ne filtre pas par `action_type`), Suivi médical.

**Résultat** : score recalculé pour le compte QA (activité réelle la plus riche en base) passé de 0/0/100/100/100 (RDV et Elonga cassés) à 18/20/100/100/100 — score global 55/100, plus aucun plafonnement artificiel.

**Frontend** : la décomposition par composante, jusqu'ici calculée mais jamais affichée, est désormais visible à l'accueil sous le score global (`#score-composantes`, `A.renderScoreComposantes()`) — 5 mini-barres, celle de "Régularité Zora" mise en évidence en zora-gold (`#F5A623`) pour rendre visible la corrélation avec les Zora (Option A retenue — cf. audit du 12 juillet 2026 ; Option B, repondération de "Régularité Zora" par catégorie plutôt que par fréquence brute, restée en discussion, non implémentée).

---

## 4. Flux BURN — Dépense de points (réel)

**Un seul mécanisme actif aujourd'hui : `partner_programs` + `partner_bons_zora` via `src/services/bon-zora.service.js`.**

### 4.1 Confirmation : `zora_vouchers` n'est plus le système actif pour du burn patient

- `POST /api/v1/partenaire/voucher/validate` (`partenaire.routes.js:149`) renvoie explicitement **HTTP 410 Gone** avec le message *"Route dépréciée — utiliser /vouchers/*"* — mais **aucune route `/vouchers/*` n'est montée dans `server.js`** (vérifié : aucun `app.use(...vouchers...)`). Le message de dépréciation pointe vers une route qui n'existe pas ; le vrai successeur est `/bons-zora/*`.
- `GET /api/v1/partenaire/validations` (`partenaire.controller.js:35`, `getValidationsHandler`) lit encore `zora_voucher_validations` / `zora_vouchers` / `zora_rewards` — cette route reste câblée sur l'ancien système et ne verra donc **jamais** les validations `partner_bons_zora` récentes.
- Le cron `src/cron/zora-expiration.js:22` expire encore les lignes `zora_vouchers` actives (`UPDATE zora_vouchers SET status='expired' WHERE status='active' AND expires_at < NOW()`) — l'ancien système n'est pas mort en base, juste plus alimenté par aucun flux de génération patient actif identifié.
- **Aucun appel frontend** (patient, pharmacie, laboratoire, partenaire) ne cible `zora_vouchers`/`zora_rewards`/`zora-marketplace` aujourd'hui — confirmé par grep exhaustif sur `public/*/dashboard.html`.

### 4.2 Génération d'un bon Zora (réel) — `generateBonZora(patient_phone, program_id)` (`bon-zora.service.js:66`)

Appelée par `POST /api/v1/bons-zora/generate` (`bon-zora.routes.js:51`), elle-même appelée par `patient/dashboard.html:2838` (`{ program_id: r.id }`).

Transaction réelle :
1. `SELECT ... FROM partner_programs WHERE id=$1 AND is_active=TRUE FOR UPDATE` (verrou pessimiste).
2. Stock : `NULL` = illimité, sinon `stock <= 0` → `program_out_of_stock`.
3. `SELECT balance FROM zora_points WHERE phone=$1 FOR UPDATE` — solde insuffisant → `insufficient_balance`.
4. `UPDATE zora_points SET balance = balance - $1 WHERE phone=$2 AND balance >= $1` (débit conditionnel atomique — même pattern que la v1.1 décrivait pour `zora_wallets`, mais sur la vraie table `zora_points`).
5. Génération d'un code unique (`generateUniqueCode()`).
6. `INSERT INTO zora_ledger (..., points=-program.zora_cost, category='redemption', action_type='bon_zora_generation', proof_class='system_event', ...)` — la dépense est bien tracée dans le même ledger que le gain, avec un montant négatif.
7. `INSERT INTO partner_bons_zora (code, patient_phone, partner_id, zora_cost, qr_payload, fcfa_value, status, expires_at)` — insertion réelle du bon (`bon-zora.service.js:161-166`).

**Bug corrigé le 7 juillet 2026** : l'étape 7 utilisait `program_id`/`created_at`, deux colonnes inexistantes sur `partner_bons_zora` (introduites par erreur dans le commit `8c52cc7`, 2026-07-06, lors du renommage `voucher→bon_zora`). Conséquence réelle : **`POST /bons-zora/generate` échouait à 100% depuis cette date** (`column "program_id" of relation "partner_bons_zora" does not exist`) — un seul bon existe dans l'historique complet de la table avant ce correctif (`id=2`, `PART-MQU2N4W5`, généré le 2026-06-25, avant la régression — la mention précédente de ce document le présentant comme une preuve de test du 7 juillet était erronée). Corrigé le 7 juillet 2026 en alignant l'INSERT sur les vrais noms de colonnes (`partner_id`, `zora_cost`, `generated_at` — symétrique au correctif déjà appliqué côté lecture dans `getPatientBonsZora()`, commit `b36f1db`). Testé en HTTP réel le 7 juillet 2026 : `POST /bons-zora/generate` → `200 OK`, bon généré (`BOL-JZ97-2RHV`), solde débité correctement — preuve conservée dans `audit_log` (event `bon_zora_generated`, insert-only) ; le bon de test lui-même et sa ligne `zora_ledger` associée ont été supprimés après validation (nettoyage des données de test).

**Bug latent distinct trouvé pendant ce test, non bloquant, voir section 16** : désynchronisation de la séquence `partner_bons_zora_id_seq`.

### 4.3 Validation d'un bon Zora (réel, mais partiellement cassé côté pharmacie/laboratoire)

`validateBonZora(code, partner_phone, method)` (`bon-zora.service.js:218`), appelée par `POST /bons-zora/validate` et `POST /bons-zora/validate/qr` (`bon-zora.routes.js:95,123`, protégées par `requirePartenaire` = `req.user.role === 'partenaire'`).

Retour réel en cas de succès : `{ success: true, valid: true, patient_initiales, fcfa_value }` — **pas** `discount_value`, `patient_phone`, `reward_title`, `consumed_at` (voir section 7.3 pour la rupture frontend).

---

## 5. Marketplace — Offres et programmes partenaires (réel)

Pas de cycle de vie DRAFT → SUBMITTED → REVIEW → APPROVED décrit en v1.1 §5.1 : **aucune colonne de statut de ce type n'existe sur `partner_programs`** (schéma réel : `id`, `partner_id`, `name`, `description`, `zora_cost` NOT NULL, `fcfa_value`, `category`, `is_active` (bool, défaut `true`), `stock`, `created_at` — PK sur `id` uniquement, aucun CHECK, aucune FK, vérifié le 7 juillet 2026).

`GET /api/v1/bons-zora/programs` (`bon-zora.routes.js:35`, publique, pas d'auth) → `getProgramsByCategory()` (`bon-zora.service.js:387`) : `SELECT ... FROM partner_programs WHERE is_active = TRUE AND (stock IS NULL OR stock > 0) [AND category = $1] ORDER BY zora_cost ASC`.

> ⚠️ **[PÉRIMÉ — annoté le 20/07/2026]** Le paragraphe ci-dessous datait du 7 juillet 2026, **avant** le chantier « publication d'offres partenaires » (`migration_073`, 10/07/2026). Il est **faux aujourd'hui** : un CRUD complet d'offres (`POST`/`PUT`/`DELETE /bons-zora/programs`, `GET /programs/mine`, `/all`, `/:id`) existe et est câblé de bout en bout côté partenaires ET patient. Voir la **section 5bis** (ajoutée le 20/07/2026) qui fait foi.

**Il n'existe aucune route POST/PUT pour créer ou modifier un `partner_program`** dans tout `bon-zora.routes.js` — confirmé par grep des méthodes de routage. La seule façon d'alimenter cette table aujourd'hui est une **insertion SQL manuelle directe** (migration ou script), exactement la méthode employée le 7 juillet 2026 pour peupler le catalogue vide. Aucun flux de soumission par un partenaire, aucune validation admin — voir section 15.

---

## 5bis. Cycle de vie des offres partenaires — CRUD réel (section ajoutée le 20/07/2026)

> Cette section **fait foi** et **corrige** les §5 et §7.4 (rédigés le 7/07/2026, avant le chantier « publication d'offres partenaires »). Tout est vérifié ligne à ligne dans `src/routes/bon-zora.routes.js`, `src/services/bon-zora.service.js`, les migrations `partner_programs`, et les dashboards `public/*/dashboard.html`.

### 5bis.1 Ce qui a changé depuis la v2.1
- **`migration_073_partner_programs_identity.sql` (10/07/2026)** : `DROP COLUMN partner_id` ; `ADD COLUMN partner_phone VARCHAR(20) REFERENCES users(phone)` ; `ADD COLUMN image_url TEXT`. L'offre est désormais rattachée à son partenaire par **`phone`** (identifiant universel), plus par un `partner_id` entier sans FK.
- **CRUD complet** ajouté dans `bon-zora.routes.js` (routes) + `bon-zora.service.js` (`createProgram`/`updateProgram`/`deactivateProgram`/`getProgramById`/`getMyPrograms`/`getAllPrograms`).
- **Catalogue peuplé/nettoyé** : `migration_086` (suppression de 8 résidus de tests, encodage UTF-8 cassé), `migration_087` (photos des 3 offres santé), `migration_088`/`089` (offres démo commerciales fictives + photos). Les offres démo portent `partner_phone = NULL` (voir faille §5bis.5).

### 5bis.2 Schéma réel `partner_programs` (après `migration_073`)

| Colonne | Type | Note |
|---|---|---|
| `id` | SERIAL PK | — |
| `partner_phone` | VARCHAR(20) REFERENCES users(phone) | **propriétaire de l'offre** (NULL sur les offres seed/démo) |
| `name` | VARCHAR(100) | requis à la création |
| `description` | TEXT | optionnel |
| `zora_cost` | INTEGER NOT NULL | requis à la création |
| `fcfa_value` | INTEGER | optionnel |
| `category` | VARCHAR | texte libre, **aucun ENUM/CHECK** |
| `stock` | INTEGER | `NULL` = illimité ; décrémenté à chaque `generate` si non-NULL |
| `image_url` | TEXT | URL Cloudinary (`bolamu/partner_programs`) |
| `is_active` | BOOLEAN DEFAULT TRUE | soft-delete via `DELETE` (passe à `false`) |
| `created_at` | TIMESTAMPTZ | `NOW()` |

### 5bis.3 Endpoints réels (`bon-zora.routes.js`)

Middleware de rôle définis dans le fichier :
- `PARTENAIRE_ROLES = ['pharmacie','doctor','laboratoire','partenaire_commercial']` (`:36`) — **aucun compte `role='partenaire'`** ; les vrais rôles partenaires sont ceux-là.
- `requireProgramManager` = `PARTENAIRE_ROLES + ['admin']` (`:46-53`) — qui peut **gérer** des offres.

| Méthode | Route | Middleware | Comportement réel |
|---|---|---|---|
| GET | `/bons-zora/programs` | **public (pas d'auth)** | `getProgramsByCategory(category?)` : `WHERE is_active=TRUE AND (stock IS NULL OR stock>0) [AND category=$1] ORDER BY zora_cost ASC`. Champs : `id,name,description,zora_cost,fcfa_value,category,stock,created_at,image_url` |
| GET | `/bons-zora/programs/mine` | `authMiddleware`+`requireProgramManager` | `getMyPrograms(req.user.phone)` : **ses** offres (actives + désactivées), `WHERE partner_phone=$1` |
| GET | `/bons-zora/programs/all` | `authMiddleware` + check `role==='admin'` (403 sinon) | `getAllPrograms()` : toutes offres tous partenaires + `LEFT JOIN users` (`partner_name`,`partner_role`) |
| GET | `/bons-zora/programs/:id` | `authMiddleware` | `getProgramById(id)` : détail complet (inclut `partner_phone`,`is_active`). `404 program_not_found` |
| POST | `/bons-zora/programs` | `authMiddleware`+`requireProgramManager`+`upload.single('image')` | Crée l'offre. `400 missing_required_fields` si `!name || !zora_cost`. `owner = req.user.phone` ; **admin peut cibler** `req.body.partner_phone`. Image → Cloudinary. `201 {success,data}` |
| PUT | `/bons-zora/programs/:id` | idem POST | Modifie (whitelist). Ownership vérifiée (voir §5bis.5). `404`/`403 not_owner`/`400 no_fields_to_update` |
| DELETE | `/bons-zora/programs/:id` | `authMiddleware`+`requireProgramManager` | **Soft delete** : `is_active=FALSE`. `404`/`403 not_owner`. `{success:true}` |

> ⚠️ **Ordre de routes** : `/programs/mine` et `/programs/all` sont déclarées **avant** `/programs/:id` (`:83`,`:99`,`:117`) — sinon Express capturerait `"mine"`/`"all"` comme `:id` (piège documenté dans le code).

### 5bis.4 Comportement réel du service

- **`createProgram(data)`** (`:535`) : transaction `BEGIN`/`COMMIT`/`ROLLBACK`. `INSERT INTO partner_programs (partner_phone,name,description,zora_cost,fcfa_value,category,stock,image_url,is_active=TRUE,created_at=NOW())`. `parseInt` sur `zora_cost`/`fcfa_value`/`stock` côté route ; `fcfa_value`/`category`/`stock`/`image_url` acceptent `null`. **`audit_log` `partner_program_created`** (payload jsonb `{name,zora_cost,fcfa_value,category}`).
- **`updateProgram(id,requesterPhone,requesterRole,updates)`** (`:575`) : `SELECT ... FOR UPDATE`, contrôle propriété, whitelist `['name','description','zora_cost','fcfa_value','category','stock','image_url','is_active']` construite dynamiquement. **`partner_phone` n'est PAS dans la whitelist** → un partenaire ne peut jamais réassigner la propriété. `audit_log` `partner_program_updated`.
- **`deactivateProgram(id,...)`** (`:645`) : `SELECT ... FOR UPDATE`, contrôle propriété, `UPDATE ... SET is_active=FALSE` (jamais de suppression physique). `audit_log` `partner_program_deactivated`.

### 5bis.5 Sécurité & propriété (réponse directe à la question « comment empêcher un partenaire de modifier l'offre d'un autre »)

- **Qui crée** : `pharmacie`, `doctor`, `laboratoire`, `partenaire_commercial`, `admin` (`requireProgramManager`). Un patient reçoit `403 acces_reserve_gestionnaire_offres`.
- **Propriété à la création** : `partner_phone = req.user.phone` **forcé** ; seul l'`admin` peut créer pour autrui via `req.body.partner_phone` (`bon-zora.routes.js:143-146`).
- **Isolation modif/suppression** : `updateProgram`/`deactivateProgram` comparent `program.partner_phone !== requesterPhone` (sauf `role==='admin'`) → **`403 not_owner`** (`bon-zora.service.js:592-595`, `:662-665`). `SELECT ... FOR UPDATE` évite les races.
- **Non-réassignation** : `partner_phone` absent de la whitelist d'update → l'appartenance ne peut pas être transférée par un partenaire.
- **Isolation à la validation du bon** : `partner_bons_zora.partner_id` (= **l'`id` du programme**, pas du partenaire) est joint à `partner_programs.id` ; si `program.partner_phone` est renseigné et différent du partenaire qui scanne → **`403 bon_zora_wrong_partner`** (`bon-zora.service.js:279-282`).
- ✅ **Faille corrigée (20/07/2026)** : le contrôle de validation est désormais **fail-closed** (`if (!program || !program.partner_phone)` → `403 bon_zora_invalid_program`). Toute offre sans propriétaire est rejetée.
- 📝 **Attribution temporaire (20/07/2026)** : les 10 offres démo (IDs 1,2,3,13-19) ont reçu un `partner_phone` temporaire via `migration_093` :
  - IDs 1,3 → `+242060000123` (Dr. Test Bolamu)
  - IDs 2,13,14,15 → `+242069990020` (Partenaire Commercial Test)
  - IDs 16,17,18,19 → `+242090000004` (Test Partenaire E2E)
  - **À réassigner** quand les vrais comptes partenaires existeront (Pharmacie Daffé, Laboratoire 3A, Clinique Louise Michel, + 7 partenaires commerciaux).

### 5bis.6 Chaîne complète offre → bon → validation (bout en bout, vérifiée)

```
1. Partenaire crée l'offre    POST /bons-zora/programs  (owner = partner_phone)   → partner_programs
2. Patient voit le catalogue  GET  /bons-zora/programs  (public)                  ← is_active + stock>0
3. Patient ouvre le détail    GET  /bons-zora/programs/:id  (auth)                 ← A.openBonZoraDetail (dashboard.html:3983)
4. Patient échange            POST /bons-zora/generate {program_id}                → débit zora_points + zora_ledger(-cost) + partner_bons_zora(partner_id=program.id) + carte WhatsApp
5. Patient liste ses bons     GET  /bons-zora/my                                    ← partner_bons_zora WHERE patient_phone
6. Partenaire valide          POST /bons-zora/validate | /validate/qr {code}        → status='used', used_by=partner_phone ; ownership via program.partner_phone
```

**La chaîne n'est PAS coupée** : chaque maillon est câblé côté backend ET frontend. La « coupure » constatée était **documentaire** (le doc affirmait l'inverse). Retour réel de validation (mis à jour depuis §4.3, désormais **périmé**) : `{success,valid,patient_initiales,fcfa_value,partner_name,used_at}` (`bon-zora.service.js:351-358`).

### 5bis.7 Couverture frontend réelle

| Dashboard | Crée/gère (`/programs/mine`,`POST`,`PUT`,`DELETE`) | Consomme (liste/échange) |
|---|---|---|
| `patient` | — | ✅ `GET /programs`, `GET /programs/:id`, `POST /generate`, `GET /my` |
| `medecin/dashboard.html` | ✅ `loadOffers`/`ouvrirOffre`/POST-PUT/DELETE (`:2297+`) | — |
| `medecin/dashboard-v2.html` | ✅ `loadOffers`/`POST` création (`:1154`,`:2108`) | — |
| `pharmacie` | ✅ `loadOffers`/`saveOffer`/`deactivateOfferUi` (`:2272+`) | affiche aussi le catalogue |
| `laboratoire` | ✅ `loadOffers`/save/deactivate (`:2019+`) | — |
| `partenaire` | ✅ `loadPrograms`/save/`deactivateProgramUi` (`:954+`) | — |
| `rh`, `secretaire` | — | lecture catalogue (`GET /programs`) |

### 5bis.8 Ce qui manque encore / dette (constats, non corrigés)

1. **Aucune modération/approbation** : `is_active=TRUE` **dès la création** → l'offre est immédiatement visible de tous les patients via `GET /programs`, sans validation admin. Aucun cycle DRAFT→REVIEW→APPROVED (confirme l'absence de statut sur `partner_programs`, cf. §5).
2. **`partner_bons_zora.partner_id` mal nommé** : il contient l'`id` du **programme**, pas l'identité du partenaire, et **aucune FK** ne le garantit. Dette de nommage héritée.
3. **Offres seed/démo non rattachées** (`partner_phone=NULL`) → bons validables par tout partenaire (§5bis.5).
4. **`admin` peut créer mais pas valider** : `requirePartenaire` (validation) exclut `admin` ; `requireProgramManager` (CRUD) l'inclut. Asymétrie assumée.
5. **`category` en texte libre** : aucun ENUM/CHECK → risque d'incohérence de filtres côté patient.

---

## 6. Tiers Zora — Niveaux réels

`zora_tiers_config` (migration_030) porte les paliers réels : `tier_name`, `min_points`, `is_active` (colonnes confirmées par leur usage dans `zora.service.js:15,169-175,293,299-303` — noms exacts `min_points`, pas `min_points_12m` comme l'écrivait la v1.1). Les noms de paliers réels sont `kimia`/`liboso`/`nkembo`/`elonga` (en minuscules en base), affichés en français capitalisé côté frontend (`tierMap` dans `dashboard.html`).

Le tier est recalculé à **chaque** appel `awardZora()` réussi (pas seulement par un cron mensuel comme décrit en v1.1 §6.2) : comparaison directe de `total_earned` à `tier.min_points`, mise à jour immédiate si franchissement. **Aucun downgrade n'est possible** dans cette logique — `total_earned` est cumulatif et ne diminue jamais, donc le tier ne peut que monter ou rester stable, jamais redescendre. Il n'existe **aucun cron de recalcul mensuel des tiers** trouvé dans `src/cron/` ou `src/jobs/` — le tableau v1.1 §6.2 ("recalcul chaque 1er du mois") ne correspond à rien d'implémenté.

Aucune table `zora_tier_history` n'existe — pas d'audit trail dédié aux changements de palier (seul `audit_log` générique via l'event `zora_award` conserve indirectement cette information dans son payload).

---

## 7. Flux digital complet — Bon d'achat et validation (réel, avec ses ruptures)

### 7.1 Côté patient — fonctionnel, vérifié en HTTP réel le 7 juillet 2026

```
1. GET /bons-zora/programs → catalogue (patient/dashboard.html, bande "Échangeable maintenant")
2. POST /bons-zora/generate {program_id} → débit atomique + code unique
3. GET /bons-zora/my → liste des bons (actifs + historique)
```

**Gap identifié (pas un bug, un choix UX non documenté jusqu'ici)** : le clic sur une carte de la bande "Échangeable" (`A.exchangeReward`, `dashboard.html:2285-2289`) déclenche l'étape 2 **directement**, sans confirmation ni aperçu intermédiaire — dès que le solde suffit, `A.redeemBonZora()` part immédiatement et débite les points. Voir §7.4 pour la cible (popup détail avant échange).

### 7.2 Côté pharmacie/laboratoire — CASSÉ, confirmé par lecture du code (pas testé en conditions réelles ce soir, mais la rupture est certaine à la lecture)

`public/pharmacie/dashboard.html:881` et `public/laboratoire/dashboard.html` (fonction `verifyZoraVoucher`, nom hérité de l'ancien système mais appelant bien la route moderne) :

```javascript
const res = await fetch(`${API}/bons-zora/validate/qr`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
});
```

Trois ruptures cumulées :
1. **Aucun `body` envoyé** — la route exige `{ code }` dans le corps de la requête (`bon-zora.routes.js:125`) ; sans lui, réponse systématique `400 missing_code`.
2. **Rôle incompatible** — `requirePartenaire` exige `req.user.role === 'partenaire'` (`bon-zora.routes.js:17`), mais les comptes pharmacie/laboratoire ont respectivement `role='pharmacie'`/`role='laboratoire'` — même en corrigeant le body, la requête serait rejetée en 403.
3. **Champs de réponse attendus inexistants** — le code affiche `data.data.discount_value`, `data.data.patient_phone`, `data.data.reward_title`, `data.data.consumed_at` (`pharmacie/dashboard.html:892-896`), alors que `validateBonZora()` ne renvoie que `{ success, valid, patient_initiales, fcfa_value }` (`bon-zora.service.js:314-319`). Même avec une requête correcte, l'affichage serait incohérent.

Ce flux n'a manifestement jamais été testé de bout en bout depuis son écriture.

### 7.3 Seul chemin de validation aligné avec les rôles réels : le dashboard `partenaire`

Le dashboard `partenaire/dashboard.html` (rôle `partenaire`, aligné avec `requirePartenaire`) ne contient **aucun bouton de scan/validation de bon** trouvé dans le fichier — seulement une liste des programmes (`loadPrograms()`) et des stats (`loadStats()`). Combiné au fait que ce rôle a **0 compte réel** en base, le flux de validation de bon Zora — pourtant fonctionnel côté API (vérifié directement en HTTP ce soir) — n'a **aucun point d'entrée UI opérationnel** dans l'état actuel du produit.

### 7.4 Popup détail programme — CIBLE À IMPLÉMENTER

> ⚠️ **[PÉRIMÉ — annoté le 20/07/2026]** `GET /bons-zora/programs/:id` **existe désormais** (`bon-zora.routes.js:117`, `getProgramById()`) et est **réellement consommé** par le dashboard patient (`A.openBonZoraDetail()` → modale détail, `dashboard.html:3983`). Le popup détail décrit comme « cible à implémenter » ci-dessous **est implémenté**. Voir section 5bis.

**Constat** : aucune route de détail par programme individuel n'existe aujourd'hui. `bon-zora.routes.js` ne monte que `GET /programs` (liste complète), `POST /generate`, `GET /my`, `POST /validate`, `POST /validate/qr`, `GET /:code/qr` — pas de `GET /programs/:id` ni équivalent (confirmé par lecture exhaustive du fichier de routes le 7 juillet 2026). `getProgramsByCategory()` (`bon-zora.service.js:387`) ne propose pas non plus de récupération par `id`.

**Cible** : avant l'échange (voir gap §7.1), afficher un popup de détail au clic sur une carte "Échangeable" — au format modal centré validé dans `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §9.1 (pattern `.modal-bg`/`#modal-event-detail` : carte centrée `max-width:520px`, backdrop flouté bloquant, hero, fermeture par clic-backdrop ou bouton close). Le bouton "Échanger" à l'intérieur de ce popup déclencherait alors l'appel `POST /bons-zora/generate` actuel (aucun changement du service backend, seulement une route de lecture à ajouter et le frontend). Nécessite au minimum une route `GET /bons-zora/programs/:id` (absente à ce jour) pour charger le détail avant affichage. Chantier non réalisé dans le cadre de cette mise à jour documentaire.

### 7.5 Flux réel bon + WhatsApp + QR partenaire scannable — CHANTIER 3 CLOS (9-10 juillet 2026)

**Statut** : implémenté, déployé en production et **clos** — audité et testé de bout en bout le 10 juillet 2026 (commits `924b68e` → `a18890e`, `d05785c` pour la police). Ce qui suit décrit le fonctionnement réel, testé en conditions réelles (comptes QA `+242069735419`/`+242069735418`), pas une cible.

**Résumé du flux confirmé** : le patient échange ses points contre un bon (`generateBonZora()`, débit direct de `zora_points`, insertion `partner_bons_zora`) → une carte cadeau PNG (Plus Jakarta Sans, QR, code, montant) est envoyée par WhatsApp de façon **non bloquante** (échec sans impact sur le bon déjà généré/débité) → le partenaire valide le bon via son code ou son QR (`validateBonZora()`, idempotent, `SELECT ... FOR UPDATE`), qui marque `partner_bons_zora.status = 'used'`. Les trois étapes sont confirmées cohérentes avec le schéma `partner_bons_zora` (section 10).

**Fonctionnement réel** : `generateBonZora()` (`bon-zora.service.js`), après le `COMMIT` de la transaction (bon déjà généré, solde déjà débité), appelle `generateBonZoraCard()` (`src/services/image-generator.service.js`) qui compose une image PNG côté serveur — fond navy plein, logo + wordmark Bolamu, nom du partenaire, description de l'offre, QR code, code du bon, badge du montant débité — via `sharp` + rendu SVG, en résolvant la police **Plus Jakarta Sans** par `fontconfig` (fichier statique `assets/fonts/PlusJakartaSans-Bold.ttf`, variable `FONTCONFIG_FILE` dans `render.yaml`, pointant vers `assets/fonts/fonts.conf`). Le buffer PNG résultant est envoyé via `sendImageMessage()` (`whatsapp.service.js`) sur `POST /api/sendImage` de WAHA, session `'Communaute'` (la seule session existante, confirmé §2 de l'état des lieux WAHA), image encodée en base64 inline dans le payload.

**Portée** : ce flux s'applique automatiquement à **tout** appel à `generateBonZora()`, quel que soit le partenaire/programme (`partner_programs`) — aucun code spécifique par partenaire. Les données de la carte (nom, description, coût) sont chargées dynamiquement depuis la ligne `partner_programs` au moment de l'échange (`program.name`, `program.description`, `program.zora_cost`). Conséquence directe non anticipée à l'origine : comme `A.redeemBonZora()` (l'ancien modal `#modal-bon-zora`, `dashboard.html:2853`) appelle le **même** endpoint `POST /bons-zora/generate` que le nouveau flux `A.confirmExchangeBonZora()`, le texte « Vérifiez WhatsApp » de l'ancien modal — documenté comme trompeur en §16 — **est désormais vrai** : le backend envoie réellement la carte cadeau quel que soit le flux frontend d'origine.

**QR encodé** : strictement identique à celui du modal in-app — payload = code brut du bon (ex. `BOL-A546-5Q7V`), généré via `qrcode.toBuffer()` (`image-generator.service.js`), même convention que `A.renderQR()` côté client (`dashboard.html`).

**Garantie de non-blocage, prouvée par test réel** (pas supposée) : l'appel à `generateBonZoraCard()` + `sendImageMessage()` est enveloppé dans un `try/catch` placé **après** le `COMMIT` de la transaction — un échec (réseau, WAHA indisponible, erreur de rendu) est logué (`console.error`) et n'affecte jamais le bon déjà généré/débité ni la réponse HTTP. Testé avec un échec réseau simulé (mock du `fetch` sortant vers `/api/sendImage`) sur un compte réel : `generateBonZora()` a retourné `success:true` normalement, le bon est resté valide en base.

**Contrainte DB étendue** : `notifications_type_check` inclut désormais `'whatsapp_image'` (migration_070), distinct de `'whatsapp_message'` (utilisé par `sendAutoMessage()`) — bug découvert par test d'intégration réel (l'INSERT échouait silencieusement contre l'ancienne contrainte, absorbé par le `try/catch` de `sendImageMessage()`), corrigé avant mise en production finale.

**Points ouverts restants, assumés (pas des oublis)** :
- `validateBonZora()` (validation partenaire) n'envoie toujours aucune notification WhatsApp à la validation — hors périmètre du Chantier 3, qui ne couvrait que la génération. Limite assumée, non traitée.
- Intégration visuelle du bon Zora dans le dashboard patient (au-delà du visuel WhatsApp) : **tranchée en "non nécessaire" (option A)** — le visuel reçu par le patient sur WhatsApp suffit, aucun composant dédié n'est prévu dans le dashboard. `dossier-qr` (§12.1) n'est **pas concerné** par cette décision : il est repris par un flux totalement distinct (DMN), voir §12.1.

### 7.6 Incident police Plus Jakarta Sans / `FONTCONFIG_FILE` — résolu le 10 juillet 2026

**Symptôme** : la carte cadeau bon Zora (§7.5) était fonctionnellement validée (réception WhatsApp réelle confirmée), mais la police réellement rendue sur le visuel n'était pas Plus Jakarta Sans — repli silencieux sur une police serif système.

**Cause** : `render.yaml` déclare la variable `FONTCONFIG_FILE` (pointant vers `assets/fonts/fonts.conf`, requise par `sharp`/`librsvg` pour résoudre Plus Jakarta Sans côté serveur), mais **Render ne synchronise pas automatiquement les variables d'environnement d'un `render.yaml` modifié vers un service déjà déployé** — un ajout manuel dans le dashboard Render (Environment) est nécessaire pour qu'un service existant en tienne compte.

**Résolution** : variable ajoutée manuellement dans le dashboard Render, service redéployé le 10 juillet 2026. Confirmé effectif par une preuve cryptographique, pas seulement visuelle : le fichier PNG réellement livré à un compte patient réel (récupéré via l'historique WAHA du chat, `fileSHA256` des métadonnées du message) est **bit-à-bit identique** (même hash SHA256, même taille en octets) à une régénération locale de la même carte (mêmes données réelles : nom partenaire, description, code, coût) effectuée avec `FONTCONFIG_FILE` correctement pointé vers `assets/fonts/fonts.conf`.

**Note pour l'avenir** : toute variable ajoutée ou modifiée dans `render.yaml` doit être vérifiée manuellement dans le dashboard Render (Environment) pour tout service **déjà existant** — `render.yaml` seul ne suffit pas à la propager.

---

## 8. Feed social et Zora

Le feed social (`posts`, cf. modèle de données §1.7) reçoit des posts automatiques liés à Zora **uniquement** pour certaines actions de gain (`bilan_annuel`, `vaccination`, `event_checkin`, `streak_7`, `streak_30` — via `chatService.postAchievement()`, appelé depuis `zora.service.js:228`). **Il n'existe aucune intégration entre le feed et les offres/programmes de la marketplace** — la section 8 de la v1.1 (offres publiées dans le feed avec `feed_published`, CTA "Utiliser mes points") ne correspond à aucune colonne (`partner_programs` n'a pas de champ `feed_published`) ni à aucun code de publication trouvé.

---

## 9. Modèle économique

Le principe "le partenaire finance ses propres récompenses, Bolamu fournit le rail technologique" reste la logique produit valide et cohérente avec l'implémentation réelle (aucun flux de facturation Bolamu→partenaire trouvé pour le catalogue Zora ; seul le règlement admin décrit en section 15 gère l'aspect financier, côté remboursement partenaire).

La valeur interne "1 Zora = 1.5 FCFA" (v1.1 §9.3) **ne correspond à aucune colonne ni constante trouvée dans le code** — ni dans `platform_config`, ni en dur dans `zora.service.js` ou `bon-zora.service.js`. C'est une intention business non technique à ce jour ; `fcfa_value` est saisi manuellement par ligne de `partner_programs`/`partner_bons_zora`, sans dérivation automatique depuis un taux de conversion.

---

## 10. Schéma base de données (réel)

Reprend exactement `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5 — ne pas redécrire un schéma différent ici :

> **Tables** :
> - **`zora_points`** (migration_030) — solde par `phone` : `balance`, `total_earned`, `tier` (défaut `'kimia'`), `last_activity_at`.
> - **`zora_ledger`** (migration_030) — insert-only confirmé, `phone` FK→`users(phone)`, `points`, `category`, `action_type`, `proof_class`, `proof_source`, `recording_method`, `proof_reference`, `verified`, `earned_at`, `expires_at` ; index unique idempotent `(action_type, proof_reference) WHERE points > 0`. `awardZora()` (`src/services/zora.service.js`) est le point d'entrée unique confirmé.
> - **`zora_tiers_config`**, **`zora_earn_rules`**, **`zora_category_caps`** (migration_030) — paramétrage paliers (Kimia/Liboso/Nkembo/Elonga), règles de gain, plafonds par catégorie (santé 60%/sport 25%/plateforme 10%/lifestyle 5%).
> - **`zora_partners`**, **`zora_rewards`**, **`zora_vouchers`** (migration_031, « marketplace ») — il n'existe pas de table `zora_marketplace` : le marketplace historique est la combinaison de ces 3 tables + `zora_voucher_validations`.
> - **`partner_bons_zora`**, **`partner_programs`**, **`partner_validations`** (migration_065) — second système de bons Zora, distinct de `zora_vouchers`/`zora_rewards` (programmes partenaires génériques hors catalogue Zora).
> - **`zora_games`**, **`zora_game_prizes`**, **`zora_game_plays`** (+`question_id` migration_037), **`zora_games_global_cap`**, **`zora_quiz_questions`** (migration_032) — moteur de jeux (scratch/wheel/chest/quiz).
> - **`qr_zora_consent`** : table inexistante. `users.zora_balance_visible_qr` (migration_041) est le seul lien direct QR↔Zora trouvé.

**Les deux systèmes de bons coexistent en base sans avoir été consolidés** : `zora_vouchers`/`zora_rewards`/`zora_partners` (migration_031) est l'ancien système marketplace, dont l'écriture (génération patient) n'est plus déclenchée par aucun flux frontend actif identifié, mais dont la lecture (`getValidationsHandler`) et l'expiration (cron) restent branchées dessus. `partner_programs`/`partner_bons_zora`/`partner_validations` (migration_065) est le système réellement utilisé par le patient et (en théorie) les partenaires aujourd'hui.

Migrations : 030, 031, 032, 037, 038, 040, 041 (zora_balance_visible_qr), 043 (fix balance), 065 (renommage partner_vouchers→partner_bons_zora), 066 (renommage voucher_payouts→bon_zora_reglements).

---

## 11. Architecture backend — Fichiers réels

```
src/
├── services/
│   ├── zora.service.js            -- awardZora(), getZoraBalance(), getZoraLedger(),
│   │                                  getZoraTiers(), getZoraEarnRules(), recalculateBalance()
│   ├── bon-zora.service.js        -- generateBonZora(), validateBonZora(), getPatientBonsZora(),
│   │                                  getProgramsByCategory()
│   ├── zora-voucher.service.js    -- LEGACY, encore importé par partenaire.controller.js
│   │                                  mais la route qui l'appelait renvoie 410 Gone
│   ├── zora-games.service.js      -- moteur de jeux (scratch/wheel/chest/quiz)
│   └── zora-marketplace.service.js -- existe encore comme fichier, routes associées
│                                      désactivées (voir ci-dessous)
│
├── routes/
│   ├── zora.routes.js             -- GET /balance, /ledger, /tiers, /earn-rules,
│   │                                  POST /earn, /reset-period (admin)
│   ├── zora-games.routes.js       -- montées sur /api/v1/zora également
│   ├── bon-zora.routes.js         -- GET /programs, POST /generate, GET /my,
│   │                                  POST /validate, /validate/qr, GET /:code/qr
│   ├── zora-marketplace.routes.DEPRECATED.js -- fichier renommé, PAS monté dans server.js
│   └── partenaire.routes.js       -- /login, /stats, /voucher/validate (410 Gone), /validations
│
├── controllers/
│   └── partenaire.controller.js   -- validateVoucherHandler (mort, jamais appelé),
│                                      getValidationsHandler (encore branché sur zora_vouchers)
│
└── cron/
    └── zora-expiration.js         -- quotidien 02h00 : expire zora_vouchers ET zora_ledger
```

### 11.1 Montage réel des routes (`server.js`)

```javascript
app.use('/api/v1/zora',         zoraRoutes);
// DEPRECATED (zora_vouchers remplacé par partner_vouchers) — routes neutralisées avec 410 Gone
// app.use('/api/v1/zora',         zoraMarketplaceRoutes);   ← COMMENTÉE, jamais exécutée
app.use('/api/v1/zora',         zoraGamesRoutes);
app.use('/api/v1/bons-zora',    bonZoraRoutes);
app.use('/api/v1/partenaire',   partenaireRoutes);
```

Le commentaire promet un « 410 Gone » pour les routes neutralisées — en réalité, comme la ligne est commentée, ces routes ne répondent **plus du tout** (404 générique Express), pas un 410 explicite. Seule `partenaire.routes.js:149` (`/voucher/validate`) renvoie un vrai 410.

### 11.2 Routes réelles (vérifiées par lecture directe des fichiers, pas par supposition)

```
GET    /api/v1/zora/balance                — solde + tier (zora.routes.js)
GET    /api/v1/zora/ledger                 — historique paginé
GET    /api/v1/zora/tiers                  — paliers actifs
GET    /api/v1/zora/earn-rules             — règles de gain actives
POST   /api/v1/zora/earn                   — admin only
POST   /api/v1/zora/reset-period           — admin only

GET    /api/v1/bons-zora/programs          — catalogue (public, pas d'auth)
POST   /api/v1/bons-zora/generate          — patient génère un bon
GET    /api/v1/bons-zora/my                — mes bons (actifs + historique)
POST   /api/v1/bons-zora/validate          — partenaire valide (code manuel)
POST   /api/v1/bons-zora/validate/qr       — partenaire valide (scan QR)
GET    /api/v1/bons-zora/:code/qr          — QR payload (patient, propriétaire uniquement)

POST   /api/v1/partenaire/login
GET    /api/v1/partenaire/stats
POST   /api/v1/partenaire/voucher/validate — 410 Gone (mort)
GET    /api/v1/partenaire/validations      — encore branché sur zora_vouchers (legacy)

GET    /api/v1/clearing/bons-zora/pending  — admin, règlements en attente
POST   /api/v1/clearing/bons-zora/run      — admin, génère les règlements
PATCH  /api/v1/clearing/bons-zora/:id/pay  — admin, marque payé
```

Aucune des routes `/api/zora/wallet*`, `/api/zora/offers*`, `/api/admin/zora/*`, `/api/zora/earn/consultation|pharmacie|laboratoire|elonga/*` décrites en v1.1 §11.2 n'existe dans le code.

---

## 12. Architecture frontend — Par dashboard (réel)

### 12.1 Patient (`public/patient/dashboard.html`)

| Section | Appel API | Condition d'affichage |
|---|---|---|
| Solde + tier (hero card) | `GET /zora/balance` | Toujours affiché, `A.renderScalars()` |
| Historique des mouvements | `GET /zora/ledger?limit=10` | Vide si `data.data` vide |
| Bande "Échangeable maintenant avec vos Zora" | `GET /bons-zora/programs` | **`display:none` tant que `partner_programs` ne renvoie aucune ligne active** — bug diagnostiqué et corrigé le 7 juillet 2026 (catalogue vide = donnée manquante, pas bug de code après correctif du champ `d.data`) |
| "Mes bons d'achat" | `GET /bons-zora/my` | Vide si aucun bon ; corrigé le 7 juillet 2026 (lisait `d.data.vouchers`, clé inexistante) |
| Génération d'un bon | `POST /bons-zora/generate {program_id}` | Depuis le clic sur une carte de la bande "Échangeable" — **échange direct sans confirmation** (voir gap §7.1, cible §7.4) |
| Jeux Zora | `GET /zora/games/config`, `POST /zora/games/play` | Onglet dédié. Mécanisme de crédit audité et corrigé le 12 juillet 2026, voir §3.4 — l'UI de jeu elle-même (rendu scratch/roue/coffre/quiz) reste hors périmètre de cette réécriture |
| Leaderboard hebdo | `GET /leaderboard/weekly` | Toujours affiché |
| `hero-qr` (QR principal du dashboard) | `GET /qr/generate` | Toujours affiché — encode un token d'urgence (`/urgence?token=...`), **sans aucun rapport avec les bons Zora**. Ajouté au document le 7 juillet 2026 (angle mort de la version précédente) |
| `dossier-qr` (carte membre / titulaire) | `GET /api/v1/dmn/qr-payload` | **Sans rapport avec les bons Zora** — repris par le flux DMN (dossier médical numérique) : `A.loadDossierQr()` charge un payload signé (24h) et l'affiche via `A.renderQR('dossier-qr', d.data.signed, 66)` (`dashboard.html`, route `dmn.routes.js:163`). N'est plus un point ouvert du Chantier Zora (mis à jour le 10 juillet 2026 — l'ancien constat "QR mort" du 7 juillet 2026 est obsolète, le composant a depuis été branché sur le flux DMN, indépendamment du Chantier 3) |

### 12.2 Pharmacie / Laboratoire (`public/pharmacie/dashboard.html`, `public/laboratoire/dashboard.html`)

Section "Vérifier un voucher Zora" (bouton visible, fonction `verifyZoraVoucher()`) → **flux cassé** (voir section 7.2). Aucune autre section Zora dans ces dashboards.

### 12.3 Médecin (`public/medecin/dashboard.html`)

Aucun appel Zora direct trouvé — le médecin ne déclenche ni ne consulte de Zora depuis son dashboard ; le gain de points lié à une consultation (si déclenché) passerait par un appel serveur-à-serveur, non par une action UI médecin.

### 12.4 Admin (`public/admin/dashboard.html`)

Section "Règlement bons Zora partenaires" : `GET /clearing/bons-zora/pending`, `POST /clearing/bons-zora/run`, `PATCH /clearing/bons-zora/:id/pay`. **Purement financier** (générer et payer les règlements des bons déjà validés) — aucune gestion de catalogue, d'offres, ou de règles earn depuis ce dashboard.

### 12.5 Partenaire (`public/partenaire/dashboard.html`)

`GET /bons-zora/programs` (liste en lecture seule), `GET /partenaire/stats`. **Aucun formulaire de création/édition de programme.** Rôle sans compte réel en base (voir section 2).

---

## 13. Règles métier et anti-fraude (réel)

Ce qui est réellement implémenté dans `awardZora()` (voir section 3.1) :
- Idempotence par `(action_type, proof_reference)`.
- Rejet systématique de `proof_class = 'device_declared'`.
- Hiérarchie de preuve (`ground_truth` > `system_event` > `device_measured` > `device_declared`) comparée à `required_proof_class` de la règle.
- Rejet de `device_measured` + `recording_method = 'manual_entry'`.
- Plafond journalier (`daily_cap`) et plafond catégorie conditionnel (`cap_percent`, actif seulement au-delà de 500 points cumulés).

Ce qui n'est **pas** implémenté (contrairement à la v1.1 §13.2) : aucune détection d'anomalie automatisée trouvée pour Zora spécifiquement (pas de seuil "points > 3× moyenne", pas de blocage IP, pas de détection "bon scanné par 2 partenaires"). La table `fraud_signals` existe bien en base et est utilisée par `admin.routes.js` et `appointments-validate.controllers.js` — **mais jamais référencée dans le contexte Zora** (`zora.service.js`, `bon-zora.service.js`). Le patient ne peut pas non plus être bloqué à "5 bons actifs simultanément" — aucune contrainte de ce type trouvée.

---

## 14. Notifications (réel)

**Aucun des 11 templates WhatsApp listés en v1.1 §14.1 n'existe dans le code** (`zora_credit`, `zora_tier_upgrade`, `zora_bon_zora_generated`, `zora_bon_zora_used`, `zora_bon_zora_confirmed`, `zora_points_expiring_30d/7d/1d`, `zora_new_offer`, `zora_budget_alert`, `zora_offer_approved`, `zora_offer_rejected` — recherche exhaustive dans `src/`, zéro occurrence). `awardZora()` ne déclenche aucun envoi WhatsApp — seul un événement Socket.io (`leaderboard_updated`) et un post feed conditionnel sont émis. Le gain de points Zora est **silencieux** pour le patient en dehors du rafraîchissement de son solde à l'écran.

---

## 15. Administration et configuration (réel)

Il n'existe **aucune interface admin** pour :
- Modifier `zora_earn_rules` (`base_points`, `monthly_cap`, activer/désactiver une action) — aucune route admin trouvée pour cette table.
- Créer ou approuver un `partner_program` — confirmé absent (voir section 5).
- Lancer une campagne bonus — la table `zora_campaigns` elle-même n'existe pas en base.

La seule capacité admin réelle côté Zora est le **règlement financier** des bons validés (section 12.4). Toute évolution du catalogue de programmes passe aujourd'hui exclusivement par une **migration SQL ou un script direct** — c'est la méthode employée le 7 juillet 2026 pour peupler `partner_programs` (voir migration dédiée dans `database/migrations/`).

---

## 16. Dette technique et zones floues

Reprend et complète les anomalies déjà notées en `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §3 qui touchent Zora, sans les re-décider ici :

- **Deux systèmes de bons non consolidés** (`zora_vouchers`/`zora_rewards`/`zora_partners` vs `partner_bons_zora`/`partner_programs`/`partner_validations`) — le modèle de données §3 le liste déjà comme dette à consolider.
- **`GET /partenaire/validations` lit encore l'ancien système** (`zora_voucher_validations`/`zora_vouchers`/`zora_rewards`) alors que la génération patient passe désormais par `partner_bons_zora` — cette route ne montrera jamais les validations récentes.
- **Message de dépréciation pointant vers une route inexistante** : `partenaire.routes.js:152` renvoie *"utiliser /vouchers/*"*, mais aucune route `/vouchers/*` n'est montée dans `server.js`.
- **Flux "vérifier un bon Zora" cassé sur pharmacie/laboratoire** (section 7.2) : body manquant, rôle incompatible avec `requirePartenaire`, champs de réponse attendus inexistants — trois ruptures indépendantes cumulées sur un même bouton.
- **Rôle `partenaire` sans compte réel** : le seul chemin correctement aligné avec les permissions de validation de bons n'a aucun utilisateur en production.
- **`zora-voucher.service.js` toujours importé** par `partenaire.controller.js` alors que la route qui l'utilisait est morte (410 Gone) — import mort, fonctions `validateVoucher`/`getVouchersByPhone` non appelées en pratique.
- **`partner_programs.partner_id` sans contrainte FK** — aucune vérification que la valeur référence un partenaire réel ; les 3 programmes ajoutés le 7 juillet 2026 utilisent `partner_id = NULL` faute de comptes partenaires correspondants en base (Pharmacie Daffé, Laboratoire 3A ne sont pas des comptes seedés).
- **Aucune multiplication du gain par le tier**, contrairement à ce que documentait la v1.1 — à trancher côté produit : fonctionnalité à implémenter, ou vision à abandonner définitivement.
- **Gain de points Zora (`awardZora()`) toujours silencieux** — aucun template WhatsApp sur le gain de points lui-même, alors que c'est un canal central pour le reste de la plateforme (règle CLAUDE.md "WhatsApp direct"). Distinct de la génération d'un bon Zora, résolue en §7.5 (implémentée, 9 juillet 2026) — ce point-ci reste non traité, périmètre non couvert par le Chantier 3.
- **Séquence `partner_bons_zora_id_seq` désynchronisée du `MAX(id)` réel — CIBLE À IMPLÉMENTER, non bloquant immédiat.** Découvert le 7 juillet 2026 pendant le test du correctif §4.2 : `migration_065_rename_partner_vouchers.sql` a copié les lignes historiques avec un `id` explicite (`INSERT ... SELECT id, ...`) sans jamais appeler `setval()` pour resynchroniser la séquence. Un `nextval()` peut donc entrer en collision avec un `id` déjà utilisé (`duplicate key value violates unique constraint "partner_bons_zora_pkey"`, constaté une fois en test). **Pas bloquant dans l'immédiat** : les séquences Postgres ne sont pas transactionnelles — l'essai suivant obtient automatiquement un `id` libre et réussit. Risque latent si une future migration/copie de données recroise à nouveau un `id` déjà consommé. Correctif recommandé : `SELECT setval('partner_bons_zora_id_seq', (SELECT MAX(id) FROM partner_bons_zora))`.
- **Résolu par le Chantier 3 (9 juillet 2026), effet de bord non anticipé à l'origine** : le modal `#modal-bon-zora` (flux `A.redeemBonZora()`) affichait « Vérifiez WhatsApp » sans qu'aucun envoi ne soit réellement déclenché — ce bug était documenté ici comme préexistant et hors scope du Chantier 2. Le Chantier 3 a implémenté l'envoi WhatsApp au niveau de `generateBonZora()` (`bon-zora.service.js`), le service backend partagé par **tous** les flux frontend qui appellent `POST /bons-zora/generate` — y compris l'ancien modal. Le texte est donc désormais vrai, sans qu'aucun code frontend n'ait eu besoin d'être modifié pour ce modal spécifiquement. Voir §7.5.

---

## 17. Roadmap / non implémenté à ce jour

Contenu de la v1.1 qui reste une vision produit potentiellement pertinente, mais qui **ne doit pas être confondu avec l'existant** :

- Table `zora_wallets` (UUID) — n'existe pas ; le vrai équivalent est `zora_points` (clé `phone`, pas `user_id` UUID).
- Multiplicateur de gain par tier (× 1.0 à × 2.0) — voir section 3.2, aucun code réel.
- Recalcul mensuel automatique des tiers (cron 1er du mois) — aucun cron trouvé ; le recalcul est en réalité immédiat à chaque crédit.
- `zora_tier_history` (audit des changements de palier) — table inexistante.
- Campagnes bonus (`zora_campaigns`, multiplicateurs additionnels, priorité de composition, plafond ×4.0) — table et logique inexistantes.
- Cycle de vie d'offre DRAFT→SUBMITTED→REVIEW→APPROVED→ACTIVE avec validation admin — `partner_programs` n'a qu'un booléen `is_active`, pas de workflow.
- Types de rédemption multiples (`GIFT_CARD`, `DISCOUNT`, `OFFER_ACCESS` en plus de `BON_ZORA`) — `partner_programs`/`partner_bons_zora` n'ont pas de colonne `type` ; un seul mécanisme existe.
- Budget partenaire suivi en FCFA avec alerte à 80% — aucune colonne `budget_fcfa`/`budget_consumed_fcfa`.
- Intégration Feed des offres marketplace (`feed_published`, CTA "Utiliser mes points") — inexistante (seuls les gains de points génèrent des posts automatiques).
- 11 templates WhatsApp Zora (section 14 v1.1) — aucun implémenté.
- Détection d'anomalies/fraude automatisée spécifique à Zora — table `fraud_signals` existe mais jamais utilisée dans ce contexte.
- Interface admin de configuration des règles earn, d'approbation d'offres, de campagnes — inexistante ; seule la gestion financière des règlements existe.
- Rôle `reward_partner`/`health_partner` — abandonné, jamais implémenté (la v1.1 elle-même le note en §19).
- Gestion des abonnements suspendus/gelés sur le solde Zora (`is_frozen`, `WALLET_FROZEN`) — aucune colonne de ce type sur `zora_points`.
- Chiffrement au repos des colonnes sensibles du ledger, pseudonymisation par `member_code` dans les exports, droits CNPD formalisés (export, rectification, opposition) — aucune implémentation technique trouvée ; à traiter comme un chantier de conformité à part entière si prioritaire.
- Valeur interne "1 Zora = 1.5 FCFA" — intention business non technique, aucune constante ni colonne dans le code.

---

## 18. Glossaire

| Terme | Statut réel |
|---|---|
| **Zora Point** | Réel — unité de `zora_ledger.points` / `zora_points.balance`. |
| **Tier / Palier** | Réel — `zora_points.tier`, valeurs `kimia`/`liboso`/`nkembo`/`elonga`, recalculé à chaque crédit, sans effet multiplicateur sur le gain. |
| **Ledger** | Réel — `zora_ledger`, insert-only confirmé. |
| **Bon Zora** | Réel — `partner_bons_zora`, généré via `POST /bons-zora/generate`, code unique + `qr_payload`. |
| **Programme partenaire** | Réel — `partner_programs`, catalogue consultable via `GET /bons-zora/programs`, alimentable uniquement par SQL direct à ce jour. |
| **Wallet** | Terme vision — la vraie table est `zora_points`, pas de table `zora_wallets`. |
| **Carte cadeau / Réduction / Accès offre (types de burn)** | Vision — un seul mécanisme (bon à coût fixe) existe réellement. |
| **Campagne bonus** | Vision — table et logique inexistantes. |
| **Proof reference / Proof class** | Réel — `zora_ledger.proof_reference`/`proof_class`, hiérarchie de preuve appliquée dans `awardZora()`. |
| **`device_declared`** | Réel — toujours rejeté par `awardZora()`. |

---

*Document réécrit le 7 juillet 2026 sur la base d'une vérification exhaustive du code (`src/services/zora.service.js`, `src/services/bon-zora.service.js`, `src/routes/*.js`, `public/*/dashboard.html`) et de `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5/§3. Aucun contenu de ce document n'est une supposition non vérifiée — le contenu vision est explicitement isolé en section 17.*
