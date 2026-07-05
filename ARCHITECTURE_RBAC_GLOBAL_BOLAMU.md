# Architecture RBAC globale — Bolamu

> Source de vérité unique sur qui peut faire quoi dans Bolamu. Couvre les 3 couches : base de données, backend (middlewares/routes/controllers), frontend (dashboards, guards, localStorage).
> Sources : `src/middleware/auth.middleware.js`, grep exhaustif `req.user.role`/middlewares de rôle sur `src/routes/` et `src/controllers/`, grep `localStorage`/guards sur `public/`, `src/controllers/auth.controller.js`, interrogation directe de Neon (`SELECT DISTINCT role FROM users`, comptages réels).

---

## 0. Principes d'authentification

**Base de données** : table `users`, colonne `role` (VARCHAR(20), défaut `'patient'`). **Aucune contrainte CHECK n'existe sur cette colonne** (vérifié via `pg_constraint` sur Neon — 0 résultat de type `c` pour `users`) : la validation des valeurs de rôle repose entièrement sur le code applicatif, jamais sur la base. `JWT_SECRET` configuré sur Render, sans fallback dans le code (`auth.middleware.js:5-8` — `throw` fatal au démarrage si absent).

**Backend** (`src/middleware/auth.middleware.js`) :
- Vérification : `jwt.verify(token, JWT_SECRET)` (`:23`).
- Payload token → `req.user = decoded` intégral (`:24`) ; champs utilisés dans le reste du code : `phone`, `role`, `is_active`, `banned`, `id`.
- Check `is_active`/`banned` : d'abord depuis le token lui-même (`decoded.is_active === false` → 403 `:27-29` ; `decoded.banned === true` → 403 `:30-32`) ; si absent du token (anciens tokens émis avant l'ajout de ces champs), requête DB de fallback `SELECT is_active, banned FROM users WHERE phone=$1` (`:35-46`).
- `authMiddleware.requireAdmin` (`:59-120`) : middleware complet et distinct, accepte le token via header **ou** cookie `bolamu_admin_token` (`:70-72`), autorise `['admin','content_admin']` (`:60,85`).
- Sous-middlewares additionnels exportés directement par ce fichier : `requireSecretary` (`:123-129`, `['secretaire','admin']`), `requireRH` (`:132-138`, `['rh','admin']`), `requireDoctor` (`:141-147`, `['doctor','admin']`), `requireOpsAdmin` (`:150-158`, `role==='admin'` strict).

**Frontend** :
- Stockage du token : `localStorage`, une clé par rôle (`bolamu_<role>_token` + `bolamu_<role>_phone`, voir §3 pour le détail exact et les incohérences de nommage).
- Chaque dashboard vérifie la présence du token (et parfois le rôle exact) au chargement, sinon redirige vers son `login.html` respectif (détail par rôle en §3).
- **Redirections post-login — `src/controllers/auth.controller.js` (fonction `login()`, lignes 101-170)** :
  ```js
  // auth.controller.js:113-114 — l'admin est explicitement rejeté par ce endpoint générique
  if (user.role === 'admin') return res.status(403).json({
    success: false,
    message: 'Accès non autorisé. Utilisez le portail administrateur.',
    redirectUrl: '/admin/login.html'
  });
  if (user.banned) return res.status(403).json({ success: false, message: 'Compte suspendu. Contactez le support.' });
  ```
  ```js
  // auth.controller.js:146-154
  let redirectUrl = '/login.html';
  switch (user.role) {
      case 'patient':      redirectUrl = '/patient/dashboard.html'; break;
      case 'doctor':       redirectUrl = '/medecin/dashboard.html'; break;
      case 'pharmacie':    redirectUrl = '/pharmacie/dashboard.html'; break;
      case 'laboratoire':  redirectUrl = '/laboratoire/dashboard.html'; break;
      case 'rh':           redirectUrl = '/rh/dashboard.html'; break;
      case 'agent_bolamu': redirectUrl = '/agent/dashboard.html'; break;
  }
  return res.status(200).json({ success: true, accessToken, refreshToken, role: user.role, phone: normalizedPhone, redirectUrl, must_change_password: user.password_must_change || false });
  ```
  Les rôles `secretaire`, `animateur`, `partenaire`, `content_admin` **n'apparaissent pas** dans ce switch : chacun a son propre endpoint de login dédié (`/secretariat/login`, `/animateur/login`, `/partenaire/login`) et ne transite jamais par `login()`. `content_admin` passe par le même endpoint que `admin` (`/auth/admin-login`).
  Aucune vérification de permission au-delà du blocage `admin`/`banned` n'est faite dans `auth.controller.js` — tout le RBAC applicatif se fait ensuite via `req.user.role` dans chaque route/controller (§2-3).

---

## 1. Les 10 rôles actifs

Comptages réels exécutés en direct sur Neon (`SELECT role, COUNT(*) FROM users GROUP BY role`, 73 comptes au total, dont 46 actifs `is_active=true`) :

### patient — 47 comptes (27 actifs)
- **Description métier** : adhérent Bolamu, souscripteur d'un plan (essentiel/standard/premium), consommateur principal des soins/Zora/Elonga/social.
- **Dashboard** : `public/patient/dashboard.html` (+ 4 versions obsolètes conservées dans le même dossier : `dashboard-old.html`, `dashboard-dclogic-old.html`, `dashboard-dclogic-backup.html`, `dashboard-original-git.html` — non référencées par le switch de redirection, dette technique de nettoyage).
- **Routes accessibles** : `/appointments/book`, `/patients/*`, `/zora/*`, `/streaks/*`, `/leaderboard/*`, `/events/*`, `/clubs/*`, `/chat/*`, `/feed`, `/stories`, `/follows`, `/notifications`, `/dmn/*`, `/preRdv` (`patientOnly`), `/symptoms` (`patientOnly`/`patientOrDoctorOnly`), `/healthRecords` (`role==='patient'`).
- **Restrictions** : aucun accès admin/partenaire/backoffice ; ne peut pas valider ses propres ordonnances/résultats.

### doctor — 6 comptes (tous actifs)
- **Description métier** : médecin partenaire, consulte, prescrit, valide les rendez-vous.
- **Dashboard** : `public/medecin/dashboard.html` (pas de `login.html` dédié — passe par `/login.html` générique).
- **Routes accessibles** : `/prescriptions` (`requireDoctor`), `/lab` (prescription d'examens), `/ai-consult` (`doctorOnly`), `/consultations` (rapports), `/pre-rdv` (briefing/renouvellement, `doctorOnly`), `/appointments/doctor/:phone`.
- **Restrictions** : pas d'accès aux flux financiers admin (clearing, payouts), pas d'accès aux dossiers d'autres patients hors consultation active (`isTreatingDoctor` vérifié dans `consultation-report.controller.js`, `constantes-medicales.controller.js`, `lab.controller.js`).

### laboratoire — 6 comptes (5 actifs)
- **Description métier** : laboratoire d'analyses partenaire, reçoit les prescriptions d'examens, publie les résultats.
- **Dashboard** : `public/laboratoire/dashboard.html` (pas de `login.html` dédié).
- **Routes accessibles** : `/lab` (`labOnly` — results/pending), `/zora/vouchers/:uuid/consume`, `/zora/partner/vouchers`, `/smartflow` (`prestataireOnly`).
- **Restrictions** : incohérence de nommage relevée (`zora-marketplace.routes.js:117,147` vérifie `laboratory` en anglais alors que le rôle réel en base est `laboratoire` en français — condition potentiellement jamais vraie, à vérifier).

### pharmacie — 4 comptes (tous actifs)
- **Description métier** : pharmacie partenaire, dispense les ordonnances, applique le tiers payant.
- **Dashboard** : `public/pharmacie/dashboard.html` (pas de `login.html` dédié).
- **Routes accessibles** : `/prescriptions/by-session`, `/prescriptions/deliver`, `/zora/vouchers/:uuid/consume`, `/smartflow` (`prestataireOnly`), `/admin/conventions` (partagé `partnerOnly`).
- **Restrictions** : même incohérence de nommage anglais/français relevée (`pharmacy` vs `pharmacie` dans `zora-marketplace.routes.js`) ; jamais d'accès au dossier médical (règle CLAUDE.md TC-033).

### secretaire — 2 comptes (tous actifs)
- **Description métier** : personnel d'accueil clinique, gère l'agenda et la file d'attente des médecins.
- **Dashboard** : `public/secretaire/dashboard.html` (+ variante `dashboard_v2.html`, statut de migration à clarifier).
- **Routes accessibles** : `/secretariat/*` (`requireSecretary`).
- **Restrictions** : accès BHP limité — identité + RDV + statut abonnement + motif UNIQUEMENT (règle CLAUDE.md), jamais comptes rendus/ordonnances/résultats labo.

### rh — 2 comptes (tous actifs)
- **Description métier** : responsable RH d'une entreprise cliente (Smart Flow Grands Comptes), gère retenues sur salaire et exports paie.
- **Dashboard** : `public/rh/dashboard.html`.
- **Routes accessibles** : `/smartflow/rh/*` (`rhOnly` = `['rh','company_rh']` — **`company_rh` est une valeur legacy jamais confirmée en base**, voir §5).
- **Restrictions** : accès stats agrégées anonymisées uniquement, jamais nominatif (règle CLAUDE.md/compliance).

### agent_bolamu — 2 comptes (tous actifs)
- **Description métier** : agent terrain, réalise les inscriptions patients/partenaires sur le terrain (traçabilité via `agent_phone`, migration_056).
- **Dashboard** : **deux dashboards distincts coexistent** pour le même rôle DB (voir anomalie §4) : `public/agent/dashboard.html` (cible officielle du switch `login()`, clé `bolamu_agent_bolamu_token`) et `public/agence/dashboard.html` (portail « Agence », login séparé `/agence/login`, clé `bolamu_agent_token`).
- **Routes accessibles** : `/agent/*`, `/agence/*` (`requireAgent`).
- **Restrictions** : pas d'accès aux données médicales, uniquement inscription et suivi de ses propres inscriptions.

### admin — 1 compte (actif)
- **Description métier** : administrateur plateforme, backoffice complet.
- **Dashboard** : `public/admin/dashboard.html`, login dédié `public/admin/login.html` via `/auth/admin-login`.
- **Routes accessibles** : quasi toutes les routes `adminOnly` (redéfini localement dans ~11 fichiers routes : `admin`, `clearing`, `conflict`, `bank-transfer`, `coupon`, `partner-convention`, `payouts`, `push`, `remise-partenaire`, `smartflow`, `zora`), + `requireAdmin`/`requireOpsAdmin` du middleware central.
- **Restrictions** : aucune côté applicatif — rôle le plus privilégié.

### content_admin — 1 compte (actif)
- **Description métier** : éditeur de contenu (articles/blog), accès restreint au module éditorial.
- **Dashboard** : `public/admin/content.html` (partage `public/admin/login.html` avec `admin`, redirection différenciée selon `data.role`).
- **Routes accessibles** : `/articles` (`requireContentAdmin` = `['admin','content_admin']`), accès général dashboard admin via `authMiddleware.requireAdmin`.
- **Restrictions** : censé être limité au contenu éditorial, mais `requireAdmin` (middleware central) l'autorise aussi sur le dashboard admin général — périmètre réel plus large que son nom ne l'indique, à faire trancher par `/security-officer`.

### animateur — 2 comptes (tous actifs)
- **Description métier** : animateur Elonga, anime les clubs et événements bien-être, réalise les check-in.
- **Dashboard** : `public/animateur/dashboard.html`, login dédié `public/animateur/login.html`.
- **Routes accessibles** : `/animateur/*` (`requireAnimateur`), `/events` (partagé avec `admin`), `/vouchers` (validation, `requireAnimateur`), `role !== 'animateur' && role !== 'admin'` sur `elonga-events.routes.js:183,202`.
- **Restrictions** : pas d'accès aux données médicales ni financières hors Zora/vouchers.

### Rôle additionnel non actif : partenaire (0 compte réel)
Le rôle `partenaire` existe et est pleinement fonctionnel dans le code (`partenaire.routes.js` — `requirePartenaire`, login `POST /partenaire/login`, dashboard `public/partenaire/dashboard.html`), avec ses propres routes de validation de vouchers. **Aucun compte n'a ce rôle en base actuellement** (0 sur 73 users). Il est distinct de `doctor`/`pharmacie`/`laboratoire` et semble dédié à un portail de vouchers/programmes partenaires génériques (`credit_partners`, `partner_programs`). À clarifier : rôle prévu pour un futur type de partenaire, ou fonctionnalité abandonnée avant déploiement (voir §5).

---

## 2. Matrice rôles × ressources

| Ressource / Action | patient | doctor | laboratoire | pharmacie | secretaire | rh | agent_bolamu | admin | content_admin | animateur |
|---|---|---|---|---|---|---|---|---|---|---|
| Données patient (lecture) | 🔒 propres données | 🔒 patients en consultation active | 🔒 patients avec prescription active | 🔒 patients avec ordonnance active | 🔒 identité/RDV/statut abo. uniquement | ❌ | ❌ | ✅ | ❌ | ❌ |
| Données patient (écriture) | 🔒 son propre profil | 🔒 constantes/rapports patients suivis | ❌ | ❌ | ❌ | ❌ | 🔒 inscription initiale uniquement | ✅ | ❌ | ❌ |
| Dossier médical BHP (health_records) | 🔒 avec consentement | 🔒 si consentement patient | ❌ | ❌ | ❌ jamais (règle CLAUDE.md) | ❌ | ❌ | ✅ | ❌ | ❌ |
| RDV — créer | ✅ | ❌ (crée via secrétaire) | ❌ | ❌ | ✅ (`secretariat/rdv-manuel`) | ❌ | ❌ | ✅ | ❌ | ❌ |
| RDV — voir | 🔒 les siens | 🔒 les siens | ❌ | ❌ | 🔒 du médecin rattaché | ❌ | ❌ | ✅ | ❌ | ❌ |
| RDV — modifier/annuler | 🔒 les siens | 🔒 les siens (ouvrir/clôturer consultation) | ❌ | ❌ | ✅ (confirmer/annuler) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ordonnances — émettre | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ordonnances — dispenser | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ordonnances — voir | 🔒 les siennes | 🔒 celles émises | ❌ | 🔒 par session_code | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Résultats labo — soumettre | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Résultats labo — voir | 🔒 les siens | 🔒 ceux prescrits | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Zora — gagner | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Zora — dépenser (vouchers) | ✅ | ❌ | 🔒 consommer voucher | 🔒 consommer voucher | ❌ | ❌ | ❌ | ❌ | ❌ | 🔒 validation |
| Zora — administrer (earn rules/reset) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Clubs — créer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔒 via animateur_clubs |
| Clubs — rejoindre | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Clubs — administrer (kick/désactiver) | 🔒 si animateur du club | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 🔒 ses clubs |
| Notifications — envoyer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (système) | ❌ | ❌ |
| Notifications — configurer (push subscribe) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Routes admin (backoffice) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🔒 `/articles` uniquement | ❌ |
| Inscription partenaires (validation) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔒 inscrit sur le terrain | ✅ valide | ❌ | ❌ |
| Smart Flow RH (retenues/export) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Conventions/tiers payant (validation) | ❌ | ❌ | 🔒 sa convention | 🔒 sa convention | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

Légende : ✅ autorisé sans condition · 🔒 autorisé sous condition (voir cellule) · ❌ interdit d'après le code lu.

---

## 3. Middlewares et guards

**Backend** — middlewares de contrôle de rôle recensés (aucun module central partagé hors `auth.middleware.js` ; la plupart sont redéfinis localement dans chaque fichier de routes) :

| Middleware | Défini dans | Rôle(s) autorisé(s) |
|---|---|---|
| `authMiddleware` (JWT + is_active/banned) | `src/middleware/auth.middleware.js:1-46` | tout rôle authentifié |
| `authMiddleware.requireAdmin` | `auth.middleware.js:59-120` | `admin`, `content_admin` |
| `authMiddleware.requireSecretary` | `auth.middleware.js:123-129` | `secretaire`, `admin` |
| `authMiddleware.requireRH` | `auth.middleware.js:132-138` | `rh`, `admin` |
| `authMiddleware.requireDoctor` | `auth.middleware.js:141-147` | `doctor`, `admin` |
| `authMiddleware.requireOpsAdmin` | `auth.middleware.js:150-158` | `admin` strict |
| `adminOnly` (redéfini localement) | `admin.routes.js:14`, `clearing.routes.js:23`, `conflict.routes.js:23`, `bank-transfer.routes.js:10`, `coupon.routes.js:14`, `partner-convention.routes.js:17`, `payouts.routes.js:6`, `push.routes.js:10`, `remise-partenaire.routes.js:13`, `smartflow.routes.js:31`, `zora.routes.js:16` | `admin` strict |
| `requireContentAdmin` | `articles.routes.js:33` | `admin`, `content_admin` |
| `requireAgent` | `agent.routes.js:16`, `agence.routes.js:25` | `agent_bolamu` |
| `requireAnimateur` | `animateur.routes.js:40`, `voucher.routes.js:25` | `animateur` |
| `requirePartenaire` | `partenaire.routes.js:17` | `partenaire` |
| `doctorOnly` | `ai-consult.routes.js:12`, `lab.routes.js:20`, `consultation-report.routes.js:13`, `preRdv.routes.js:31` | `doctor` |
| `labOnly` | `lab.routes.js:28` | `laboratoire` |
| `partnerOnly` | `partner-convention.routes.js:25` | `doctor`, `pharmacie`, `laboratoire` |
| `prestataireOnly` | `smartflow.routes.js:15` | `pharmacie`, `laboratoire`, `doctor` |
| `rhOnly` | `smartflow.routes.js:23` | `rh`, `company_rh` (legacy, voir §5) |
| `patientOnly` | `preRdv.routes.js:23`, `symptoms.routes.js:10` | `patient` |
| `patientOrDoctorOnly` | `symptoms.routes.js:18` | `patient` ou `doctor` |

**Frontend** — mécanisme de guard par dashboard (vérification token/rôle au chargement, redirection si absent) :

| Dashboard | Mécanisme |
|---|---|
| `patient/dashboard.html` | Pas de garde bloquante synchrone — contrôle *a posteriori* via intercepteur `fetch` global sur 401 + vérifications ponctuelles `if (!token) return;` avant chaque appel. |
| `medecin/dashboard.html` | Garde synchrone au chargement (`if(!getAuthToken()||!phone){location.href='/login.html';}`, ligne 678) + intercepteur `fetch` global 401 (ligne 673). **Bug relevé** : `logout()` (ligne 1575) supprime la clé `bolamu_medecin_token`, qui n'est jamais définie nulle part (la vraie clé est `bolamu_doctor_token`) — résidu de renommage `medecin`→`doctor` non terminé, le logout ne nettoie donc pas correctement le token. |
| `pharmacie/dashboard.html` | Garde synchrone directe (`if (!token \|\| !phone) { location.href = '/login.html'; }`, ligne 484). |
| `laboratoire/dashboard.html` | Garde synchrone directe (ligne 366, même pattern). |
| `admin/dashboard.html` | Garde stricte sur rôle exact `admin` (`if (!token \|\| role !== 'admin') { localStorage.clear(); location.replace('/admin/login.html'); }`, ligne 1030). |
| `admin/content.html` | Garde acceptant `admin` OU `content_admin` (ligne 383). |
| `agence/dashboard.html` | Garde via `getToken()` interne (clé `bolamu_agent_token`), redirige vers `/agence/login.html` + intercepteur 401 (lignes 897-898). |
| `agent/dashboard.html` | Garde synchrone via clé dynamique `bolamu_${ROLE}_token` où `ROLE='agent_bolamu'` (ligne 253). |
| `animateur/dashboard.html` | Garde synchrone directe (clé `bolamu_animateur_token`, lignes 551-552). |
| `secretaire/dashboard.html` | Garde asynchrone dans `DOMContentLoaded` (lignes 2964-2965). |
| `rh/dashboard.html` | Garde asynchrone dans `DOMContentLoaded` + intercepteur 401 (ligne 434). |
| `partenaire/dashboard.html` | Garde synchrone directe (lignes 306-311). |

Le pattern d'intercepteur `fetch` 401 → `localStorage.clear(); redirect` est **dupliqué indépendamment** dans plusieurs dashboards (`medecin`, `agence`, `agent`, `rh`) — pas mutualisé dans `public/js/bolamu-nav.js` malgré son existence.

---

## 4. Historique des corrections RBAC

- **2026-06-21 (commits `ee160aa`→`0637eb6`, dashboard agent)** : ajout du dashboard `public/agent/dashboard.html` et des routes `/agent/*` pour le rôle `agent_bolamu`.
- **Session correction rôles (`b75b232` fix(rbac): fusion super_admin→admin ; migration_057)** : le rôle `super_admin` n'a jamais eu de périmètre distinct de `admin` — fusionné par simple `UPDATE users SET role='admin' WHERE role='super_admin'`, aucune contrainte CHECK à modifier (la colonne n'en a jamais eu).
- **Session correction rôles (`c926154` fix(rbac): fusion cms_medecin→doctor ; migration_058)** : même mécanisme, `cms_medecin` absorbé dans `doctor`.
- **2026-07-05 (incident prod, correctif `bfcc887`)** : la migration_055 (backfill des conversations de club) et les routes `clubs.controller.js`/`clubs.routes.js` inséraient les valeurs `'admin'`/`'member'` dans `conversation_participants.role`, alors que la contrainte CHECK de cette table (migration_039) n'autorise que `'patient'`/`'medecin'`/`'animateur'`. Serveur down au redémarrage (violation CHECK bloquant la migration). Corrigé en remplaçant `'admin'`→`'animateur'` et `'member'`→`'patient'` dans les 3 fichiers concernés.
- **Duplication `agent_bolamu` non résolue** : deux dashboards (`public/agent/` et `public/agence/`) et deux jeux de clés localStorage servent le même rôle DB sans qu'aucune fusion n'ait encore été décidée — à trancher par `/tech-lead` + `/office-hours` (lequel est le portail officiel ?).

---

## 5. Rôles abandonnés et raisons

- **`super_admin`** — fusionné dans `admin` (migration_057, commit `b75b232`) : jamais eu de périmètre fonctionnel distinct depuis sa création, décision produit de simplifier à un seul rôle admin.
- **`cms_medecin`** — fusionné dans `doctor` (migration_058, commit `c926154`) : rôle créé par erreur/redondance lors d'une itération antérieure du CMS médical, absorbé dans le rôle médecin standard.
- **`company_rh`** — valeur legacy trouvée uniquement dans le tableau `rhOnly = ['rh','company_rh']` de `smartflow.routes.js:23`. **Aucun compte en base n'a jamais ce rôle** (0 sur 73 users, et absent de `SELECT DISTINCT role`) — code mort à nettoyer ou vestige d'une évolution jamais terminée du module RH entreprise. À confirmer avec `/tech-lead` avant suppression.
- **`entreprise`** — présent dans l'ENUM `user_type_enum` d'origine (`init.sql`), avant l'introduction de la colonne `role` (non trackée, voir `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §0/§3). N'a jamais eu d'équivalent parmi les rôles réels en base — probablement remplacé conceptuellement par `rh` (représentant l'entreprise cliente) lors de la refonte Smart Flow.
- **`medecin`** (ancienne valeur ENUM `user_type_enum`, `init.sql`) — remplacé par `doctor` (anglicisé) à un moment non tracé par les migrations ; seule trace résiduelle : la clé localStorage fantôme `bolamu_medecin_token` dans `medecin/dashboard.html:1575` (bug de logout, voir §3) et la contrainte CHECK de `conversation_participants` qui accepte encore `'medecin'` comme valeur (migration_039) alors que le rôle réel utilisateur est `doctor`.
- **`partenaire`** — non abandonné mais **jamais déployé** : code complet (routes, middleware, dashboard, login) présent et fonctionnel, mais 0 compte réel en base. Statut à clarifier avec `/office-hours` : fonctionnalité en attente de lancement, ou pan mort à retirer.
