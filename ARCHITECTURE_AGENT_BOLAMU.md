# Architecture de l'agent terrain — Bolamu

> Document de référence sur le rôle commercial terrain `agent_bolamu` : inscription patients/partenaires, suivi de performance, réseau national.
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` (schéma), `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (rôles, §3 middlewares/guards, §4 anomalie double portail déjà documentée) — non répétés ici, seulement cités.
> Sources : `src/routes/{agent,agence}.routes.js`, `public/{agent,agence}/dashboard.html`, `src/controllers/{patient,doctor,pharmacie,laboratoire}.controller.js`, `database/migrations/migration_056_agent_tracking.sql`.

---

## 0. Vue d'ensemble agent terrain

L'agent Bolamu est le commercial terrain qui inscrit des patients et des partenaires physiquement, sur le rôle DB unique `agent_bolamu`. **Deux portails distincts coexistent pour ce même rôle** — anomalie déjà confirmée et documentée dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §4 (« Duplication `agent_bolamu` non résolue... à trancher par `/tech-lead` + `/office-hours` ») :

- **`public/agent/dashboard.html`** + `src/routes/agent.routes.js` — portail le plus récent (RBAC §4 : commits `ee160aa`→`0637eb6`, 2026-06-21), authentification via le login JWT partagé standard (pas de route `/login` propre dans `agent.routes.js` — l'agent se connecte comme n'importe quel utilisateur, avec `role='agent_bolamu'` dans le token).
- **`public/agence/dashboard.html`** + `src/routes/agence.routes.js` — portail antérieur (« Réseau national »), avec sa **propre** route `POST /agence/login` (`agence.routes.js:33-61`) qui requête directement `users` et signe son propre JWT avec le même `JWT_SECRET` — implémentation dupliquée plutôt que réutilisation du login central.

Les deux portails n'exposent pas le même périmètre fonctionnel (détail §1-§4) et n'écrivent pas les mêmes données pour la même action (détail §5).

---

## 1. Inscription patients

**Base de données** : `users.agent_phone` (colonne additive, `migration_056_agent_tracking.sql:4`, `CREATE INDEX ... WHERE agent_phone IS NOT NULL`).

**Backend** (`agent.routes.js`) : `POST /agent/inscrire-patient` (`requireAgent`, ligne 83-131) — réutilise `registerPatient()` de `patient.controller.js` sans dupliquer sa logique (capture la réponse via un `res` factice `fakeRes`), puis ajoute optionnellement un abonnement si un `plan` (`moto`/`ndeko`/`libota` → `essentiel`/`standard`/`premium`) est fourni dans le formulaire : tarif lu dans `platform_config`, `INSERT INTO subscriptions`, `payment_reference` au format `AGENT-{agent_phone}-{timestamp}`. `registerPatient()` (`patient.controller.js:44`) insère directement `agent_phone` dans `users` — **traçabilité effective par ce chemin**.

**Frontend** : formulaire dans `public/agent/dashboard.html` (non détaillé ligne par ligne ici — appelle `POST /agent/inscrire-patient`).

---

## 2. Inscription partenaires

**Base de données** : `doctors.agent_phone`, `pharmacies.agent_phone`, `laboratories.agent_phone` (mêmes colonnes additives, `migration_056_agent_tracking.sql:5-7`).

**Backend** (`agent.routes.js:134-148`) : `POST /agent/inscrire-partenaire`, dispatch par `type` du body vers les contrôleurs existants sans duplication :
```
pharmacie  → registerPharmacie()   (pharmacie.controller.js:82 — INSERT agent_phone confirmé)
laboratoire → registerLaboratoire() (laboratoire.controller.js:84 — INSERT agent_phone confirmé)
clinique   → registerDoctor()      (doctor.controller.js:94 — INSERT agent_phone confirmé)
```
**Anomalie confirmée** (commentaire du développeur lui-même, `agent.routes.js:139`) : le type `clinique` est mappé sur `registerDoctor()` — **aucune table `clinics` dédiée pour la création via ce chemin** (à distinguer de la table `clinics` qui existe bel et bien et est lue en lecture par `agence.routes.js:445` et `:471` — voir §4 ; c'est la création via l'agent qui contourne cette table, pas son absence totale du schéma). Documenté ici sans correction, comme demandé.

**Frontend** : formulaire dans `public/agent/dashboard.html`, sélecteur de type (pharmacie/laboratoire/clinique).

---

## 3. Dashboard performance agent

**Backend** (`agent.routes.js`, `requireAgent` = `authMiddleware` + vérification locale `req.user.role === 'agent_bolamu'`, ligne 16-21) :

- `GET /agent/dashboard` (ligne 24-80) — un seul `pool.query` avec 6 sous-requêtes scalaires (`patients_total`, `patients_ce_mois`, `patients_mois_precedent`, `partenaires_total` = somme `doctors`+`pharmacies`+`laboratories` filtrés `agent_phone=$1`, `partenaires_ce_mois`, `partenaires_mois_precedent`), toutes filtrées sur `agent_phone = $1` (l'agent connecté) ; + une requête `UNION ALL` des 10 dernières inscriptions tous types confondus.
- `GET /agent/mes-inscrits` (ligne 151-193) — liste paginée (`page`/`limit`, max 100) via le même `UNION ALL` sur les 4 tables filtrées `agent_phone`, plus un `COUNT` global équivalent pour la pagination.

**Base de données** : requêtes directes sur `agent_phone` dans `users` (rôle `patient`), `doctors`, `pharmacies`, `laboratories` — aucune table de log dédiée aux inscriptions agent, tout est dérivé de la colonne `agent_phone`.

**Frontend** : compteurs et liste dans `public/agent/dashboard.html` (sections non détaillées ligne par ligne — consomment `GET /agent/dashboard` et `GET /agent/mes-inscrits`).

---

## 4. Portail agence (legacy)

**Backend** (`agence.routes.js`) — liste exhaustive :

| Méthode | Chemin | Action |
|---|---|---|
| POST | `/agence/login` | Login propre (bcrypt + JWT local), distinct du login central |
| GET | `/agence/stats-globales` | Stats **réseau entier**, non scopées à l'agent connecté (total abonnés, abonnés actifs, partenaires actifs, RDV du jour) |
| GET | `/agence/verifier-adherent?q=` | Recherche adhérent par téléphone/nom, statut abonnement calculé (actif/en_attente/inactif) |
| GET | `/agence/client?phone=` | Fiche client (abonnement en cours) |
| POST | `/agence/souscrire` | Créer un abonnement (+ patient si inexistant), tarif `platform_config`, `payment_reference` `AGENT-{mode}-{timestamp}` |
| GET | `/agence/plans-config` | Config des 3 plans (nom commercial, prix, nb membres, description) — tarifs lus dynamiquement, reste codé en dur (`planNames`, `planMembers`, `planDescs`) |
| POST | `/agence/souscrire-complet` | Wizard complet : identité + upload photo Cloudinary + document + mot de passe temporaire + abonnement + magic link onboarding |
| GET | `/agence/partenaires?ville=&type=&q=` | Annuaire réseau (`UNION` `clinics`/`pharmacies`/`laboratories`) |
| GET | `/agence/medecins?ville=` | Liste médecins (JOIN `clinics`) |
| POST | `/agence/rdv` | Prise de RDV pour un patient, `created_by='agent_bolamu'` |
| POST | `/agence/import-employes` | Import masse employés (voir `ARCHITECTURE_WELLNESS_BOLAMU.md` §1/§7 — bug de rattachement contrat documenté là-bas) |
| POST | `/agence/reclamation/reactiver` | Réactive un compte + dernier abonnement expiré (<30j) |
| POST | `/agence/reclamation/changer-formule` | Change le plan d'un abonnement actif |
| POST | `/agence/reclamation/corriger` | Corrige `first_name`/`last_name`/`full_name`/`birth_date`/`email` uniquement (liste blanche) |
| POST | `/agence/reclamation/signaler` | Signalement (log `audit_log` uniquement, pas de notification admin réelle malgré le message retourné) |

**Ce que fait l'agence que l'agent ne fait pas** : vue réseau global (stats non scopées), recherche/consultation d'un adhérent existant, wizard d'inscription complet avec upload photo/documents et mot de passe temporaire, prise de RDV directe, réclamations (réactivation/changement de formule/correction/signalement), import employés grand compte, annuaire partenaires par ville/type.

**Ce que fait l'agent que l'agence ne fait pas** : tableau de bord de performance personnelle scopé sur ses propres inscriptions (`agent_phone`), inscription partenaires (pharmacie/laboratoire/clinique) — **absente de `agence.routes.js`**, aucune route équivalente retrouvée dans ce fichier.

---

## 5. Traçabilité

**Mécanisme** : colonne `agent_phone` (migration_056) sur 4 tables (`users`, `doctors`, `pharmacies`, `laboratories`), renseignée au moment de l'INSERT par les contrôleurs partagés (`patient.controller.js:44`, `doctor.controller.js:94`, `pharmacie.controller.js:82`, `laboratoire.controller.js:84`).

**Incohérence confirmée entre les deux portails** : seul le chemin `agent.routes.js` (`/agent/inscrire-patient`, `/agent/inscrire-partenaire`) passe par ces contrôleurs partagés et alimente donc réellement `agent_phone`. Le portail `agence.routes.js` crée des patients par **INSERT direct** dans `users` à trois endroits (`/souscrire` ligne 181-185, `/souscrire-complet` ligne 333-345, `/import-employes` ligne 588-592) — **aucun de ces trois INSERT ne renseigne `agent_phone`**. Conséquence concrète : un patient inscrit via `agence/dashboard.html` par un agent authentifié n'apparaîtra **jamais** dans les compteurs `/agent/dashboard` ou la liste `/agent/mes-inscrits` de ce même agent (qui filtrent strictement sur `agent_phone`) — la traçabilité par agent n'existe que pour la moitié des parcours d'inscription possibles.

**Système de commissions** : recherche exhaustive dans `agent.routes.js` et `agence.routes.js` — **aucune table, colonne ou calcul de commission trouvé**. Ni pourcentage, ni montant fixe par inscription, ni table `agent_commissions`/`commission_rules` équivalente. Fonctionnalité entièrement absente du code actuel, à construire si elle est requise par le modèle commercial — pas une omission de lecture, une absence réelle et confirmée.

---

## 6. Points de vigilance

- **Deux portails pour le même rôle DB, aucun tranché comme officiel** — déjà consigné dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §4, décision explicitement en attente de `/tech-lead` + `/office-hours`. Ce document confirme que les deux portails ne sont pas de simples doublons UI : leurs périmètres fonctionnels diffèrent réellement (§4) et leurs effets sur la traçabilité diffèrent aussi (§5) — trancher lequel est « officiel » a un impact fonctionnel réel, pas seulement cosmétique.
- **Cliniques mappées sur `doctors` à l'inscription via l'agent** (`agent.routes.js:139`) — dette technique documentée par le développeur lui-même dans le code, alors que la table `clinics` existe et est utilisée en lecture par le portail agence (§4). Non corrigé ici, comme demandé.
- **Absence totale de système de commission** — confirmé par recherche exhaustive (§5), à construire si nécessaire.
- **Double clé localStorage** — confirmée : `agent/dashboard.html` utilise la clé dynamique `bolamu_${ROLE}_token` avec `ROLE='agent_bolamu'` (ligne 242-245), soit littéralement `bolamu_agent_bolamu_token`/`bolamu_agent_bolamu_phone` ; `agence/dashboard.html` utilise `bolamu_agent_token`/`bolamu_agent_phone`/`bolamu_agent_name` (lignes 1966-1968). Les deux jeux de clés sont incompatibles entre eux (une session ouverte sur un portail n'est pas reconnue par l'autre) — déjà référencé dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3, confirmé ici avec les lignes exactes.
- **Login dupliqué** — `agence.routes.js` réimplémente entièrement un flux de login (bcrypt + signature JWT locale) plutôt que de réutiliser le endpoint d'authentification central utilisé par tous les autres rôles (y compris `agent.routes.js`, qui n'a pas cette duplication) — surface de maintenance et de risque de désynchronisation supplémentaire (ex. règles de rate-limiting login potentiellement absentes de ce endpoint dédié, à vérifier séparément par `/security-officer`).
