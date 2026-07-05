# Architecture UX/UI — Bolamu

> Document de référence sur la charte visuelle, le design system et la navigation.
> **Source canonique du design system : `docs/design_system.md`** — ce document reflète fidèlement ses tokens/règles ; toute divergence entre le code HTML observé et `design_system.md` est documentée explicitement comme dette de conformité, sans être corrigée dans le code.
> S'appuie aussi sur `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (dashboards par rôle, guards déjà détaillés) — non répété ici.
> Sources : `docs/design_system.md`, `public/patient/dashboard.html` (référence principale du code observé), `public/admin/dashboard.html`, `public/medecin/dashboard.html`, `public/js/bolamu-nav.js`, `AUDIT_CONTRATS_API_BILATERAL.md`, `CLAUDE.md` (règle `/ui-designer`).

---

## 0. Design system Bolamu

**Couleurs (tokens canoniques `design_system.md` §1)** :
- `--brand-navy` `#0A2463` → titres, navbar, footer, fonds sombres
- `--brand-turquoise` `#00C9A7` → icônes check, badges validation, accents santé
- `--brand-orange` `#FF6B35` → **Zora rewards et tags lifestyle uniquement** (pas un orange générique d'alerte — voir aussi `--zora-primary`, même valeur, §11)
- `--primary` `#003FB1` → boutons CTA, liens actifs, highlights interactifs (c'est le « bleu action », pas `--brand-navy`)
- `--primary-fixed` `#DBE1FF` → fond des badges pill « disponibilité »
- `--surface` `#FAF8FF` → fond global de toutes les pages (confirmé en usage réel sur `patient/dashboard.html`)
- `--surface-container-low` `#F3F3FE` → sections alternées (pricing, blog), header de tableaux dashboard (§9)
- `--surface-container` `#EDEDF8` → fonds secondaires légers
- `--on-surface` `#191B23` → texte body principal
- `--on-surface-variant` `#434654` → texte secondaire/labels
- `--outline-variant` `#C3C5D7` → bordures cartes, dividers
- Statuts (dashboards, §9) : succès `#00C9A7`, erreur `#BA1A1A`, warning `#FF6B35`, info `#003FB1`
- **`#F5A623` (or) n'est pas un token de marque global** — c'est `--zora-gold`, réservé exclusivement aux composants de gamification Zora (étoiles, rangs élevés — §11 de `design_system.md`), à ne pas utiliser comme couleur d'accent générique. Ma précédente version de ce document le listait à tort au même niveau que navy/turquoise/orange/primary — corrigé ici.

**Typographie** — `Plus Jakarta Sans` exclusivement (Google Fonts), **aucune exception**. Échelle complète (jamais documentée dans la version précédente de ce fichier, qui se limitait à « Plus Jakarta Sans exclusivement ») :
| Niveau | Taille | Poids | Couleur |
|---|---|---|---|
| H1 | `clamp(2.5rem, 5vw, 3.75rem)` | 800 | `--brand-navy` |
| H2 | `clamp(1.75rem, 3vw, 2.25rem)` | 800 | `--brand-navy` |
| H3 | `1.25rem` | 700 | `--brand-navy` |
| Body large | `1.125rem` | 500 | `--on-surface-variant` |
| Body small | `0.875rem` | 500 | `--on-surface-variant` |
| Overline/badge | `0.625rem` (10px) | 800, uppercase, `letter-spacing:0.2em` | — |

Poids autorisés : 400/500/600/700/800 uniquement — **`font-weight: 900` explicitement interdit** (non supporté par Plus Jakarta Sans selon `design_system.md` §10).

**Border-radius** — échelle à 5 niveaux (ma version précédente simplifiait à tort en « cartes 2rem, boutons pill 9999px » ; en réalité chaque contexte a son propre token) :
| Token | Valeur | Usage |
|---|---|---|
| `--radius-xs` | 4px | éléments UI mineurs |
| `--radius-sm` | 8px | boutons outline, inner cards |
| `--radius-md` | 12px | cards standards |
| `--radius-lg` | 24px (`rounded-3xl`) | **soft-card** (composant signature, §3), sections imagées |
| `--radius-xl` | 32–40px | hero cards, sections Elonga |
| `--radius-full` | 9999px | boutons CTA pill, badges, avatars |
Règle absolue : jamais de `border-radius` < 8px sur une carte, jamais < 9999px sur un CTA principal.

**Ombres** — 4 tokens distincts (ma version précédente n'en citait qu'un seul, générique, absent de `design_system.md`) :
- CTA primaire bleu : `0 8px 24px rgba(0,63,177,0.25)`
- CTA orange Zora : `0 8px 24px rgba(255,107,53,0.20)`
- Card hover : `0 12px 40px rgba(0,63,177,0.08)`
- Card élevée (hero, témoignage) : `0 24px 64px rgba(0,0,0,0.12)`
- **Règle absolue** : jamais d'ombre noire brute non teintée (`rgba(0,0,0,0.3)` type) — toujours teinter avec la couleur du contexte. Aucun élément plat (nav, badges, dividers) ne porte d'ombre.

**Spacing** (jamais documenté dans la version précédente) : `--space-xs` 4px, `--space-base` 8px, `--space-sm` 12px, `--space-gutter` 16px, `--space-md` 24px (padding cards), `--space-container` 20px (marges latérales page), `--space-lg` 40px, `--space-xl` 64px. Max-width global `1280px` centré.

**Alternance des fonds de section** (pages multi-sections) : 1) blanc `#ffffff` → 2) `#F3F3FE` (surface-container-low) → 3) `#0A2463` (navy, sections stats/témoignages/CTA final, texte blanc + accents turquoise).

**Icônes** : `Material Symbols Outlined` exclusivement, import `family=Material+Symbols+Outlined:wght,FILL@100..700,0..1`. `FILL=1` réservé aux icônes **décoratives** uniquement (étoiles Zora, etc.) — pas aux icônes fonctionnelles. Tailles : 18px inline texte, 24px standard, 32px cards, 48px hero. Couleurs par fonction : turquoise = check/validation, `--primary` = actions, orange = Zora. Confirmé en usage réel sur 43 fichiers `public/**/*.html` ; **zéro emoji résiduel** trouvé dans `patient/dashboard.html`.

---

## 1. Structure de navigation

**Hub unique patient** : `public/patient/dashboard.html` — bottom navigation fixe (icônes Material Symbols, backdrop-filter blur), `env(safe-area-inset-bottom)` pour iOS. Panneaux plein écran (clubs, événements, abonnement) : `position:fixed; inset:0 (ou 100vw/100vh); z-index:1000+; animation: slideInUp 300ms ease;`, fond `--surface` (`#FAF8FF`), radius correspondant au `--radius-xl`/`--radius-lg` selon le composant.

**Navbar sticky** (token `design_system.md` §5, usage confirmé sur les pages publiques hors dashboards) : `position:sticky; top:0; z-index:50; background:rgba(250,248,255,0.80); backdrop-filter:blur(12px); border-bottom:1px solid rgba(195,197,215,0.30);`.

**⚠️ Incohérence de navigation entre dashboards** (observation code, hors périmètre de `design_system.md` qui ne prescrit pas de système de panels) :
1. **Patient** : bottom nav + panneaux plein écran (pas de `bolamu-nav.js`).
2. **8 autres dashboards** (`agent`, `secretaire`, `admin`, `medecin`, `rh`, `admin/content`, `laboratoire`, `pharmacie`) : partagent `public/js/bolamu-nav.js` (`.panel`/`.tab`/`.bnav-item`, fonction `showPanel(panelId)`, exposée aussi via `go()` sur certains fichiers).
3. **`animateur`, `partenaire`, `agence`** : navigation ad hoc, ni bottom nav ni `bolamu-nav.js`.

**⚠️ Violation confirmée de la règle CLAUDE.md « Sidebar gauche fixe — JAMAIS »** : `public/admin/dashboard.html` utilise une **sidebar fixe à gauche** (`.sidebar{position:fixed;top:0;left:0;z-index:100;}` + `.sidebar-ov` overlay mobile). **Note importante** : `docs/design_system.md` (source canonique du design system visuel) ne mentionne aucune règle de navigation par sidebar ou navbar horizontale — cette règle « jamais de sidebar » vient uniquement de `CLAUDE.md` (`/ui-designer`), pas de `design_system.md`. Il y a donc une divergence entre deux sources internes (CLAUDE.md interdit, design_system.md est silencieux sur le sujet) en plus de la divergence code/CLAUDE.md — à faire trancher par `/ui-designer` : la sidebar admin est-elle une exception assumée (backoffice ≠ dashboards métier), une règle CLAUDE.md obsolète, ou une vraie dérive à corriger ? Non tranché ici, aucune modification de code faite.

---

## 2. Dashboards par rôle

Détail des fichiers/guards/clés localStorage déjà exhaustif dans **`ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md`** §1/§3 — non répété. Couches design ajoutées ici depuis `design_system.md` :

**Couleurs d'identité par rôle** (`design_system.md` §12, définies dans `public/css/bolamu-ds.css`, réservées aux cartes principales/accents/hover footer de chaque dashboard métier — **jamais** pour les boutons d'action principaux, alertes, ou composants Zora, qui restent sur les couleurs de marque globales) :
| Rôle | Token | Valeur |
|---|---|---|
| patient | `--role-patient` | `#00C9A7` (turquoise) |
| doctor | `--role-medecin` | `#2E86FF` (bleu) |
| secretaire | `--role-secretaire` | `#9333EA` (violet) |
| pharmacie | `--role-pharmacie` | `#10B981` (vert) |
| laboratoire | `--role-labo` | `#F59E0B` (orange) |
| admin | `--role-admin` | `#6B7280` (gris) |
| rh | `--role-rh` | `#EC4899` (rose) |
| agent_bolamu (agence) | `--role-agence` | `#7C3AED` (violet clair) |

**✅ Résolu (2026-07-05)** : `CLAUDE.md` (`/ui-designer`) listait auparavant `#2E86FF` comme couleur interdite (« n'existe pas dans la charte »), en contradiction avec `docs/design_system.md` §12 qui la définit comme `--role-medecin`. **`design_system.md` fait foi** (source canonique du design system, plus récent, usage précis et réservé) — `CLAUDE.md` a été mis à jour pour refléter que `#2E86FF` est réservée exclusivement à l'identité visuelle du rôle médecin, jamais utilisable comme couleur d'action, d'alerte, ou d'accent générique ailleurs dans la plateforme.

**Règles d'application par dashboard** (`design_system.md` §9, applicables à tous : patient/medecin/rh/admin/etc.) : fond global toujours `#FAF8FF` ; widgets/cards toujours en `soft-card` (voir §3) ; titres de page en H2 navy 800 ; métriques en H1/display navy + label overline `--on-surface-variant` ; tableaux fond blanc, header `#F3F3FE`, bordures `1px solid #C3C5D7`, hover row `rgba(0,63,177,0.03)` ; bouton d'action principal toujours `.btn-primary` (jamais un autre style pour l'action primaire d'une page).

**Bugs frontend identifiés** (déjà dans RBAC §3, rappelés car pertinents UX) : `medecin/dashboard.html:1575` supprime la clé fantôme `bolamu_medecin_token` (la vraie est `bolamu_doctor_token`) ; 4 versions obsolètes de `patient/dashboard.html` conservées dans le dossier ; `secretaire/dashboard_v2.html` prototype de test à guard désactivé.

---

## 3. Composants réutilisables

**⚠️ Écart majeur constaté entre le code observé et `design_system.md`** : `design_system.md` §5 et §11 définissent une bibliothèque de composants **nommés** avec classes CSS dédiées (`.soft-card`, `.btn-primary`, `.btn-outline`, `.badge-availability`, `.badge-zora`, `.navbar`, `.zora-balance-card`, `.zora-activity`, `.zora-challenge`, `.elonga-rank`). Le code observé sur `patient/dashboard.html` lors des recherches précédentes utilise très majoritairement du **style inline** (`style="border-radius:...; background:...;"` répété élément par élément) plutôt que ces classes canoniques — aucune occurrence de `class="soft-card"` ou `class="zora-balance-card"` n'a été confirmée sur ce fichier dans les passes de lecture précédentes. **Dette de conformité à documenter, non à corriger ici** : le design system canonique existe et est cohérent, mais son adoption dans le HTML réel des dashboards (au moins celui du patient) semble partielle ou inexistante — à auditer précisément par `/frontend-engineer` avant toute refonte.

**Composants canoniques (`design_system.md`)** :
- **`.soft-card`** — composant signature : fond blanc, bordure `1px solid #C3C5D7`, `border-radius:24px`, hover `border-color:#003FB1` + ombre card-hover + `translateY(-4px)`.
- **`.btn-primary`** — fond `#003FB1`, radius `9999px`, ombre CTA bleu, hover fond `#0A2463` + `translateY(-2px)`, `active: scale(0.95)`.
- **`.btn-outline`** — transparent, bordure `2px solid #C3C5D7`, texte navy.
- **`.badge-availability`** — fond `--primary-fixed` (`#DBE1FF`), texte `#003DAB`, pill.
- **`.badge-zora`** — fond orange 10% opacité, texte orange, uppercase, pill.
- **`.zora-balance-card`** (§11) — carte fond navy, solde Zora en gros chiffres blancs, barre de progression orange vers le prochain palier, toujours affichée **en premier** widget du dashboard patient selon la règle d'usage.
- **`.zora-activity`** (§11) — ligne d'historique d'action récompensée (icône + titre + date + points), max 5 visibles sans scroll, tri du plus récent au plus ancien.
- **`.zora-challenge`** (§11) — carte défi avec barre de progression, badge « Défi semaine », récompense en points — affichées par groupes de 2 (grille desktop) / 1 (mobile).
- **`.elonga-rank`** (§11) — badge de rang (icône `workspace_premium` FILL=1, couleur `--zora-gold`), affiché sur profil et résumé Wellness RH agrégé équipe.
- **Règle Zora spécifique** : le gradient `linear-gradient(90deg, #FF6B35, #F5A623)` est la **seule exception** à la règle générale « pas de gradients décoratifs » — autorisé uniquement sur les barres de progression Zora.

**Autres patterns observés dans le code (non spécifiés par `design_system.md`, complémentaires)** :
- **Toast** — `A.showToast(msg)` (`patient/dashboard.html:2439`), auto-effacement 2800ms, exposé globalement via `window.showToast`.
- **Chat interne** — polling 5s (club/social), distinct des files d'attente médicales qui elles ne sont jamais auto-rafraîchies (voir `ARCHITECTURE_SOINS_BOLAMU.md` §9).
- **QR codes** — `A.renderQR(id, text, size)`, retry différé jusqu'à 40 tentatives × 150ms si le DOM n'est pas encore monté.

---

## 4. Mascotte et assets

- **Mascotte** : `garcons3Dbleu.png` (`/images/landing/garcons3Dbleu.png`) — widget Score Bolamu (animation `zoraFloat 4s ease-in-out infinite`).
- **Coin Zora** : `zora-coin-gold.png` attendu par le brief, non confirmé par grep direct dans cette passe — plusieurs assets Zora existent dans `public/images/` non tous audités individuellement.
- **Logo officiel** (`design_system.md` §13) : `/images/landing/bolamu-logo-final.png` — rond bleu `#003FB1` avec lettre B blanche et feuille turquoise `#00C9A7` en haut à droite. Usage navbar/footer : `<img ... class="h-12 w-12 object-contain rounded-full">`, taille standard 48×48px, `rounded-full` obligatoire sur toutes les instances. **Fichiers explicitement interdits** (canonique, jamais réutiliser) : `01-logo-navbar.png`, `23-logo-footer.png` — marqués obsolètes dans `design_system.md` lui-même.

---

## 5. Règles absolues UI (à ne jamais violer)

Liste canonique complète (`design_system.md` §10, ma version précédente n'en couvrait qu'une partie) :
1. ❌ Aucune police autre que Plus Jakarta Sans — **confirmé respecté** sur les fichiers audités.
2. ❌ Aucune couleur primaire différente de `#003FB1` pour les interactions.
3. ❌ `border-radius` < 8px sur les cartes.
4. ❌ Gradients décoratifs (sauf barre de progression Zora, §3 — seule exception documentée).
5. ❌ Mélanger des librairies d'icônes différentes (pas de FontAwesome/Heroicons) — **confirmé respecté** : Material Symbols Outlined exclusivement sur 43 fichiers audités.
6. ❌ `font-weight: 900` (non supporté par Plus Jakarta Sans).
7. ❌ Ombres noires brutes non teintées.
8. ❌ `border-radius` < 9999px sur les boutons CTA principaux.
9. ❌ Zéro emoji dans le code HTML/CSS/JS — **confirmé respecté** sur `patient/dashboard.html` (0 occurrence).
10. Règles de process (hors `design_system.md`, héritées de CLAUDE.md/protocoles projet) : pas de localStorage/sessionStorage dans les artifacts Claude Code ; tests contre bolamu.co uniquement, jamais localhost.

**⚠️ Violations confirmées dans cette passe** :
- **Sidebar admin** — voir §1, contredit `CLAUDE.md` (silence de `design_system.md` sur le sujet).
- **Badge palier Zora à `0.58rem`** (observé sur `patient/dashboard.html`, ex. badge « Liboso ») — **inférieur au plancher typographique canonique** : le token « Overline/badge » de `design_system.md` §2 fixe `0.625rem` (10px) comme taille minimale pour ce type d'élément. `0.58rem` (~9.3px) est en dessous — micro-violation de l'échelle typographique, à corriger par `/frontend-engineer` si un audit exhaustif des tailles de police est mené.
- **Adoption partielle des classes de composants canoniques** — voir §3 (style inline généralisé plutôt que `.soft-card`/`.zora-balance-card`/etc.).

---

## 6. Patterns d'appel API depuis le frontend

**`apiFetch()`** (`patient/dashboard.html:1384-1428`) : injecte `Authorization: Bearer <bolamu_patient_token>` ; sur 401/403, tente `POST /auth/refresh` avec `bolamu_patient_refresh`, réécrit le token et **rejoue automatiquement** la requête ; sinon `localStorage.clear()` + redirect `/login.html?reason=session_expired`.

**⚠️ Incohérence d'usage** (`AUDIT_CONTRATS_API_BILATERAL.md`, 28 juin 2026) : la majorité des appels métier du chargement initial patient (profil, Zora, streak, events, leaderboard, constantes, timeline...) utilisent `fetch()` brut, **sans** le refresh automatique d'`apiFetch()`.

**Gestion 401** : intercepteur global additionnel dupliqué indépendamment sur `medecin`/`agence`/`agent`/`rh` (remplace `window.fetch`, force `localStorage.clear()` + redirect sur tout 401) — non mutualisé.

**Gestion offline/réseau lent** : l'audit relève un grand nombre d'appels **« 🔴 SILENCIEUX »** — `catch(() => {})` vide sur la quasi-totalité des `componentDidMount` (profil, Zora, streak, events, leaderboard, sport-groups, constantes, timeline, access-log, games config, doctors, vouchers, dmn access-log) : en cas d'échec réseau, aucun retour utilisateur, la section reste vide. Les endpoints d'action (paiement, inscription événement, jeux Zora, vérification mot de passe DMN) affichent un toast d'erreur, généralement sans désactivation visuelle du bouton pendant la requête.

---

## 7. Accessibilité et mobile-first

- **Viewport** : `<meta name="viewport" content="width=device-width, initial-scale=1">` — confirmé.
- **Safe area iOS** : `env(safe-area-inset-bottom)` sur bottom nav, composer chat, CTA plein écran flottants.
- **Taille de police minimale** : le plancher canonique (`design_system.md` §2) est `0.625rem` (Overline/badge) — voir violation `0.58rem` documentée en §5. 117 occurrences de tailles `0.7x rem` trouvées sur `patient/dashboard.html`, cohérentes avec le token Body small (`0.875rem`) et ses variantes réduites contextuelles.
- **Touch targets** : aucune règle `min-height`/`min-width` 44px systématique identifiée par grep, ni dans le code ni dans `design_system.md` (qui ne traite pas explicitement des zones tactiles) — à auditer séparément si nécessaire.
