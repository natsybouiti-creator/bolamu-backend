# Architecture UX/UI — Bolamu

> Document de référence sur la charte visuelle, le design system et l'architecture de navigation.
> S'appuie sur `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (dashboards par rôle, guards déjà détaillés) — non répété ici.
> Sources : `public/patient/dashboard.html` (référence principale), `public/admin/dashboard.html`, `public/medecin/dashboard.html`, `public/js/bolamu-nav.js`, `AUDIT_CONTRATS_API_BILATERAL.md`.

---

## 0. Design system Bolamu

**Couleurs** confirmées en usage réel (grep direct sur `patient/dashboard.html` et `admin/dashboard.html`) :
- Fond : `#FAF8FF` (`body { background: #FAF8FF; }`)
- Bleu principal / navy : `#0A2463`
- Bleu action : `#003FB1` (utilisé pour icônes actives, boutons primaires, anneau Score Bolamu)
- Turquoise : `#00C9A7`
- Orange : `#FF6B35` (streaks, alertes)
- Or : `#F5A623` (badges palier Zora, ex. « Liboso »)
- Erreur : `#BA1A1A`

**Typographie** : `Plus Jakarta Sans` exclusivement, chargée via Google Fonts (`<!-- Polices : Material Symbols + Plus Jakarta Sans (Google Fonts) -->`), appliquée sur `body` et répétée en inline sur de nombreux éléments (boutons, inputs, Leaflet map). Aucune autre police trouvée dans les fichiers audités.

**Icônes** : `Material Symbols Outlined` exclusivement — confirmé sur 43 fichiers `public/**/*.html` (`grep -l material-symbols-outlined`). **Zéro emoji résiduel trouvé** dans `patient/dashboard.html` (recherche de plages Unicode emoji : 0 occurrence) — la règle « zéro emoji » semble respectée au moins sur ce fichier de référence.

**Border-radius** : cartes `2rem` (panneaux plein écran, cf. `#event-panel` etc.), boutons pill `9999px` (badges palier Zora, CTA).

**Ombre** : `box-shadow: 0 4px 12px rgba(10,36,99,0.1)` (CTA flottants, ex. bouton « Participer » événement) — cohérent avec le token documenté.

---

## 1. Structure de navigation

**Hub unique patient** : `public/patient/dashboard.html` est bien le hub central — bottom navigation fixe (`<nav class="bottom-nav" style="position: fixed; bottom: 0;...">`), icônes Material Symbols, backdrop-filter blur. Padding géré avec `env(safe-area-inset-bottom)` pour compatibilité iOS.

**Panneaux plein écran** (clubs, événements, abonnement) : confirmé — `#event-panel, #participant-panel, #club-panel, #club-chat-panel, #abonnement-panel { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:#FAF8FF; z-index:1000; animation: slideInUp 300ms ease; }`. Ouverture par bascule `display:none`→`flex`/`block` en JS, pas de framework de routing.

**⚠️ Incohérence de navigation entre dashboards** — deux systèmes de navigation différents coexistent selon le rôle :
1. **Patient** : bottom nav mobile-first + panneaux plein écran (pas de `bolamu-nav.js`).
2. **8 autres dashboards** (`agent`, `secretaire`, `admin`, `medecin`, `rh`, `admin/content`, `laboratoire`, `pharmacie`) : partagent `public/js/bolamu-nav.js` — système `.panel`/`.tab`/`.bnav-item` avec fonction `showPanel(panelId)` commune, exposée aussi via `go()` dans certains fichiers (cf. règle CLAUDE.md « panels admin : go() gère display »).
3. **`animateur`, `partenaire`, `agence`** : n'utilisent ni l'un ni l'autre système d'après la recherche (`bolamu-nav.js` non inclus) — navigation probablement ad hoc, non auditée en détail dans cette passe.

**⚠️ Violation confirmée de la règle CLAUDE.md « Sidebar gauche fixe — JAMAIS (navbar horizontale uniquement) »** : `public/admin/dashboard.html` utilise bien une **sidebar fixe à gauche** (`.sidebar { width:var(--sidebar); height:100vh; position:fixed; top:0; left:0; z-index:100; }` + `.sidebar-ov` pour l'overlay mobile) — ceci contredit directement la règle documentée dans `CLAUDE.md` (section `/ui-designer`). À faire trancher : soit la règle CLAUDE.md est obsolète (le dashboard admin a toujours été en sidebar et la règle visait les autres dashboards), soit c'est une vraie dérive à corriger — non tranché ici, aucune modification de code faite.

---

## 2. Dashboards par rôle

Le détail des fichiers, guards de sécurité et clés localStorage par rôle est déjà exhaustivement documenté dans **`ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md`** §1/§3 — non répété ici. Rappel synthétique des points structurels UX propres à chaque dashboard :

| Rôle | Fichier | Navigation | Guard |
|---|---|---|---|
| patient | `patient/dashboard.html` | bottom nav + panneaux plein écran | voir RBAC §3 |
| doctor | `medecin/dashboard.html` | `bolamu-nav.js` (tabs/panels) | voir RBAC §3 |
| pharmacie | `pharmacie/dashboard.html` | `bolamu-nav.js` | voir RBAC §3 |
| laboratoire | `laboratoire/dashboard.html` | `bolamu-nav.js` | voir RBAC §3 |
| secretaire | `secretaire/dashboard.html` | `bolamu-nav.js` | voir RBAC §3 |
| rh | `rh/dashboard.html` | `bolamu-nav.js` | voir RBAC §3 |
| admin | `admin/dashboard.html` | **sidebar fixe** (hors norme, voir §1) | voir RBAC §3 |
| content_admin | `admin/content.html` | `bolamu-nav.js` | voir RBAC §3 |
| agent_bolamu | `agent/dashboard.html` + `agence/dashboard.html` (doublon, voir RBAC §4) | `bolamu-nav.js` (agent) / ad hoc (agence) | voir RBAC §3 |
| animateur | `animateur/dashboard.html` | ad hoc (pas `bolamu-nav.js`) | voir RBAC §3 |

**Bugs frontend identifiés** (déjà documentés dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3, rappelés ici car pertinents UX) :
- `medecin/dashboard.html:1575` — `logout()` supprime la clé `bolamu_medecin_token`, qui n'existe pas (la vraie clé est `bolamu_doctor_token`) — résidu de renommage `medecin`→`doctor`, le logout ne nettoie donc pas correctement le stockage local.
- 4 versions obsolètes de `patient/dashboard.html` conservées dans le même dossier (`dashboard-old.html`, `dashboard-dclogic-old.html`, `dashboard-dclogic-backup.html`, `dashboard-original-git.html`) — dette de nettoyage, aucune n'est la version active.
- `secretaire/dashboard_v2.html` — prototype de test avec guard désactivé en dur dans le code, à ne pas confondre avec `dashboard.html` (seul actif).

---

## 3. Composants réutilisables

- **Cards de données** (stats, compteurs) — motif répété : conteneur `border-radius: 2rem` (ou variable équivalente), fond blanc/`#FAF8FF`, ombre légère.
- **Toast notifications** — `A.showToast(msg)` (`patient/dashboard.html:2439`) : écrit dans `A.state.toast`, déclenche `A.renderToast()`, auto-effacement après 2800ms (`setTimeout` avec annulation du timer précédent si un nouveau toast arrive). Exposée globalement via `window.showToast = function(m){ A.showToast(m); }` pour appel depuis du code non namespacé.
- **Chat interne** — polling 5s confirmé (`setInterval` dédié au chat club dans `patient/dashboard.html`, distinct des autres `setInterval` de la page — voir aussi `ARCHITECTURE_SOINS_BOLAMU.md` §9 point 9 : ce polling 5s existe pour le chat social/club mais **pas** pour les files d'attente médicales, qui elles ne sont jamais auto-rafraîchies).
- **Panneaux plein écran** — `position:fixed; inset:0 (ou top/left/width/height 100vw/100vh); z-index ≥1000; animation: slideInUp 300ms ease;` — motif identique sur tous les panneaux détail patient (clubs, events, abonnement, story viewer avec `z-index:9999` pour passer au-dessus des autres panneaux).
- **QR codes** — `A.renderQR(id, text, size)` utilise la librairie `QRCode` avec retry différé (jusqu'à 40 tentatives à 150ms si l'élément DOM n'est pas encore monté) — pattern défensif pour composants montés de façon asynchrone.

---

## 4. Mascotte et assets

- **Mascotte** : `garcons3Dbleu.png` (`/images/landing/garcons3Dbleu.png`) — utilisée sur le widget Score Bolamu (animation `zoraFloat 4s ease-in-out infinite`) et au moins une autre section patient.
- **Coin Zora** : `zora-coin-gold.png` — référence attendue par le brief mais non confirmée par grep direct dans cette passe (à vérifier si le nom de fichier a changé — présence de plusieurs assets Zora dans `public/images/` non tous audités individuellement).
- **Logo** : `bolamu.co/favicon.ico` — favicon standard, logo principal documenté ailleurs (`/images/landing/bolamu-logo-final.png`, `h-12 w-12 rounded-full` selon CLAUDE.md, non revérifié dans cette passe).

---

## 5. Règles absolues UI (à ne jamais violer)

- **Zéro emoji dans le code HTML/CSS/JS** — confirmé respecté sur `patient/dashboard.html` (0 occurrence trouvée).
- **Material Symbols Outlined uniquement** — confirmé sur 43 fichiers, aucune autre bibliothèque d'icônes détectée.
- **Plus Jakarta Sans uniquement** — confirmé, aucune autre police trouvée dans les fichiers audités.
- **Fond `#FAF8FF`** (jamais blanc pur) — confirmé sur `patient/dashboard.html`.
- **Pas de localStorage/sessionStorage dans les artifacts** — règle d'outillage Claude Code, sans rapport direct avec le code Bolamu audité ici.
- **Tests contre bolamu.co uniquement, jamais localhost** — règle de process héritée de l'ancien doc Communauté (`ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.SUPERSEDED.md`), reprise dans le protocole de test du projet (`PROTOCOL_TEST_BOLAMU.md`, hors périmètre de lecture de cette passe).
- **⚠️ Violation trouvée** : « Sidebar gauche fixe — JAMAIS » n'est **pas respectée** par `admin/dashboard.html` (voir §1) — seule dérive confirmée dans cette passe parmi les règles listées.

---

## 6. Patterns d'appel API depuis le frontend

**`apiFetch()`** (`patient/dashboard.html:1384-1428`) : wrapper autour de `fetch()` qui injecte automatiquement `Authorization: Bearer <bolamu_patient_token>`. Sur réponse 401/403 : tente un refresh via `POST https://www.bolamu.co/api/v1/auth/refresh` avec `bolamu_patient_refresh` ; si succès, réécrit `bolamu_patient_token` (+ variante `bolamu_patient_token_<phone>`) en `localStorage` et **rejoue automatiquement la requête originale** avec le nouveau token ; si échec (pas de refresh token, ou refresh invalide), `localStorage.clear()` + redirection `/login.html?reason=session_expired`.

**⚠️ Incohérence d'usage** : d'après `AUDIT_CONTRATS_API_BILATERAL.md` (audit statique du 28 juin 2026), la majorité des appels métier du dashboard patient (chargement initial : profil, solde Zora, streak, events, leaderboard, constantes, timeline, etc. — une vingtaine d'endpoints listés) utilisent un `fetch()` brut plutôt que `apiFetch()`, **sans le mécanisme de refresh automatique** documenté ci-dessus.

**Gestion des erreurs 401** : intercepteur global additionnel présent sur plusieurs dashboards non-patient (`medecin`, `agence`, `agent`, `rh` — voir `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3), qui remplace directement `window.fetch` pour forcer `localStorage.clear()` + redirect sur tout 401, dupliqué indépendamment dans chaque fichier plutôt que mutualisé.

**Gestion offline/réseau lent** : l'audit `AUDIT_CONTRATS_API_BILATERAL.md` relève un nombre important d'appels **« 🔴 SILENCIEUX »** — `catch(() => {})` vide sur la quasi-totalité des chargements `componentDidMount` (profil, Zora, streak, events, leaderboard, sport-groups, constantes, timeline, access-log, games config, doctors, vouchers, dmn access-log...) : en cas d'échec réseau, l'utilisateur ne voit **rien** — pas de toast, pas d'état d'erreur, la section reste simplement vide/non chargée. Seuls certains endpoints d'action (paiement, inscription événement, jeux Zora scratch/wheel/chest/quiz, vérification mot de passe DMN) affichent un retour utilisateur explicite (toast d'erreur), généralement avec un garde anti-double-clic mais **sans désactivation visuelle du bouton** pendant la requête (« ❌ pas de disable bouton » relevé sur plusieurs entrées de l'audit).

---

## 7. Accessibilité et mobile-first

- **Viewport** : `<meta name="viewport" content="width=device-width, initial-scale=1">` — confirmé sur `patient/dashboard.html`.
- **Safe area iOS** : `env(safe-area-inset-bottom)` utilisé sur la bottom nav, le composer de messages (chat), et les CTA plein écran flottants (ex. bouton « Participer » événement) — pattern cohérent appliqué à tous les éléments fixes en bas d'écran.
- **Taille de police minimale** : 117 occurrences de tailles `0.7x rem` trouvées sur `patient/dashboard.html` (grep `font-size: 0.7…rem`), cohérent avec un plancher autour de `0.78rem`/`0.7rem` pour le texte secondaire — pas de valeur inférieure à `0.58rem` identifiée isolément lors des lectures précédentes (ex. badge palier Zora à `0.58rem`, la plus petite taille rencontrée dans les extraits lus), à confirmer par un audit exhaustif si un seuil strict doit être imposé.
- **Touch targets** : non mesurés précisément dans cette passe (pas de règle `min-height`/`min-width` 44px systématique identifiée par grep) — à auditer séparément si nécessaire.
