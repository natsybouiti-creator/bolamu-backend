# ARCHITECTURE_JEUX_BOLAMU.md

> ✅ **STATUT DE CE DOCUMENT** : les sections 1 à 9 décrivent **l'existant réel** — vérifié le 17 juillet 2026 par lecture directe du code (`src/services/zora-games.service.js`, `src/services/zora.service.js`, `src/routes/zora-games.routes.js`, `public/patient/dashboard.html`) et par requêtes SQL en lecture seule exécutées ce jour-là contre la base Neon de production. Chaque affirmation des sections 1-9 est sourcée par un fichier:ligne exact ou une requête SQL réelle — aucune supposition, aucune reprise non vérifiée d'un audit antérieur. Les sections 10 et 11 sont une **bibliothèque de concepts futurs (ROADMAP)** — vision produit exploratoire, 0% implémentée sauf mention contraire explicite — et ne doivent jamais être confondues avec les sections 1-9.
>
> Un audit antérieur (16-17 juillet 2026, `ARCHITECTURE_ZORA_BOLAMU.md` §3.4) avait déjà documenté certains des sujets couverts ici (règles de gain manquantes, désynchronisation frontend, prix affiché ≠ crédité, quiz rejouable). Ce document ne réutilise aucune de ces conclusions telles quelles : chaque point a été relu et revérifié from scratch le 17 juillet 2026 (nouvelle lecture de code, nouvelles requêtes SQL). Les convergences et divergences avec cet audit antérieur sont signalées explicitement où elles apparaissent (notamment §9).
>
> **Mise à jour du 17 juillet 2026 (soir, version 1.1)** : les 4 problèmes les plus significatifs identifiés en §9 (crédit ≠ montant tiré sur les 4 jeux, quota gratuit partagé/désynchronisé, quiz sans crédit réel, segment visuel de la roue non aligné) ont été corrigés et testés de bout en bout (HTTP réel + SQL + Playwright) le jour même de l'audit. Chaque sous-section concernée porte désormais un statut « résolu le 17 juillet 2026 » avec preuve de test citée — voir §9.1, §9.2, §9.4, §9.6.

**Version 1.0 — 17 juillet 2026 — Création initiale**

| Version | Date | Modifications |
|---|---|---|
| 1.0 | 17 juillet 2026 | Création initiale : audit frais du moteur de jeux Zora (existant réel, sections 1-9) + bibliothèque de jeux futurs solo et multijoueur (roadmap, sections 10-11) |
| 1.1 | 17 juillet 2026 (soir) | Chantier correction : §9.1 (crédit ≠ montant tiré, scratch/wheel/chest/quiz), §9.2 (quota gratuit partagé/désynchronisé), §9.4 (quiz — réponse jamais transmise) et §9.6 (roue — segment visuel non aligné) résolus et testés de bout en bout (HTTP réel + SQL). §9.3 partiellement adressé (`GET /games/status` désormais utilisée pour le quota ; `GET /games/config` reste non lue). §9.5 (pas de bouton partie payante) non traité, hors périmètre de ce chantier. |
| 1.2 | 17 juillet 2026 (nuit) | §9.5 résolu : point d'entrée UI pour les parties payantes ajouté (`dashboard.html`, commit `9d92f98`, aucune modification backend) — bouton "Rejouer · X Z", modal de confirmation, gestion du solde insuffisant. Testé de bout en bout (HTTP + SQL) pour scratch et wheel, quota gratuit confirmé intact après une partie payante. |
| 1.3 | 17 juillet 2026 (nuit, plus tard) | Bingo Santé (§2.5) implémenté de zéro : `migration_084_bingo_sante.sql` (catalogue `zora_games`/`zora_game_prizes`/`zora_earn_rules` + tables `bingo_grids`/`bingo_actions`), `bingo.service.js`/`bingo.routes.js` (grille hebdomadaire dédiée, ne passe pas par `playGame()`), carte dashboard activée + modals grille/reroll. Déplacé de la roadmap (§10.1) vers l'existant réel. Testé de bout en bout (HTTP + SQL) : création de grille, idempotence des cases, crédit de ligne unique, plafond quotidien géré sans erreur, bingo complet, reroll payant. Non-régression des 4 jeux existants reconfirmée. |

---

## Table des matières

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Jeux actifs solo (existant réel)](#2-jeux-actifs-solo-existant-réel)
3. [Déblocage et progression (existant réel)](#3-déblocage-et-progression-existant-réel)
4. [Infrastructure temps réel disponible (existant réel)](#4-infrastructure-temps-réel-disponible-existant-réel)
5. [Schéma base de données (existant réel)](#5-schéma-base-de-données-existant-réel)
6. [Architecture backend — Fichiers réels](#6-architecture-backend--fichiers-réels)
7. [Architecture frontend — Par dashboard](#7-architecture-frontend--par-dashboard)
8. [Règles anti-fraude et plafonds (existant réel)](#8-règles-anti-fraude-et-plafonds-existant-réel)
9. [Dette technique et zones floues (existant réel)](#9-dette-technique-et-zones-floues-existant-réel)
10. [Bibliothèque de jeux futurs — solo (ROADMAP)](#10-bibliothèque-de-jeux-futurs--solo-roadmap)
11. [Bibliothèque de jeux futurs — entre patients (ROADMAP)](#11-bibliothèque-de-jeux-futurs--entre-patients-roadmap)
12. [Glossaire](#12-glossaire)

---

## 1. Vision et positionnement

Bolamu propose aujourd'hui à ses patients 5 mini-jeux qui distribuent des Zora Points via le pipeline `awardZora()` déjà documenté dans `ARCHITECTURE_ZORA_BOLAMU.md` : 4 jeux à tirage quotidien (grattage, roue, coffre, quiz) et, depuis le 17 juillet 2026, le Bingo Santé — une grille hebdomadaire persistante (§2.5). Ces jeux existent pour créer une raison de revenir quotidiennement (voire hebdomadairement pour le Bingo) sur l'app et pour gamifier l'acquisition de connaissances/habitudes santé. Deux jeux supplémentaires (Parcours Elonga, Album de Masques) restent **teasés visuellement** au patient avec un badge « Bientôt » — la section 3 documente avec preuve qu'il n'existe **aucune trace backend, base de données, ou migration** pour ces deux jeux : intention produit à 100%, jamais commencée techniquement.

Ce document sépare strictement :
- **L'existant** (sections 2-9) : ce que le patient peut réellement jouer aujourd'hui, avec les vraies règles serveur, les vraies valeurs en base, et les vrais bugs.
- **La roadmap** (sections 10-11) : une bibliothèque de concepts explorés pour étendre l'offre de jeux, solo et entre patients, évalués systématiquement pour leur compatibilité avec le pipeline `awardZora()` existant.

---

## 2. Jeux actifs solo (existant réel)

**4 jeux actifs confirmés en base** (`SELECT * FROM zora_games`, exécuté le 17 juillet 2026) :

| id | game_type | label_fr | daily_free_plays | extra_play_cost | max_gain_per_play | daily_gain_cap | is_active |
|---|---|---|---|---|---|---|---|
| 1 | scratch | Carte à gratter | 1 | 50 | 30 | 30 | true |
| 2 | wheel | Roue de la fortune | 1 | 75 | 50 | 50 | true |
| 3 | chest | Coffre mystère | 1 | 100 | 75 | 75 | true |
| 4 | quiz | Quiz santé | 1 | 30 | 40 | 40 | true |

Chaque jeu a **son propre compteur de partie gratuite quotidienne** (`daily_free_plays = 1` pour les 4 jeux, colonne individuelle par `game_id`) — pas un plafond global partagé au niveau base de données (voir divergence frontend en §3).

### 2.1 Tirage pondéré — scratch, wheel, chest (`zora-games.service.js:212-248`)

Le tirage est fait par le **serveur uniquement**, avec `Math.random()` (pas de `crypto.randomBytes` pour le tirage lui-même, seulement pour `server_seed`, un artefact non réutilisé dans le calcul du tirage) : `randomValue = Math.floor(Math.random() * 1000)`, puis parcours cumulatif des lots (`ORDER BY probability ASC` puis somme croissante) jusqu'à dépasser `randomValue` (`zora-games.service.js:236-247`).

**Poids réels par jeu** (`SELECT * FROM zora_game_prizes ORDER BY game_id, probability`, exécuté le 17 juillet 2026 — total = 1000 pour chaque jeu, confirmé) :

**Scratch (game_id=1)** :
| Lot | points_value | probability (/1000) |
|---|---|---|
| Pas de gain | 0 | 550 |
| +5 Zora | 5 | 250 |
| +10 Zora | 10 | 130 |
| +20 Zora | 20 | 60 |
| +30 Zora | 30 | 10 |

**Wheel (game_id=2)** :
| Lot | points_value | probability (/1000) |
|---|---|---|
| Pas de gain | 0 | 400 |
| +5 Zora | 5 | 280 |
| +15 Zora | 15 | 180 |
| +30 Zora | 30 | 100 |
| +50 Zora | 50 | 40 |

**Chest (game_id=3)** :
| Lot | points_value | probability (/1000) |
|---|---|---|
| Pas de gain | 0 | 300 |
| +10 Zora | 10 | 300 |
| +25 Zora | 25 | 250 |
| +50 Zora | 50 | 120 |
| +75 Zora | 75 | 30 |

Ces probabilités ne sont **jamais lues par le frontend** — la roue visuelle (`A.wheelSeg`, `dashboard.html:1680-1683`) a ses propres 8 segments (`+20,+50,+10,+100,+30,Perdu,+75,+15`) tirés côté client par `Math.floor(Math.random()*segs.length)` (`dashboard.html:3294`) **uniquement pour l'animation visuelle** (rotation du disque) ; le lot réellement crédité vient de la réponse serveur (`d.data.points_won`), affichée après coup — l'animation et le lot réel peuvent donc afficher des valeurs différentes (ex. le disque s'arrête visuellement sur "+100", un lot qui n'existe même pas en base pour `wheel`, pendant que le texte de résultat annonce le vrai gain serveur).

### 2.2 Quiz — mécanique distincte, sans table de lots (`zora-games.service.js:160-211`, `353-460`)

Le quiz n'utilise **pas** `zora_game_prizes` : `playGame({game_type:'quiz'})` sélectionne une question aléatoire non posée aujourd'hui par ce patient (`SELECT * FROM zora_quiz_questions WHERE is_active=TRUE [AND id NOT IN (déjà posées aujourd'hui)] ORDER BY RANDOM() LIMIT 1`), l'enregistre dans `zora_game_plays` avec `points_won=0` (aucun gain à cette étape), puis `submitQuizAnswer({phone, play_id, answer})` compare la réponse (`answer.toLowerCase() === play.correct_answer.toLowerCase()`, fenêtre de 5 minutes après `played_at`, sinon `answer_timeout`) et calcule le gain **par un barème codé en dur dans le service**, indépendant de `zora_game_prizes` et de `zora_games.max_gain_per_play` :

```js
// zora-games.service.js:392-404
switch (play.difficulty) {
  case 'facile':    pointsWon = 10; break;
  case 'moyen':     pointsWon = 20; break;
  case 'difficile': pointsWon = 40; break;
  default:          pointsWon = 10;
}
```

**20 questions actives en base** (`SELECT COUNT(*) FROM zora_quiz_questions` = 20), toutes `category='sante'`, réparties `facile`/`moyen`/`difficile` (ex. id=1 "Combien de litres d'eau faut-il boire par jour ?" facile, id=17 "L'hypertension est définie à partir de ?" difficile) — vérifié ligne par ligne le 17 juillet 2026.

### 2.3 Fonctions backend par type de jeu

| Jeu | Fonction backend | Route HTTP |
|---|---|---|
| scratch / wheel / chest | `playGame({phone, game_type, play_type})` (`zora-games.service.js:55`) | `POST /api/v1/zora/games/play` (`zora-games.routes.js`, `authMiddleware`) |
| quiz (tirage question) | `playGame({phone, game_type:'quiz', play_type})` (même fonction, branche `if (game_type==='quiz')`, `zora-games.service.js:160-211`) | `POST /api/v1/zora/games/play` |
| quiz (soumission réponse) | `submitQuizAnswer({phone, play_id, answer})` (`zora-games.service.js:353`) | `POST /api/v1/zora/games/quiz/answer` (**voir §9 — jamais appelée par le frontend patient actuel**) |

### 2.4 Fonctions frontend (`public/patient/dashboard.html`, seul dashboard concerné — confirmé par grep exhaustif de `zora/games` sur tout `public/`, les seuls autres résultats sont d'anciennes copies `dashboard-old.html`/`dashboard-original-git.html`/`dashboard-dclogic-*.html`, non servies)

| Jeu | Fonction frontend | Appel réseau |
|---|---|---|
| Roue | `A.spinWheel()` (`dashboard.html:3288`) → `A._wheelFinish()` (`:3305`) | `POST /zora/games/play {game_type:'wheel', play_type:'free'}` (`:3300`, **toujours `'free'` codé en dur — voir §9**) |
| Coffre | `A.openChest(i)` (`:3315`) | `POST /zora/games/play {game_type:'chest', play_type:'free'}` (`:3319`) |
| Quiz | `A.pickQuiz(i)` (`:3326`) | `POST /zora/games/play {game_type:'quiz', play_type:'free'}` (`:3330`) — **n'appelle jamais `/games/quiz/answer`, voir §9** |
| Grattage | `A.playScratch()` (`:3338`), animation canvas `A.initScratch()` | `POST /zora/games/play {game_type:'scratch', play_type:'free'}` (`:3341`) |
| Rendu de la liste de jeux (cartes) | `A.renderGames()` (`:2429`) | Aucun — utilise `A.gamesList`, tableau **statique codé en dur** (`:1674-1679`), pas la réponse de `GET /games/config` (voir §9) |

### 2.5 Bingo Santé — 5e jeu, ajouté le 17 juillet 2026 (`migration_084_bingo_sante.sql`)

Contrairement aux 4 jeux ci-dessus (tirage ponctuel répété chaque jour), le Bingo est une **grille 5x5 persistante sur une semaine** (reset au lundi) — il ne passe **jamais** par `playGame()`/`checkDailyPlays()` (câblés en dur sur "aujourd'hui" et sur une liste fermée de `game_type` qui n'inclut pas `'bingo'`) : le reset hebdomadaire et toute la mécanique sont gérés par un service et des routes entièrement dédiés, sans aucune modification des fichiers partagés par les 4 jeux existants.

**Catalogue** (`zora_games` id=5, `zora_game_prizes` id=16-19, `zora_earn_rules action_type='game_bingo'`) : `extra_play_cost=30` (coût du reroll, §2.5 ci-dessous, pas d'un "tirage payant" classique), `max_gain_per_play=100`. `category='game'` sur la règle `zora_earn_rules` — délibérément distinct du `'engagement'` utilisé par les 4 autres jeux ; aucune ligne `zora_category_caps` n'existe pour `'game'`, donc le plafond catégorie d'`awardZora()` ne s'applique jamais aux crédits Bingo (no-op assumé, pas un bug).

**Mécanique réelle** (`src/services/bingo.service.js`) :
- `getOrCreateWeeklyGrid(phone)` : calcule le lundi de la semaine ISO courante (`mondayOf()`), cherche une ligne `bingo_grids (phone, week_start)` UNIQUE, la crée si absente en tirant 25 actions aléatoires distinctes depuis `bingo_actions` (50 actions seedées, 5 piliers : Hydratation/Activité/Nutrition/Sommeil/Bien-être).
- `checkCell(phone, index)` : coche une case (**idempotent** — refuse `already_checked` si déjà cochée, `FOR UPDATE` pour éviter une course), puis détecte les 12 lignes possibles (5 lignes, 5 colonnes, 2 diagonales) nouvellement complétées et crédite chacune via `awardZora({..., action_type:'game_bingo', override_points})` — 15 Zora (ligne/colonne) ou 20 Zora (diagonale). Grille complète (25/25) → bonus Bingo +100 Zora, une seule fois (`bingo_rewarded`).
- **Limite connue, actée explicitement** : `zora_earn_rules.daily_cap=1` limite `awardZora()` à 1 seul crédit `game_bingo` par jour civil, tous types confondus. Si une même case complète plusieurs lignes à la fois, ou si plusieurs lignes se complètent le même jour, seule la première est créditée — les autres restent hors de `lines_rewarded` (donc non perdues : retentées automatiquement au prochain `checkCell()`, une fois le plafond quotidien réinitialisé le lendemain). Confirmé en conditions réelles le 17 juillet 2026 (ligne + colonne complétées le même jour → seule la ligne créditée, la colonne retentée avec succès sans re-cocher aucune case).
- `rerollGrid(phone)` : débite `extra_play_cost` (30 Zora, même pattern d'`INSERT zora_ledger action_type='game_play_cost'` que le coût des parties payantes des 4 autres jeux, §2.1) et régénère 25 nouvelles actions pour la semaine en cours — perd la progression (`checked`/`lines_rewarded`/`bingo_rewarded` réinitialisés).

**Routes** (`src/routes/bingo.routes.js`, montées sous `/api/v1/zora` comme les autres) :
- `GET /games/bingo` (authMiddleware) — grille de la semaine, créée si inexistante.
- `POST /games/bingo/check {index}` (authMiddleware) — coche une case.
- `POST /games/bingo/reroll` (authMiddleware) — régénère la grille contre 30 Zora.

**Frontend** (`dashboard.html`) : carte "Bingo Santé" (`:1044`) — badge "Bientôt" retiré, bouton "Jouer" actif (`A.openGame('bingo')` → `A.loadBingo()`). Modal `#modal-bingo` : grille 5x5 (`A.renderBingo()`), case cochée en violet, score de la semaine calculé côté client depuis `lines_rewarded`/`bingo_rewarded` (15/20/100 Zora selon type de ligne). `A.checkBingoCell(index)` affiche un toast par ligne nouvellement complétée + un toast dédié pour le bingo complet. Modal `#modal-bingo-reroll` (mêmes conventions visuelles que `#modal-paid-game`, §9.5) pour la confirmation du reroll payant.

**Testé en conditions réelles** (HTTP + SQL, compte `+242069735418`) : création de grille (25 actions distinctes confirmées), case cochée puis idempotence vérifiée (`already_checked` sur re-tentative), ligne complète créditée exactement une fois (+15 Zora, `zora_ledger` à une seule entrée), cas du plafond quotidien géré sans erreur (§ci-dessus), bingo complet simulé et crédité (+100 Zora, une seule entrée), reroll testé (débit de 30 Zora confirmé, grille réinitialisée). Aucune régression observée sur scratch/wheel/chest/quiz après ce chantier (revérifiés en HTTP réel le jour même).

---

## 3. Déblocage et progression (existant réel)

**Aucun mécanisme de déblocage séquentiel entre jeux n'existe côté backend.** Recherche exhaustive (`grep -i "unlock"` sur tout `src/`) : zéro occurrence. Les 5 jeux actifs (`scratch`/`wheel`/`chest`/`quiz`/`bingo`) sont accessibles indépendamment les uns des autres, sans condition de complétion préalable, dès que le patient est authentifié — confirmé par lecture de `zora-games.routes.js`/`bingo.routes.js` (aucune vérification d'un jeu précédent) et de `zora-games.service.js`/`bingo.service.js` (aucune fonction ne consulte l'historique d'un *autre* `game_type`).

### 3.1 Les 2 jeux « Bientôt » restants (Parcours Elonga, Album de Masques) — confirmé 100% non commencés côté backend

Recherche exhaustive le 17 juillet 2026 (mise à jour : Bingo Santé, alors 3e jeu « Bientôt » de ce constat, a depuis été implémenté le jour même — voir §2.5) :
- **Base de données** : aucune ligne dans `zora_games` ne correspond à ces 2 noms (les 5 lignes de la table sont désormais `scratch`/`wheel`/`chest`/`quiz`/`bingo`, voir §2/§2.5). Aucune autre table (`information_schema.tables`) ne porte un nom approchant.
- **Migrations** : `grep -ri "parcours elonga\|album de masques"` sur tout `database/` → **0 résultat**.
- **Code source** : `grep -i "unlock"` sur tout `src/` → **0 résultat** en dehors du service Bingo.
- **Frontend** : les 2 cartes existent bien, en dur, dans `public/patient/dashboard.html:1045-1046`, chacune avec un badge visuel statique `<span class="material-symbols-outlined">lock</span>Bientôt` (fond gris `rgba(67,70,84,0.08)`) — **aucun `onclick`, aucune fonction JS associée**, contrairement aux 5 jeux actifs qui ont chacun un `onclick="A.openGame('...')"`. Ce sont des `<div>` purement statiques, sans logique de progression, sans lien avec une quelconque donnée backend.

**Confirmation explicite** : c'est un simple badge visuel statique, intention produit non commencée techniquement — aucune divergence avec cette conclusion attendue.

### 3.2 « Complétez un défi santé pour gagner une partie » — vérification du lien réel

Le bouton `A.goGagner` affiche un lien texte *« Pas de partie gratuite ? Complétez un défi santé pour en gagner une »* (`dashboard.html:1049`). Vérifié : ce lien pointe vers `A.goGagner()` (`:2540`), qui bascule simplement l'affichage vers l'onglet "Gagner" du dashboard (`panel:'gagner'`) — **aucune fonction n'accorde de partie gratuite supplémentaire suite à un « défi santé »**. Le texte « Défi santé » lui-même (`#defi-sante-titre`, `dashboard.html:843`) désigne en réalité la barre de progression du **Score Bolamu** (`A.renderDefiSante()`, `:2007`), sans aucun rapport avec l'attribution de parties de jeu. Aucune fonction ne crédite de partie gratuite additionnelle nulle part dans `zora-games.service.js` ou `dashboard.html`.

---

## 4. Infrastructure temps réel disponible (existant réel)

`src/services/socketService.js` (lu intégralement le 17 juillet 2026) expose les rooms Socket.io suivantes :

- **`user:${phone}`** (`:43`) — room personnelle rejointe après `authenticate` (vérification JWT), utilisée pour les notifications individuelles (likes, commentaires, follows).
- **`conversation_${conversationId}`** (`:90`) — room de conversation. **Ne peut être rejointe que si le socket est authentifié ET que `isParticipant(conversationId, phone)` retourne vrai**, c'est-à-dire qu'une ligne existe déjà dans `conversation_participants` pour ce couple (`socketService.js:14-21, 72-88`). **Il n'existe aucun mécanisme de création à la volée d'une room entre deux `phone` arbitraires qui ne partagent pas déjà une conversation en base** — pour créer un canal de jeu 1v1 entre deux patients qui ne se sont jamais parlé, il faudrait d'abord créer une conversation (réutilisable, `POST /chat/conversations`, confirmé utilisé par `window.startChat()` à `dashboard.html:4100`) ou construire un nouveau type de room dédié au jeu (aucune trace existante).
- **`group_${groupId}`** (`:196, 242-245`) — room de groupe, utilisée uniquement par l'event `user_joined_group` et `emitToGroup()` ; aucun appelant de `emitToGroup()` trouvé dans le reste de `src/` au 17 juillet 2026 (fonction exportée mais non invoquée ailleurs) — infrastructure présente mais non branchée à un flux réel actuellement.
- **Événements génériques** : `leaderboard_updated` (émis par `awardZora()`, `zora.service.js:208`, diffusion globale `io.emit`, pas une room ciblée), `new_message`/`message_read`/`typing_start`/`typing_stop` (scope conversation).

**Recherche de mécanique de défi/duel/invitation** : `grep -i "challenge\|duel\|invite\|défi"` sur tout `src/` retourne des correspondances, mais **aucune n'est un mécanisme de jeu entre patients** — il s'agit uniquement du champ `follow_requests`/`invite` liés au système de suivi (voir ci-dessous), au parrainage WhatsApp (`inviteWhatsapp`), et à des chaînes de log/config sans rapport (`follows.controller.js`, `dmn.service.js` pour les invitations à consentement, `event.service.js` pour les invitations aux événements Elonga). **Aucune trace d'un système de « défi » ou « duel » entre deux patients.**

**Système de follow (réel, confirmé fonctionnel)** : table `follows` (`follower_phone`, `following_phone`, `created_at`, **4 lignes réelles en base** au 17 juillet 2026), exposée par `src/routes/follows.routes.js` : `GET /following`, `GET /followers`, `GET /status/:phone`, `POST /:phone` (suivre), `DELETE /:phone` (ne plus suivre), `GET /follow-requests`, `PATCH /follow-requests/:id` (accepter/refuser) — toutes protégées par `authMiddleware`. C'est une brique exploitable pour un concept de « défi entre contacts » (§11.7).

**`club_members` (réel, confirmé fonctionnel)** — schéma exact (`information_schema.columns`, 17 juillet 2026) :

| Colonne | Type | Nullable |
|---|---|---|
| `id` | integer | NO (PK) |
| `club_id` | integer | YES (FK → `clubs`) |
| `patient_phone` | character varying | YES (FK → `users`) |
| `joined_at` | timestamp without time zone | YES |
| `is_active` | boolean | YES |

Contrainte `UNIQUE(club_id, patient_phone)`. **7 lignes réelles en base**, ex. `+242069735418` membre de 5 clubs distincts (`club_id` 1, 2, 3, 4, 6), tous `is_active=true`. Cette table est directement utilisable comme brique d'appariement pour un jeu entre membres d'un même club (§11.3, §11.6) : `SELECT patient_phone FROM club_members WHERE club_id=$1 AND is_active=TRUE` donne immédiatement la liste des participants éligibles.

---

## 5. Schéma base de données (existant réel)

Vérifié le 17 juillet 2026 par `information_schema.columns` + `information_schema.table_constraints` + `information_schema.check_constraints` (requêtes réelles, pas de supposition).

### `zora_games` (migration_032)
| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `id` | integer | NO | `nextval(...)` (PK) |
| `game_type` | varchar | NO | — (UNIQUE) |
| `label_fr` | varchar | NO | — |
| `daily_free_plays` | integer | NO | `1` |
| `extra_play_cost` | integer | NO | — |
| `max_gain_per_play` | integer | NO | — |
| `daily_gain_cap` | integer | NO | — |
| `is_active` | boolean | NO | `true` |

Toutes les colonnes ont une contrainte `NOT NULL` explicite (8 contraintes CHECK de type `x IS NOT NULL`, une par colonne — pattern Postgres standard des colonnes `NOT NULL`, pas des CHECK métier). Contrainte `UNIQUE` sur `game_type`. **4 lignes réelles**, détail complet en §2.

### `zora_game_prizes` (migration_032)
| Colonne | Type | Nullable |
|---|---|---|
| `id` | integer | NO (PK) |
| `game_id` | integer | NO (FK → `zora_games`) |
| `label_fr` | varchar | NO |
| `points_value` | integer | NO |
| `probability` | integer | NO |
| `is_active` | boolean | NO |

**15 lignes réelles** (5 par jeu × 3 jeux à lots : scratch, wheel, chest — le quiz n'a aucune ligne ici, voir §2.2). Aucune ligne `game_id=4` (quiz) — confirmé par la requête `SELECT * FROM zora_game_prizes ORDER BY game_id`.

### `zora_game_plays` (migration_032 + `question_id` ajouté par migration_037)
| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `id` | integer | NO (PK) | `nextval(...)` |
| `phone` | varchar | NO (FK → `users`) | — |
| `game_id` | integer | NO (FK → `zora_games`) | — |
| `play_type` | varchar | NO | `'free'` |
| `cost_paid` | integer | NO | `0` |
| `prize_id` | integer | YES (FK → `zora_game_prizes`) | — |
| `points_won` | integer | NO | `0` |
| `server_seed` | varchar | NO | — |
| `played_at` | timestamp | NO | `now()` |
| `question_id` | integer | YES (FK → `zora_quiz_questions`) | — |

**Point vérifié important (voir §9)** : `points_won` stocke le **lot tiré** (`pointsWon` calculé côté serveur), **pas** le montant réellement crédité au ledger — la colonne est renseignée par l'`INSERT` (`zora-games.service.js:251-256`) **avant** l'appel à `awardZora()`, indépendamment du succès de ce dernier.

**24 parties réelles en base** au 17 juillet 2026, réparties : chest (3 free + 1 paid), quiz (3 free + 1 paid), scratch (6 free + 1 paid), wheel (5 free + 4 paid).

### `zora_quiz_questions` (migration_032)
| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `id` | integer | NO (PK) | `nextval(...)` |
| `question` | text | NO | — |
| `option_a`/`b`/`c`/`d` | varchar | NO | — |
| `correct_answer` | character(1) | NO | — |
| `category` | varchar | NO | `'sante'` |
| `difficulty` | varchar | NO | `'facile'` |
| `is_active` | boolean | NO | `true` |

**20 lignes réelles**, toutes `category='sante'`, `is_active=true`. Aucune contrainte `CHECK` sur les valeurs autorisées de `difficulty` (`facile`/`moyen`/`difficile` sont une convention appliquée par le code, pas imposée par le schéma).

### `zora_games_global_cap` (migration_032)
| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| `id` | integer | NO (PK) | `nextval(...)` |
| `daily_total_cap` | integer | NO | `100` |
| `category_cap_percent` | integer | NO | `15` |

**1 seule ligne réelle** (`id=1`, `daily_total_cap=100`, `category_cap_percent=15`). `daily_total_cap` est lu et appliqué (§8) ; `category_cap_percent` **n'est référencé nulle part dans `src/`** (`grep "category_cap_percent" src/` → 0 résultat) — colonne inerte, voir §9.

Migrations : `migration_032_zora_games.sql` (création des 5 tables), `migration_037_zora_game_plays_question_id.sql` (ajout de la colonne `question_id` pour le quiz), `migration_080_zora_game_rules_missing.sql` (ajout des règles `zora_earn_rules` manquantes pour `game_wheel`/`game_chest`/`game_quiz`, cf. §8).

---

## 6. Architecture backend — Fichiers réels

```
src/
├── services/
│   ├── zora-games.service.js     -- checkDailyPlays(), playGame(), submitQuizAnswer(),
│   │                                 getGamesConfig(), getGamesStatus(), getGamesHistory()
│   └── zora.service.js           -- awardZora() (point d'entrée unique de crédit, appelé
│                                     APRÈS COMMIT par playGame()/submitQuizAnswer(), voir §9)
│
└── routes/
    └── zora-games.routes.js      -- montées sur /api/v1/zora (server.js:233)
```

### 6.1 Routes réelles (`zora-games.routes.js`, lu intégralement)

```
GET    /api/v1/zora/games/config       — PUBLIC, aucun authMiddleware — SELECT * FROM zora_games WHERE is_active=TRUE
GET    /api/v1/zora/games/status       — authMiddleware — statut par jeu pour le patient courant
POST   /api/v1/zora/games/play         — authMiddleware — { game_type, play_type } → tirage serveur
POST   /api/v1/zora/games/quiz/answer  — authMiddleware — { play_id, answer } → validation + crédit quiz
GET    /api/v1/zora/games/history      — authMiddleware — historique des parties
```

Montage confirmé dans `server.js:233` : `app.use('/api/v1/zora', zoraGamesRoutes)` — juste après `app.use('/api/v1/zora', zoraRoutes)` (`:232`), les deux routers partageant le même préfixe sans collision de chemin (`/balance`, `/ledger` côté `zoraRoutes` vs `/games/*` côté `zoraGamesRoutes`).

### 6.2 `GET /api/v1/zora/games/config` — reconstitution du JSON réel

**Méthode utilisée** : lecture directe de `getGamesConfig()` (`zora-games.service.js:466-480`, `SELECT * FROM zora_games WHERE is_active = TRUE ORDER BY id`) combinée aux 4 lignes réelles obtenues par requête SQL en §2 — pas de démarrage de serveur local (pas nécessaire, la fonction est une requête SQL directe sans transformation intermédiaire). Le JSON exact retourné par la route au 17 juillet 2026 est donc :

```json
{
  "success": true,
  "data": [
    { "id": 1, "game_type": "scratch", "label_fr": "Carte à gratter", "daily_free_plays": 1, "extra_play_cost": 50, "max_gain_per_play": 30, "daily_gain_cap": 30, "is_active": true },
    { "id": 2, "game_type": "wheel",   "label_fr": "Roue de la fortune", "daily_free_plays": 1, "extra_play_cost": 75, "max_gain_per_play": 50, "daily_gain_cap": 50, "is_active": true },
    { "id": 3, "game_type": "chest",  "label_fr": "Coffre mystère", "daily_free_plays": 1, "extra_play_cost": 100, "max_gain_per_play": 75, "daily_gain_cap": 75, "is_active": true },
    { "id": 4, "game_type": "quiz",   "label_fr": "Quiz santé", "daily_free_plays": 1, "extra_play_cost": 30, "max_gain_per_play": 40, "daily_gain_cap": 40, "is_active": true }
  ]
}
```

**Cette donnée est-elle utilisée par le frontend ?** Non. `dashboard.html:3798` appelle bien la route et stocke le résultat dans `A._gamesConfig = d.data` — mais `grep "_gamesConfig" public/patient/dashboard.html` ne retourne **qu'une seule occurrence dans tout le fichier : celle de l'affectation elle-même**. Aucune autre ligne ne lit `A._gamesConfig`. La configuration réelle des jeux (coûts, plafonds, gains max) est donc **chargée depuis le serveur puis jamais utilisée** ; l'interface affiche à la place les valeurs statiques codées en dur dans `A.gamesList` (§2.4, `dashboard.html:1674-1679`) qui ne correspondent pas exactement aux vraies valeurs serveur (ex. `gain: "Jusqu'à +100"` affiché pour `wheel`, alors que le lot maximum réel en base est +50, voir §2.1 et §9).

---

## 7. Architecture frontend — Par dashboard

**Seul `public/patient/dashboard.html` contient une intégration des jeux Zora** — confirmé par grep exhaustif de `zora/games` sur tout `public/` (les autres fichiers trouvés, `dashboard-old.html`, `dashboard-original-git.html`, `dashboard-dclogic-old.html`, `dashboard-dclogic-backup.html`, sont des copies archivées non servies par `server.js`). Aucun autre dashboard (médecin, pharmacie, laboratoire, admin, secrétaire, RH, animateur, partenaire) n'a de section jeux.

| Élément | Fonction / donnée | Source |
|---|---|---|
| Onglet "Gagner" | `A.goGagner()` (`:2540`) | Bascule d'affichage uniquement |
| Liste des 4 cartes de jeu à tirage | `A.renderGames()` (`:2429`), à partir de `A.gamesList` (statique, `:1674`) | Codé en dur — pas `GET /games/config` (voir §6.2) |
| Carte Bingo Santé (5e jeu, active depuis le 17 juillet 2026) | HTML statique (`:1044`), `onclick="A.openGame('bingo')"` | `GET /zora/games/bingo` (voir §2.5) — hors système `A.gamesList`/`renderGames()` |
| 2 cartes "Bientôt" restantes (Parcours Elonga, Album de Masques) | HTML statique (`:1045-1046`), aucun `onclick` | Aucune |
| Compteur "parties gratuites" affiché (`freeCount`) | `A.state.freeGames`, init à `3` (`:1659`), décrémenté sur chaque partie jouée tous jeux confondus (`:3308, 3321, 3332, 3343`) | Purement client, jamais synchronisé avec `GET /games/status` (jamais appelée, voir §3 et §9) |
| Jouer à la roue | `A.spinWheel()` → `A._wheelFinish()` | `POST /games/play {game_type:'wheel', play_type:'free'}` |
| Jouer au coffre | `A.openChest(i)` | `POST /games/play {game_type:'chest', play_type:'free'}` |
| Jouer au quiz | `A.pickQuiz(i)`, rendu par `A.renderQuiz()` à partir de `A.quizData` (statique, `:1685`, jamais réassigné — voir `grep "quizData ="`, 0 réassignation dans tout le fichier) | `POST /games/play {game_type:'quiz', play_type:'free'}` — **ne soumet jamais la réponse choisie au serveur** (voir §9) |
| Jouer au grattage | `A.playScratch()`, animation canvas `A.initScratch()` | `POST /games/play {game_type:'scratch', play_type:'free'}` |
| Mise à jour visuelle du solde après gain | `A.addZora(n)` (`:3144`) → `A.syncZoraBalance()` (`:3151`) → `GET /zora/balance` | Fonctionnel, confirmé (cf. correctif du 12 juillet 2026 documenté dans `ARCHITECTURE_ZORA_BOLAMU.md` §3.4, revérifié ici : le code est identique à cette description au 17 juillet 2026) |

---

## 8. Règles anti-fraude et plafonds (existant réel)

### 8.1 Plafond par jeu (`daily_gain_cap`) — actif et appliqué

`zora-games.service.js:155` : `gameCapReached = dailyGainToday >= game.daily_gain_cap`. Si atteint (ou si le plafond global `daily_total_cap` est atteint, `:154`), le tirage pondéré est **forcé** sur le lot `points_value=0` (`:227-233`) — le patient continue de "jouer" visuellement mais ne peut plus rien gagner ce jour-là sur ce jeu. Valeurs réelles : scratch=30, wheel=50, chest=75, quiz=40 (identiques à `max_gain_per_play`, §2).

### 8.2 Plafond global (`zora_games_global_cap.daily_total_cap`) — actif et appliqué

`:141-144` : lu depuis `zora_games_global_cap WHERE id=1` (valeur réelle **100**), comparé à la somme de `points_won` tous jeux confondus pour le patient sur la journée (`:146-152`). Actif, confirmé par lecture de code — comportement identique au 12 juillet 2026 (`ARCHITECTURE_ZORA_BOLAMU.md` §3.4, non modifié depuis).

### 8.3 `category_cap_percent` — colonne inerte, confirmé le 17 juillet 2026

`SELECT category_cap_percent FROM zora_games_global_cap` retourne **15**, mais `grep -r "category_cap_percent" src/` (exécuté ce jour) retourne **zéro résultat** dans tout le code applicatif. La colonne existe, est peuplée, mais **n'est lue par aucune fonction** — ni dans `zora-games.service.js`, ni ailleurs. Sans effet réel sur le comportement du jeu.

### 8.4 `max_gain_per_play` — colonne lue mais jamais utilisée pour plafonner un gain individuel

`grep -n "max_gain_per_play" src/` : une seule occurrence hors le schéma, dans `getGamesStatus()` (`:524`), où la valeur est simplement **renvoyée telle quelle** au frontend dans la réponse JSON (`GET /games/status`, elle-même jamais appelée par le frontend patient, voir §9) — **aucune vérification `pointsWon > game.max_gain_per_play` n'existe dans `playGame()`**. En pratique le tirage pondéré ne peut de toute façon jamais dépasser cette valeur car les tables `zora_game_prizes` sont construites avec un lot maximum égal à `max_gain_per_play` (ex. scratch : lot max 30 = `max_gain_per_play` de la ligne `zora_games`) — la colonne décrit donc une contrainte respectée *par construction des données*, pas *appliquée par du code*.

### 8.5 Idempotence et hiérarchie de preuve — héritées de `awardZora()`, appliquées sans changement

Les jeux appellent `awardZora({..., proof_class:'system_event', proof_source:'game_engine', proof_reference: play_id})`. L'idempotence par `(action_type, proof_reference)` (`zora.service.js:92-111`) empêche qu'un même `play_id` soit crédité deux fois. Le plafond journalier par `action_type` (`rule.daily_cap = 3` pour les 4 `action_type` `game_scratch`/`game_wheel`/`game_chest`/`game_quiz`, `SELECT * FROM zora_earn_rules WHERE action_type LIKE 'game%'`, vérifié le 17 juillet 2026) limite à **3 crédits réussis par jour et par jeu**, indépendamment du nombre de parties jouées (une partie "gratuite" au sens `daily_free_plays` peut très bien ne jamais être créditée si les 3 crédits journaliers de ce `action_type` sont déjà consommés par des parties payantes antérieures le même jour).

---

## 9. Dette technique et zones floues (existant réel)

Chaque point ci-dessous a été revérifié personnellement le 17 juillet 2026 (nouvelle lecture de code et/ou nouvelle requête SQL) — les convergences et divergences avec l'audit du 16-17 juillet précédent (`ARCHITECTURE_ZORA_BOLAMU.md` §3.4) sont signalées explicitement.

### 9.1 Prix affiché au tirage ≠ montant réellement crédité — **résolu le 17 juillet 2026 (soir)**

**Constat avant correction** (revérifié le 17 juillet 2026, cf. version 1.0 de ce document) : `awardZora()` insérait `rule.points` (valeur **fixe** par `action_type`, indépendante du lot tiré) dans `zora_ledger` — jamais `pointsWon` (le lot réellement tiré par `zora_game_prizes`). Vérifié par jointure SQL réelle entre `zora_game_plays` et `zora_ledger` :

| play_id | jeu | lot tiré (`points_won`) | crédité en ledger (`rule.points`) | date |
|---|---|---|---|---|
| 90 | wheel | **15** | **50** | 2026-07-12 |
| 81 | scratch | **10** | **50** | 2026-07-10 |
| 72 | scratch | **5** | **50** | 2026-06-27 |
| 63 | scratch | **10** | **50** | 2026-06-23 |

Cela confirmait le constat déjà documenté le 12 juillet 2026 (`ARCHITECTURE_ZORA_BOLAMU.md` §3.4 : "le montant réellement crédité reste celui de la règle... pas le prix affiché au joueur"), explicitement noté à l'époque comme **non corrigé, hors périmètre** de ce premier chantier — cette section-ci ferme ce point ouvert.

**Correction apportée** : `awardZora()` (`src/services/zora.service.js:34`) accepte désormais un paramètre optionnel `override_points`. Quand fourni, le montant réellement inséré dans `zora_ledger`, dans `zora_points.balance`/`total_earned`, dans `audit_log.payload`, et transmis à `feedService.postZoraEarned()`/`chatService.postAchievement()`, est `creditPoints = override_points` — sinon le comportement historique (`rule.points`) est inchangé pour tous les autres appelants (aucun autre point d'appel dans la plateforme ne passe ce paramètre). L'idempotence (`proof_reference`), le plafond journalier (`daily_cap`) et le contrôle de preuve restent basés sur la règle, inchangés. `zora-games.service.js` passe désormais `override_points: pointsWon` dans `playGame()` (scratch/wheel/chest, `:275-283`) et dans `submitQuizAnswer()` (quiz, `:428-436`) — le lot réellement tiré/calculé est donc, pour la première fois, le montant réellement crédité.

**Testé en conditions réelles** (compte `+242069735418`, serveur local branché sur la base Neon de production, `TZ=UTC`), une preuve HTTP + SQL par jeu :

| Jeu | Réponse HTTP (`points_won`) | `zora_ledger` (montant réellement inséré) | Correspondance |
|---|---|---|---|
| scratch | 5 | 5 | ✅ exacte |
| wheel | 5 | 5 | ✅ exacte |
| chest | 10 | 10 | ✅ exacte |
| quiz | 10 (question facile, bonne réponse) | 10 | ✅ exacte |

Toutes les lignes de test ont été nettoyées après validation (`zora_game_plays`/`zora_ledger` de la session de test supprimées, `zora_points.balance`/`total_earned` recalculés à leur valeur d'avant test).

**Nuance restant non traitée** (mineure, pas un blocage) : `zora_game_plays.points_won` est toujours renseigné par l'`INSERT` avant l'appel à `awardZora()` — si celui-ci échoue (plafond `daily_cap=3` atteint), la colonne garde la valeur du lot tiré alors qu'aucun point n'a été crédité. Un lecteur qui n'utiliserait que `zora_game_plays.points_won` comme "vérité" surestimerait donc les gains réellement distribués dans ce cas d'échec précis (déjà présent avant ce chantier, non aggravé par le fix ci-dessus).

### 9.2 Plafond de parties gratuites : par jeu en base, partagé et statique côté frontend — **résolu le 17 juillet 2026 (soir)**

**Constat avant correction** : `daily_free_plays = 1` **individuellement pour chacun des 4 jeux** (colonne par ligne de `zora_games`, §2) côté backend, mais le frontend utilisait `A.state.freeGames`, une **unique variable partagée entre les 4 jeux**, initialisée à `3`, décrémentée à chaque partie quel que soit le jeu, et jamais resynchronisée avec `GET /zora/games/status` (route déjà existante côté backend, `:487-543`, jamais appelée par `dashboard.html`). Un patient qui jouait Grattage+Roue+Coffre gratuitement voyait le Quiz se désactiver visuellement alors que son quota serveur restait intact.

**Correction apportée** (`public/patient/dashboard.html`) :
- `A.state.freeGames` (compteur unique) remplacé par `A.state.gamesStatus` (objet par `game_type`), alimenté au chargement par un nouvel appel `GET /zora/games/status` (route backend préexistante, simplement jamais branchée).
- `A.freeRemaining(gameType)` / `A.totalFreeRemaining()` / `A.updateGameQuota(gameType, remaining)` : nouveaux helpers qui lisent/mettent à jour le quota par jeu.
- `renderGames()` calcule désormais `noFree` **par jeu** (au lieu d'un seul indicateur global) — chaque carte de jeu affiche et désactive son bouton "Jouer" indépendamment des 3 autres.
- Les 4 handlers (`_wheelFinish`, `openChest`, `startQuiz`/`pickQuiz`, `playScratch`) mettent à jour `A.state.gamesStatus[jeu]` avec le `free_plays_remaining` réellement retourné par `POST /games/play`, au lieu de décrémenter un compteur partagé.
- Bug additionnel trouvé en testant et corrigé dans le même chantier : la branche quiz de `playGame()` (`zora-games.service.js:211`) renvoyait `free_plays_remaining` calculé **avant** que la partie en cours ne soit prise en compte (contrairement aux 3 autres jeux) — un patient voyait encore "1 partie gratuite" juste après avoir joué son unique quiz du jour. Corrigé pour les 4 jeux avec une formule uniforme conditionnée sur `play_type === 'free'` (une partie payante ne doit pas décrémenter le quota gratuit).

**Testé en conditions réelles** (Playwright + Chromium headless, serveur local + base Neon de production) : après une partie de quiz jouée, la carte Quiz affiche "Plus de partie" tandis que Grattage/Roue/Coffre restent sur "Jouer" — confirmé par lecture directe du DOM (`document.querySelectorAll('#games-list button')`). Idem vérifié indépendamment pour Grattage (bouton passe à "Plus de partie" seul, ~2s après la partie, les 3 autres jeux restant jouables).

### 9.3 `GET /zora/games/config` — appelée, jamais lue — **partiellement adressé le 17 juillet 2026**

Confirmé en détail au §6.2 : `A._gamesConfig = d.data` (`dashboard.html`) reste la seule occurrence de cette variable dans tout le fichier — `GET /zora/games/config` (route publique, config statique par jeu) est toujours récupérée puis jetée, non modifiée par ce chantier. En revanche, **le vrai problème de fond (aucune donnée par-jeu réelle affichée au patient) est résolu par le §9.2 ci-dessus** : c'est `GET /zora/games/status` (route authentifiée, déjà existante côté backend, jamais appelée avant ce chantier) qui a été branchée — elle apporte le quota réel par jeu que `games/config` n'a jamais eu vocation à fournir (pas de notion d'utilisateur connecté sur cette route publique). Les valeurs de gain statiques de `A.gamesList` (`"Jusqu'à +100"` pour la roue, incohérent avec le vrai maximum de +50) n'ont pas été corrigées — hors périmètre de ce chantier, qui portait sur le crédit et le quota, pas sur l'exactitude des textes marketing des cartes de jeu.

### 9.4 Quiz : réponse du patient jamais transmise au serveur — **résolu le 17 juillet 2026 (soir)**

**Constat avant correction** : `A.pickQuiz(i)` appelait uniquement `POST /games/play {game_type:'quiz'}` pour obtenir une question, puis affichait un résultat basé sur `A.quizData` — un objet **statique codé en dur** (une seule question fixe "Combien de verres d'eau...", jamais réassigné depuis la réponse serveur). `POST /api/v1/zora/games/quiz/answer` (la route qui appelle `submitQuizAnswer()`, seule fonction qui calcule le gain réel et appelle `awardZora()`) n'était jamais appelée par le frontend — problème distinct de "quiz rejouable le lendemain" (déjà documenté), plus en amont : même règle active, le crédit ne pouvait structurellement jamais se produire par ce chemin.

**Correction apportée** (`public/patient/dashboard.html`) :
- Nouvelle fonction `A.startQuiz()`, appelée à l'ouverture du jeu (`A.openGame('quiz')`) : appelle `POST /games/play`, stocke la vraie question/options serveur dans `A._quizData` (objet auparavant statique, désormais rempli dynamiquement), et le `play_id` réel dans `A.state.quizPlayId`.
- `A.pickQuiz(i)` appelle désormais `POST /games/quiz/answer` avec ce `play_id` et la lettre correspondant à l'option choisie — le feedback affiché (bonne/mauvaise réponse, `correct_answer`, montant gagné) provient intégralement de la réponse serveur, plus jamais d'un objet codé en dur.
- `renderQuiz()` compare désormais l'option choisie à `A._quizData.correctIndex`, résolu uniquement **après** réponse du serveur — jamais exposé avant, cohérent avec l'invariant déjà testé côté backend (`correct_answer` jamais présent dans la réponse de `POST /games/play`).
- Ajout mineur côté backend : `playGame()` (branche quiz) renvoie désormais `category` (déjà lue en base, simplement jamais transmise) pour permettre au badge thématique de refléter la vraie question.

**Testé en conditions réelles** (Playwright + Chromium headless, serveur local + base Neon de production) : ouverture du quiz → vraie question aléatoire affichée (ex. *"Quel organe filtre le sang ?"*, options réelles Le foie/Les reins/Le cœur/Les poumons, différente à chaque partie) → réponse soumise → `POST /games/quiz/answer` répond `{correct:false, correct_answer:'b', points_won:0}` → l'écran affiche *"Dommage, la bonne réponse était "Les reins"."* et surligne la bonne réponse en vert, le choix erroné en rouge — vérifié par lecture directe du DOM, pas seulement de l'état JS. Cas de bonne réponse vérifié séparément côté backend (§9.1 : +10 Zora crédité et affiché pour une question facile).

### 9.5 Absence de point d'entrée UI pour les parties payantes — **résolu le 17 juillet 2026 (chantier séparé)**

**Constat avant correction** : les 4 fonctions frontend envoyaient toutes `play_type: 'free'` en dur — aucun bouton ou flux ne permettait d'envoyer `play_type: 'paid'` dans le dashboard patient, alors que le backend supportait pleinement ce mode (déduction de `extra_play_cost`, cf. §2).

**Correction apportée** (`public/patient/dashboard.html`, commit `9d92f98`, aucune modification backend) : quand le quota gratuit du jour est épuisé, le bouton "Jouer" devient "Rejouer · X Z" (ambre, X = `extra_play_cost` réel lu depuis `GET /games/status`). Un clic ouvre un modal de confirmation (nom du jeu, coût, Annuler/Confirmer) avant tout débit. Si le solde est insuffisant, le bouton reste grisé avec un label "Solde insuffisant" — cliquable uniquement pour afficher un toast explicatif, pas de modal. Après confirmation, chacun des 4 déclencheurs de jeu (`spinWheel`, `openChest`, `startQuiz`, `playScratch`) consomme un flag transitoire `A.state.pendingPaidGame` pour envoyer `play_type:'paid'` au lieu de `'free'` — le jeu se déroule ensuite exactement comme une partie gratuite (même code de traitement de la réponse serveur).

**Testé en conditions réelles** (HTTP + SQL, compte `+242069735418`) : partie scratch payante (coût 50, perdante) et partie wheel payante (coût 75, +5 Zora) — `zora_ledger` confirme un `game_play_cost` de -50 et -75 respectivement, `zora_game_plays.play_type='paid'` pour les deux, et le compteur de parties **gratuites** jouées ce jour-là reste à 1 pour chacun des deux jeux (la partie payante ne consomme pas le quota gratuit, cohérent avec le fix §9.2). Cas solde insuffisant vérifié sur les 4 jeux (bouton grisé, modal non ouvert, toast affiché). Non-régression du flux gratuit reconfirmée (quiz : vraie question chargée, `play_type='free'` en base).

### 9.6 Animation roue vs lot réel — **résolu le 17 juillet 2026 (soir)**

**Constat avant correction** : les 8 segments visuels de la roue (`A.wheelSeg`, `+20/+50/+10/+100/+30/Perdu/+75/+15`) étaient tirés côté client par un `Math.random()` **avant même de connaître le résultat serveur**, sur des valeurs ne correspondant pas aux vrais lots (`zora_game_prizes`, game_id=2 : 0/5/15/30/50 uniquement — +100/+20/+75/+10 n'existent pas). Le texte de résultat affiché après l'animation utilisait la vraie valeur serveur, donc le montant annoncé par écrit était correct, mais le disque pouvait visuellement s'arrêter sur un montant impossible à gagner.

**Correction apportée** : `A.wheelSeg` aligné exactement sur les 5 lots réels (`Perdu/+5/+15/+30/+50`, `A.wheelColors` ajusté en conséquence). `A.spinWheel()` attend désormais la réponse de `POST /games/play` **avant** de déclencher l'animation, cherche l'index du segment dont la valeur correspond exactement à `points_won` reçu, et anime la rotation vers ce segment précis — le disque ne peut plus s'arrêter sur une valeur qui n'existe pas dans la table des lots, ni diverger du texte de résultat.

**Testé en conditions réelles** : partie de roue jouée via Playwright, aucune erreur JS, quota mis à jour correctement après la partie (confirmé par lecture de `A.state.gamesStatus.wheel` et de l'état des boutons).

---

## 10. Bibliothèque de jeux futurs — solo (ROADMAP)

> ⚠️ **ROADMAP — NON IMPLÉMENTÉ.** Tout ce qui suit est un concept exploratoire. Aucune ligne de code, aucune table, aucune route n'existe pour ces jeux sauf mention explicite contraire (Parcours Elonga / Album de Masques : teasés visuellement côté frontend uniquement, §3.1 — statut "partiellement construit" au sens strict où un badge UI existe, mais 0% de logique ou de donnée réelle). Bingo Santé, initialement dans cette liste, a été implémenté le 17 juillet 2026 et déplacé vers l'existant réel — voir §2.5 et §10.1.

Rappel du pipeline `awardZora()` à respecter pour toute intégration (documenté et revérifié en §8.5 et dans `ARCHITECTURE_ZORA_BOLAMU.md` §3.1) : `proof_class` (hiérarchie `ground_truth` > `system_event` > `device_measured` > `device_declared`, `device_declared` toujours rejeté), idempotence stricte via `(action_type, proof_reference)`, `daily_cap` par règle `zora_earn_rules`.

### 10.1 Bingo Santé — **implémenté le 17 juillet 2026, déplacé vers l'existant réel (§2.5)**

Ce concept n'est plus roadmap : il est construit, testé et documenté en détail au §2.5. Voir aussi §3.1 (mis à jour) et §9 (aucune dette technique nouvelle propre au Bingo au moment de son lancement).

### 10.2 Parcours Elonga

- **Nom et mécanique** : progression sur une carte/chemin illustrant un parcours de bien-être (nutrition → sport → suivi médical), débloqué par la participation aux événements Elonga réels.
- **Modèle** : solo (asynchrone).
- **Compatibilité `awardZora()`** : bonne — peut réutiliser `action_type='event_checkin'` déjà existant (`event.service.js`, confirmé appelant `awardZora()` dans `ARCHITECTURE_ZORA_BOLAMU.md` §3.3) comme déclencheur de progression, sans nouveau `action_type` nécessaire pour l'earn ; un nouveau `action_type='parcours_elonga_etape'` serait needed uniquement pour un bonus de fin de parcours.
- **Effort** : backend moyen (état de progression par patient, mapping étapes ↔ `elonga_events`) ; frontend élevé (carte/chemin illustré) ; contenu élevé (illustrations, découpage en étapes).
- **Statut** : partiellement construit — badge visuel statique existant (`dashboard.html:1045`), 0% de logique/donnée (§3.1).

### 10.3 Album de Masques

- **Nom et mécanique** : collection de "masques" (illustrations culturelles congolaises) débloqués aléatoirement en jouant aux jeux existants ou en atteignant des paliers Zora.
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : neutre — ne nécessite pas forcément de nouveau crédit Zora (peut être un simple déblocage cosmétique sans point), ou `action_type='masque_debloque'` avec `proof_reference` = ID du masque (idempotent par nature, un masque ne se débloque qu'une fois).
- **Effort** : backend faible (table `masques` + `patient_masques`) ; frontend moyen (grille de collection, état verrouillé/déverrouillé) ; contenu **élevé** (illustrations originales des masques traditionnels — poste de coût principal).
- **Statut** : partiellement construit — badge visuel statique existant (`dashboard.html:1046`), 0% de logique/donnée (§3.1).

### 10.4 Jeu de mémoire/paires à thème santé

- **Nom et mécanique** : grille de cartes retournées deux par deux, thème santé (ex. "fruit" ↔ "vitamine associée").
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : bonne — `action_type='game_memory'`, `proof_reference`=`play_id` (même pattern que scratch/wheel/chest), `proof_class='system_event'`, `daily_cap` classique.
- **Effort** : backend faible (même structure que `zora_game_plays`/`zora_game_prizes`, réutilisable en ajoutant `game_type='memory'` à `zora_games`) ; frontend moyen (logique de grille + timer) ; contenu faible (paires génériques réutilisables).
- **Statut** : conceptuel.

### 10.5 Machine à sous simplifiée (slot 3 rouleaux)

- **Nom et mécanique** : 3 rouleaux tournent, alignement de symboles santé = gain croissant selon la rareté de la combinaison.
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : bonne — même pipeline que `wheel`/`chest` (tirage pondéré serveur, `zora_game_prizes` réutilisable telle quelle en ajoutant `game_type='slot'`).
- **Effort** : backend faible (copie quasi directe de la logique `wheel`) ; frontend moyen (animation 3 rouleaux) ; contenu faible.
- **Statut** : conceptuel. **Point de vigilance produit** : proximité avec un jeu d'argent réel (symbolique de "machine à sous") — à valider avec `/compliance-officer` avant tout développement, notamment au regard des règles Zora existantes ("jamais 1 Zora = X FCFA en communication", `CLAUDE.md`).

### 10.6 Trivia santé (extension du quiz actuel)

- **Nom et mécanique** : extension du quiz existant (§2.2) avec des catégories multiples (nutrition, hygiène, maladies tropicales) et une difficulté progressive par série de bonnes réponses consécutives.
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : déjà démontrée — `submitQuizAnswer()` existe et fonctionne (§2.2), il ne manque que le branchement frontend (§9.4) et l'ajout de catégories dans `zora_quiz_questions.category` (colonne déjà présente, seulement peuplée en `'sante'` aujourd'hui).
- **Effort** : backend **très faible** (le pipeline complet existe déjà, y compris `awardZora()` branché) ; frontend faible-moyen (corriger le flux existant, §9.4, avant d'étendre) ; contenu moyen (rédaction de nouvelles questions par catégorie).
- **Statut** : partiellement construit — c'est en réalité une extension du système déjà en place, dont le défaut principal (§9.4) est un bug d'intégration frontend à corriger avant toute extension de contenu.

### 10.7 Défi quotidien type mot-mystère ("Wordle santé")

- **Nom et mécanique** : deviner un mot du champ lexical santé en un nombre limité d'essais, un seul mot par jour pour tous les patients.
- **Modèle** : solo (avec composante "même mot pour tous" qui crée un effet de communauté asynchrone).
- **Compatibilité `awardZora()`** : bonne — `action_type='game_wordle'`, `daily_cap=1` naturel (un seul mot par jour), `proof_reference` = date du jour (garantit l'unicité naturelle, un seul crédit par patient par jour).
- **Effort** : backend faible (table `mots_du_jour`, logique de comparaison lettre par lettre) ; frontend moyen (clavier virtuel, grille de résultat) ; contenu moyen (liste de mots santé validée médicalement, à renouveler régulièrement).
- **Statut** : conceptuel.

### 10.8 Jeu de collection/déblocage de cartes (mascottes, badges, masques traditionnels congolais)

- **Nom et mécanique** : cartes à collectionner débloquées aléatoirement (mascottes Bolamu, badges de palier Zora, masques traditionnels — recoupe potentiellement l'Album de Masques §10.3).
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : neutre à bonne selon si le déblocage lui-même donne des points ou seulement l'action déclenchante (jouer, atteindre un palier).
- **Effort** : backend faible ; frontend moyen ; contenu **élevé** (illustrations).
- **Statut** : conceptuel — à fusionner avec §10.3 si le produit retient les deux, pour éviter la redondance (masques traditionnels congolais mentionnés dans les deux concepts).

### 10.9 Roue à mises progressives (variante de la roue actuelle, paliers risque/récompense)

- **Nom et mécanique** : le patient choisit une mise (parmi 2-3 paliers de `extra_play_cost`) avant de lancer la roue, la table de lots change selon la mise (mise élevée = probabilité de gain plus faible mais gain max plus élevé).
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : bonne — même pipeline que `wheel` actuel, nécessite plusieurs jeux de lots par palier (une ligne `zora_games` par palier, ou une colonne `stake_tier` sur `zora_game_prizes`).
- **Effort** : backend faible-moyen (extension du schéma `zora_game_prizes` avec un `stake_tier`) ; frontend moyen (sélecteur de mise avant lancement) ; contenu faible.
- **Statut** : conceptuel. **Point de vigilance produit** : risque d'encourager la dépense de points au-delà du raisonnable — à cadrer avec un plafond de mise strict, cohérent avec `daily_gain_cap`/`daily_total_cap` déjà en place (§8).

### 10.10 Puzzle glissant (sliding puzzle) à thème

- **Nom et mécanique** : reconstituer une image (illustration santé/Bolamu) en faisant glisser des tuiles sur une grille, temps chronométré.
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : bonne — `action_type='game_puzzle'`, gain fonction du temps (paliers de points selon rapidité), `proof_reference`=`play_id`.
- **Effort** : backend faible ; frontend moyen-élevé (logique de grille glissante, détection de résolution) ; contenu moyen (images à découper).
- **Statut** : conceptuel.

### 10.11 Mini-jeu de rythme/réflexes (tap au bon moment)

- **Nom et mécanique** : taper l'écran au bon moment (ex. curseur qui traverse une zone cible), plusieurs tentatives par partie, gain selon précision.
- **Modèle** : solo.
- **Compatibilité `awardZora()`** : bonne, avec un point de vigilance spécifique : le tirage devrait rester **calculé côté serveur** (comme les 4 jeux actuels, §2.1) et non côté client, pour éviter qu'un patient modifie le timing perçu ou le score envoyé — le serveur doit recevoir un identifiant de tentative, pas un score brut déclaré par le client (`proof_class='device_declared'` serait rejeté à raison si le score venait tel quel du client sans validation serveur).
- **Effort** : backend faible-moyen (le tirage/la validation de précision doit être recalculée côté serveur à partir d'un timestamp serveur, pas confiée au client) ; frontend moyen-élevé (animation fluide, latence réseau à gérer — pertinent au Congo, cf. §11 sur la qualité de connexion) ; contenu faible.
- **Statut** : conceptuel.

---

## 11. Bibliothèque de jeux futurs — entre patients (ROADMAP)

> ⚠️ **ROADMAP — NON IMPLÉMENTÉ.** Aucun des concepts suivants n'a de code, table, ou route associée. Chaque concept documente explicitement ses risques multijoueur (collusion entre comptes, abandon en cours de partie, disparités de connexion réseau — particulièrement pertinent au Congo où la qualité de connexion mobile est hétérogène).

### 11.1 Défi 1v1 asynchrone (même quiz, meilleur score gagne)

- **Nom et mécanique** : deux patients répondent au même quiz (pas simultanément), le meilleur score déclenche une notification de victoire/défaite.
- **Modèle** : multijoueur asynchrone.
- **Compatibilité `awardZora()`** : bonne pour le gain de points individuel (réutilise `submitQuizAnswer()` existant, §2.2, une fois le bug §9.4 corrigé) ; **un bonus "vainqueur du défi" nécessite un nouvel `action_type` (`game_quiz_challenge_won`) avec `proof_reference` = ID du défi** (naturellement unique et idempotent, un défi ne se termine qu'une fois).
- **Effort** : backend moyen (table `quiz_challenges` : initiateur, adversaire via `follows`, quiz partagé, statut, scores des deux côtés) ; frontend moyen (invitation, affichage du résultat différé) ; contenu faible (réutilise `zora_quiz_questions`).
- **Risques multijoueur** : collusion faible (asynchrone, pas d'interaction en temps réel à manipuler) ; abandon possible si l'adversaire ne répond jamais — nécessite une expiration du défi (ex. 48h) sans pénalité pour l'initiateur.
- **Statut** : conceptuel.

### 11.2 Duel en temps réel (le plus rapide gagne)

- **Nom et mécanique** : deux patients connectés simultanément répondent à la même question, le plus rapide à bonne réponse gagne.
- **Modèle** : multijoueur temps réel.
- **Compatibilité `awardZora()`** : **rupture explicite à signaler** — pas de `proof_reference` naturel évident pour "le gagnant d'un duel en direct" sans construire un identifiant de session de duel dédié (ex. `duel_id` généré à la création de la room) ; le pipeline `awardZora()` (transactionnel, appelé après COMMIT pour éviter les deadlocks constatés en §9 de `ARCHITECTURE_ZORA_BOLAMU.md`) n'a pas été conçu pour créditer deux comptes en une seule opération logique — il faudrait deux appels `awardZora()` séquentiels (un par joueur), avec le risque qu'un des deux échoue silencieusement sans que l'autre le sache si le retour n'est pas vérifié des deux côtés (piège déjà rencontré et documenté pour les jeux solo, §9.1).
- **Effort** : backend **élevé** (nouvelle room Socket.io dédiée — aucune brique de room ad-hoc entre deux `phone` n'existe aujourd'hui, §4 — synchronisation des deux clients, gestion de la latence pour départager qui a répondu en premier) ; frontend élevé (état temps réel, compte à rebours partagé) ; contenu faible.
- **Risques multijoueur** : **disparités de connexion réseau** — un patient avec une meilleure connexion (fibre/4G stable en zone urbaine) aurait un avantage structurel sur un patient en zone à connectivité mobile intermittente, ce qui rendrait le "plus rapide gagne" injuste indépendamment du mérite ; **abandon en cours de partie** — nécessite un timeout et une règle de forfait claire (déconnexion = défaite ou partie annulée sans impact Zora ?) ; collusion faible à modérée (deux comptes contrôlés par la même personne pourraient se faire perdre volontairement l'un l'autre pour multiplier les gains si mal plafonné — nécessite un plafond par compte indépendant du résultat du duel, pas seulement par duel).
- **Statut** : conceptuel — le concept le plus coûteux à construire de cette bibliothèque, infrastructure Socket.io de room ad-hoc à créer de zéro (§4).

### 11.3 Classement de club en jeu (cumul hebdomadaire des gains des membres)

- **Nom et mécanique** : cumul des gains de jeux (§2) des membres d'un même club sur une semaine, classement inter-clubs.
- **Modèle** : multijoueur asynchrone (compétition de groupe, pas d'interaction directe entre joueurs).
- **Compatibilité `awardZora()`** : très bonne — **aucun nouveau crédit Zora nécessaire**, une simple requête d'agrégation en lecture sur `zora_ledger` (filtrée par `action_type LIKE 'game_%'`, jointe à `club_members` pour grouper par `club_id`) suffit à construire le classement ; réutilise directement la brique `club_members` confirmée fonctionnelle en §4.
- **Effort** : backend faible (requête d'agrégation, pas d'écriture) ; frontend moyen (vue classement par club, distincte du classement individuel déjà existant `GET /leaderboard/weekly`) ; contenu faible.
- **Risques multijoueur** : collusion modérée — un patient pourrait rejoindre un club juste avant la fin de la semaine pour bénéficier d'un effort collectif sans y avoir contribué (nécessite une règle d'ancienneté minimale dans le club, ex. via `club_members.joined_at` déjà disponible) ; pas de risque de connexion réseau (asynchrone, pas de round-trip temps réel).
- **Statut** : conceptuel — le plus simple à construire de la liste multijoueur, s'appuie entièrement sur des briques déjà fonctionnelles (`club_members`, `zora_ledger`).

### 11.4 Pari amical Zora (deux patients misent sur l'issue d'un mini-jeu)

- **Nom et mécanique** : deux patients misent chacun le même montant de Zora Points sur l'issue d'un mini-jeu (ex. qui aura le meilleur score au quiz), le gagnant remporte la mise combinée.
- **Modèle** : multijoueur asynchrone ou temps réel selon implémentation.
- **Compatibilité `awardZora()`** : **rupture explicite, la plus sensible de cette bibliothèque** — `awardZora()` n'a pas de mécanisme de **transfert** entre deux comptes patients (le seul débit inter-compte existant dans toute la plateforme est `generateBonZora()`, un débit patient → système, jamais patient → patient, `ARCHITECTURE_ZORA_BOLAMU.md` §4.2) ; construire un pari nécessite une transaction atomique à 3 pattes (débit des deux mises, crédit du gagnant) totalement absente du pipeline actuel, avec un risque d'idempotence si mal conçu : si le crédit du gagnant échoue après que les deux débits ont réussi, les points misés disparaissent sans compensation, sauf logique de compensation dédiée (rollback explicite ou remboursement différé). **Risque de self-dealing signalé explicitement** : rien n'empêche aujourd'hui une même personne de contrôler deux comptes patients (deux numéros de téléphone) pour se parier à elle-même et garantir un gain net (la mise perdante d'un compte devient le gain de l'autre, sans risque réel) — nécessiterait une détection de comptes liés (même appareil, même IP, mêmes contacts d'urgence) inexistante aujourd'hui dans `fraud_signals` pour ce contexte (confirmé non branché sur Zora, `ARCHITECTURE_ZORA_BOLAMU.md` §13).
- **Effort** : backend **élevé** (transaction à 3 pattes, détection anti self-dealing, gestion des égalités/annulations) ; frontend moyen ; contenu faible.
- **Risques multijoueur** : self-dealing (détaillé ci-dessus, le risque principal) ; abandon en cours de pari (l'un des deux patients ne termine jamais le mini-jeu — nécessite un timeout avec remboursement des deux mises, pas de gain ni perte) ; disparités de connexion si le mini-jeu sous-jacent est temps réel (hérite des risques de §11.2).
- **Statut** : conceptuel — concept nécessitant la validation explicite de `/security-officer` et `/zora-lead` avant toute spécification détaillée, du fait du risque de self-dealing.

### 11.5 Tournoi hebdomadaire par bracket (élimination directe, asynchrone)

- **Nom et mécanique** : bracket à élimination directe sur plusieurs jours (ex. 8 ou 16 patients), chaque tour comparant les scores à un même quiz/jeu sur une fenêtre de temps donnée, sans nécessiter de simultanéité.
- **Modèle** : multijoueur asynchrone.
- **Compatibilité `awardZora()`** : bonne pour le gain individuel de chaque manche (réutilise le pipeline solo existant) ; un bonus de progression dans le bracket (`action_type='tournoi_tour_gagne'`) est idempotent par nature (`proof_reference` = ID de manche, un tour ne se joue qu'une fois par bracket) ; s'appuie sur le leaderboard hebdomadaire déjà existant (`GET /leaderboard/weekly`, confirmé fonctionnel dans `ARCHITECTURE_ZORA_BOLAMU.md`) comme source de classement pour départager les scores de chaque tour.
- **Effort** : backend élevé (génération du bracket, gestion des tours, avancement automatique, gestion des forfaits) ; frontend élevé (visualisation de bracket, notifications de tour) ; contenu faible (réutilise les jeux/quiz existants).
- **Risques multijoueur** : abandon en cours de tournoi — nécessite une règle de forfait automatique (score 0 si le patient ne joue pas dans la fenêtre du tour, l'adversaire passe au tour suivant) ; collusion faible (asynchrone, difficile de coordonner une triche entre 8-16 participants sans se faire remarquer) ; disparité de connexion faible (asynchrone, chaque patient joue dans sa propre fenêtre de temps).
- **Statut** : conceptuel.

### 11.6 Coopératif à objectif commun (score cumulé de club)

- **Nom et mécanique** : un club entier doit atteindre un score cumulé de jeux (ex. 5000 Zora Points cumulés en une semaine, tous membres confondus) pour débloquer une récompense collective (ex. un programme partenaire à coût réduit pour tous les membres).
- **Modèle** : multijoueur asynchrone (coopératif, pas compétitif).
- **Compatibilité `awardZora()`** : très bonne — même principe que §11.3 (agrégation en lecture sur `zora_ledger` via `club_members`), avec en plus un crédit collectif final (`action_type='club_objectif_atteint'`, `proof_reference` = ID club + semaine, idempotent par construction) déclenché une fois pour chaque membre actif du club au moment de l'atteinte de l'objectif.
- **Effort** : backend moyen (cron ou vérification à chaque `awardZora()` réussi pour détecter le franchissement du seuil collectif, distribution du crédit à tous les membres actifs) ; frontend moyen (barre de progression collective, notification de déblocage) ; contenu faible.
- **Risques multijoueur** : collusion faible à modérée (un membre pourrait rejoindre juste avant le déblocage pour bénéficier de l'effort collectif sans contribution — même mitigation que §11.3, ancienneté minimale via `joined_at`) ; pas de risque de connexion réseau (asynchrone).
- **Statut** : conceptuel.

### 11.7 Défi entre contacts (via le système de follow existant)

- **Nom et mécanique** : un patient défie un contact qu'il suit (ou qui le suit, `follows`, §4) à un jeu ou un quiz, avec notification WhatsApp du résultat final.
- **Modèle** : multijoueur asynchrone.
- **Compatibilité `awardZora()`** : bonne — mécaniquement identique à §11.1 (défi 1v1 asynchrone), la seule différence est la source d'appariement (`follows` plutôt qu'un adversaire aléatoire ou un autre membre de club) ; la notification de résultat réutilise `sendAutoMessage()` (déjà utilisé pour les gains de jeu, `zora-games.service.js:304`, confirmé fonctionnel).
- **Effort** : backend moyen (même structure que §11.1, avec vérification que l'adversaire est bien dans `follows` avant de permettre le défi) ; frontend moyen (sélection d'un contact suivi depuis `GET /following`, déjà existant) ; contenu faible.
- **Risques multijoueur** : collusion modérée (deux comptes qui se suivent mutuellement pourraient se défier en boucle pour multiplier des bonus de "défi gagné" si le `daily_cap` de ce nouvel `action_type` n'est pas strictement plafonné, ex. 1 défi bonus par jour par patient indépendamment du nombre d'adversaires) ; abandon possible (le contact défié ignore le défi — nécessite une expiration, même mitigation que §11.1).
- **Statut** : conceptuel — seul concept de cette liste qui s'appuie sur une brique sociale (`follows`) entièrement neuve dans ce contexte (jamais utilisée pour du jeu jusqu'ici), mais confirmée fonctionnelle et peuplée (4 lignes réelles, §4).

---

## 12. Glossaire

| Terme | Statut | Source |
|---|---|---|
| **`zora_games`** | Réel | 5 lignes, `game_type` scratch/wheel/chest/quiz/bingo (bingo ajouté 17 juillet 2026), §2/§2.5 |
| **`zora_game_prizes`** | Réel | 19 lignes (5×3 jeux à tirage + 4 lignes de référence Bingo, non tirées aléatoirement), §2/§2.5/§5 |
| **`zora_game_plays`** | Réel | 24 parties historiques, `points_won` = lot tiré ≠ crédit réel, §9.1 |
| **`zora_quiz_questions`** | Réel | 20 questions actives, catégorie unique `sante` |
| **`zora_games_global_cap`** | Réel | 1 ligne, `daily_total_cap=100` actif, `category_cap_percent=15` inerte (§8.3) |
| **`daily_free_plays`** | Réel | Par jeu individuellement (1 chacun), pas un plafond partagé — divergence frontend documentée §9.2 |
| **`A.state.freeGames`** | Réel (bug) | Compteur client statique partagé, initialisé à 3, jamais synchronisé avec le backend, §9.2 |
| **`A._gamesConfig`** | Réel (mort) | Récupéré via `GET /games/config`, jamais lu ensuite, §9.3 |
| **Déblocage séquentiel entre jeux** | Inexistant | Aucun mécanisme trouvé, §3 |
| **Bingo Santé** | Réel (5e jeu) | Grille hebdomadaire persistante, tables dédiées `bingo_grids`/`bingo_actions`, implémenté 17 juillet 2026, §2.5 |
| **Parcours Elonga / Album de Masques** | Vision (badge visuel seul) | 0% backend, §3.1 |
| **Room Socket.io ad-hoc entre deux `phone`** | Inexistant | Rooms liées à une conversation déjà existante en base uniquement, §4 |
| **`club_members`** | Réel | Brique d'appariement fonctionnelle, 7 lignes, §4 |
| **`follows`** | Réel | Système de suivi fonctionnel, 4 lignes, §4 |
| **Pari amical Zora (transfert patient → patient)** | Vision | Aucun mécanisme de transfert inter-compte dans `awardZora()`, risque self-dealing signalé, §11.4 |

---

*Document créé le 17 juillet 2026 sur la base d'une vérification exhaustive du code (`src/services/zora-games.service.js`, `src/services/zora.service.js`, `src/routes/zora-games.routes.js`, `src/services/socketService.js`, `public/patient/dashboard.html`) et de requêtes SQL en lecture seule exécutées ce jour contre la base Neon de production (`zora_games`, `zora_game_prizes`, `zora_game_plays`, `zora_quiz_questions`, `zora_games_global_cap`, `club_members`, `follows`, `zora_ledger`, `zora_earn_rules`). Aucun contenu des sections 1-9 n'est une supposition ni une reprise non vérifiée d'un document antérieur — le contenu vision est explicitement isolé en sections 10-11.*
