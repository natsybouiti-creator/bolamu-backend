# Architecture Bolamu Wellness (Corporate Wellness B2B) — Bolamu

> Document de référence sur le programme Bolamu Wellness : abonnements entreprises pour le bien-être des employés.
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` (schéma), `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (rôles, dont `company_rh`/`rh` §5) et `ARCHITECTURE_FINANCIERE_BOLAMU.md` (§5 SmartFlow Grands Comptes, CDR) — non répétés ici, seulement cités.
> Sources : `src/routes/{wellness,agence,smartflow}.routes.js`, `src/services/wellness.service.js`, `src/jobs/wellness.cron.js`, `public/rh/dashboard.html`, `database/migration_006_bank_transfers.sql`, `database/migrations/migration_039_wellness_sprint2.sql`.

**Important — deux modules distincts, ne pas confondre** :
- **Ce document** couvre `wellness.routes.js`/`wellness.service.js` (Sprint 2) et le volet RH/entreprises de `smartflow.routes.js` (`/rh/*`) — c'est-à-dire tout ce qui touche au programme Corporate Wellness B2B.
- `smartflow.routes.js` (hors `/rh/*`) est un **autre module** : le moteur de tagging catalogue SSP / hors-catalogue pour prestataires individuels (pharmacie, laboratoire, médecin) — couvert par `ARCHITECTURE_SOINS_BOLAMU.md` §0bis et `ARCHITECTURE_FINANCIERE_BOLAMU.md` §5. Aucun renommage entre les deux n'a été effectué (décision produit : ce sont deux systèmes distincts et correctement nommés).

---

## 0. Vue d'ensemble Bolamu Wellness

Modèle B2B Corporate Wellness : l'entreprise finance directement l'accès Bolamu pour ses employés (l'entreprise paie, l'employé bénéficie — pas de retenue sur salaire dans ce modèle-là, à distinguer du mode `retenue_salaire` du hors-catalogue SmartFlow qui, lui, prélève sur la paie de l'employé pour des actes hors-catalogue ponctuels).

**Constat central** : le terme technique « wellness » recouvre en réalité **deux systèmes non connectés entre eux dans le code** :
1. **`wellness.routes.js`/`wellness.service.js`** (Sprint 2, ce document §2/§4) — suivi individuel bien-être : synchronisation Google Fit, règles d'évaluation (pas, fréquence cardiaque), crédit Zora automatique. Fonctionne pour **tout patient**, pas seulement les salariés d'entreprise sous contrat.
2. **`company_contracts`/`company_employees`** (§1) et **`smartflow.routes.js` section `/rh/*`** (§3) — gestion des contrats grands comptes, import employés, calcul ICP (Indice de Capital Productif). C'est ce second système qui répond au cas cible cité (type BRASCO, ~1300 employés) — il **lit** les données du premier (`wellness_actions`, voir §3) mais n'a par ailleurs aucun lien structurel avec un `company_contract_id` avant l'étape de calcul ICP.

Aucune trace dans le code d'un tarif ou d'une mécanique **spécifiques** à « 10 000 FCFA/mois/employé » — les contrats B2B utilisent les mêmes clés `platform_config` (`price_essentiel`/`price_standard`/`price_premium`) que les abonnements individuels (voir §6).

---

## 1. Contrats entreprises

**Base de données** :
- `company_contracts` (`migration_006_bank_transfers.sql:97-141`) — `reference` (format `BOL-B2B-{company_code}-{YYYYMMDD}`), `company_code`, `company_name`, `contact_name/phone/email`, `employee_count`, `total_amount_fcfa`, `plan` (`essentiel`/`standard`/`premium`), `billing_type` (`monthly`/`annual`), `status` (enum `company_contract_status` : `draft`/`signed`/`active`/`terminated`), `destination_account_id` (FK `bolamu_accounts`).
- `company_employees` (`migration_006_bank_transfers.sql:158-191`) — colonnes réelles : `id`, `contract_id` (FK `company_contracts`), `employee_phone` (FK `users.phone`, NOT NULL), `employee_name` (NOT NULL), `subscription_id` (FK `subscriptions`), `status` (enum `company_employee_status` : `pending`/`active`/`suspended`), `notes`, `created_at`, `updated_at`. Colonne additive `payeur_direct_phone` ajoutée par `migration_008_collecte_4canaux.sql:49-51`. Index unique `(contract_id, employee_phone)`.
- `config_categories_rh` — configuration des 5 catégories RH par contrat (`cadre_direction`/`cadre`/`agent_maitrise`/`employe`/`ouvrier`), colonnes `categorie_rh`/`pourcentage_salarie`/`plafond_mensuel` — **table distincte de `company_employees`**, à ne pas confondre (voir bug §7).

**Backend** — création contrat (`admin.routes.js:1027-1142`, `adminOnly`) : génère `company_code`/`reference`, récupère le tarif dans `platform_config`, insère le contrat en transaction + les 5 lignes `config_categories_rh` par défaut. Deux voies d'ajout d'employés existent, **toutes deux non fonctionnelles** — détail exact en §7 :
- `POST /admin/company-contracts/:id/employees` (`admin.routes.js:1221-1270`) — ajout unitaire ou import Excel/CSV côté admin.
- `POST /agence/import-employes` (`agence.routes.js:518-672`) — import en masse côté portail agence.

**Frontend** :
- `public/admin/dashboard.html` — `panel-smartflow` contient la gestion des contrats (`loadContracts()` ligne 1491, `loadContractsForImport()` ligne 1692, `importEmployees()` ligne 1702 : lit un fichier Excel via `XLSX.js`, envoie chaque ligne à `POST /admin/company-contracts/:id/employees` avec `{employee_phone, employee_name, matricule, categorie_rh}`).
- `public/agence/dashboard.html:711-759` — section « Import employés en masse » : upload Excel/CSV, aperçu avant confirmation, bouton `btn-confirm-import-employes` (ligne 1909) → `fetch('${API}/agence/import-employes', {body: JSON.stringify({employes: importEmployesData})})` (ligne 1916) — **n'envoie jamais `company_contract_id`** (voir §7).

---

## 2. Dashboard RH — Bien-être

**Backend** (`src/routes/wellness.routes.js`, monté `/api/v1/wellness`) :

| Méthode | Chemin | Auth | Action |
|---|---|---|---|
| GET | `/wellness/google-fit/auth-url` | public | URL OAuth Google Fit |
| POST | `/wellness/google-fit/callback` | public | Callback OAuth |
| POST | `/wellness/google-fit/sync` | patient | Synchronise pas/FC depuis Google Fit |
| POST | `/wellness/evaluate` | patient | Évalue les règles `wellness_rules` pour le patient connecté |
| POST | `/wellness/credit` | authentifié (pas de garde de rôle explicite dans la route elle-même) | Crédite manuellement une action wellness |
| GET | `/wellness/stats/daily`, `/wellness/stats/weekly` | patient | Stats personnelles |
| GET | `/wellness/leaderboard` | public | Classement |

**Base de données** (`migration_039_wellness_sprint2.sql`) : `wellness_logs` (métrique/valeur/unité/horodatage par patient), `wellness_rules` (seuils → `zora_points`, ex. seuil pas/jour), `wellness_actions` (crédits déjà appliqués, anti-doublon), `google_fit_tokens`.

**Métrique clé pour le cas RH** : `wellness_actions.zora_points` (colonne réellement utilisée par le calcul ICP, voir §3) — le volume de Zora généré par les actions bien-être d'un employé sert de proxy d'engagement santé dans le score ICP, mais **aucun lien direct n'existe entre `wellness_actions` et un `company_contract_id`** : le rattachement se fait uniquement via `company_employees.employee_phone` au moment du calcul ICP (`calculerICP()`, §3), pas dans `wellness_actions` elle-même.

**Frontend** (`public/rh/dashboard.html`) : aucune section dédiée « bien-être » distincte trouvée — le seul indicateur bien-être visible est `#icp-wellness` (« Wellness moyen », ligne 359) affiché **dans** le panel ICP Mensuel (§3), pas dans un onglet séparé.

---

## 3. Dashboard RH — Productivité et ROI

**Backend** — `calculerICP(contract_id, mois)` dans `src/services/smartflow.service.js:494-618`, exposé via `GET /api/v1/smartflow/rh/icp/:mois` (`smartflow.routes.js:860`, `rhOnly`).

**Formule réellement implémentée** (ligne 545-548) :
```
taux_activite = nb_actifs / nb_employes * 100
score_icp = (taux_activite * 0.4) + (avg_wellness / 10 * 0.3) + (nb_consultations / nb_employes * 30)
```
où `avg_wellness` = somme de `wellness_actions.zora_points` du mois pour les employés du contrat, divisée par `nb_actifs` ; `nb_consultations` vient de `clearing_transactions` (`reference_type='appointment'`, **non filtré par contrat** — compte toutes les consultations de la plateforme, pas seulement celles des employés du contrat, voir §7) ; `nb_ordonnances` vient de `prescriptions` (également non filtré par contrat).

**Écart avec la demande initiale — à signaler explicitement** : aucune trace dans le code d'une méthodologie **WHO HPQ Short Form** (questionnaire de présentéisme), d'un indicateur de **baisse du présentéisme**, d'**économies santé**, d'**impact CA**, ni d'un coefficient **TPH (Taux de Part Humaine)** par département. Recherche exhaustive (`HPQ`, `TPH`, `présentéisme`, `Taux de Part Humaine`) : **aucune occurrence dans tout le dépôt**. Ce qui existe réellement est la formule ci-dessus, plus simple, sans lien avec ces référentiels. Ces éléments relèvent donc soit d'une roadmap non commencée, soit d'un narratif commercial non encore traduit en code — à ne pas présenter comme implémenté.

**Résultats stockés** : `icp_scores` (par `contract_id`+`mois`, `ON CONFLICT` upsert) et `smartflow_reports` (même clé, `report_data` JSONB) — deux tables recevant la même donnée sous deux formes (colonnes typées vs JSON), écrites dans la même transaction (lignes 551-593).

**Frontend** (`public/rh/dashboard.html:335-376`) : panel `panel-icp` (« ICP Mensuel »), sélection du mois, bouton « Calculer ICP » (`calculerICP()` JS, ligne 781, appelle `GET /smartflow/rh/icp/{mois}`), affiche `score_icp`, `taux_activite`, `avg_wellness`, `nb_consultations`, `nb_employes`, `nb_actifs`, `nb_ordonnances`. Export JSON du rapport disponible (ligne 809-823).

---

## 4. Cron Wellness

**Backend** (`src/jobs/wellness.cron.js`) — deux jobs `node-cron`, timezone `Africa/Brazzaville`, actifs seulement si `NODE_ENV=production` ou `ENABLE_WELLNESS_CRON=true` (`.env.example:66`, désactivé par défaut) :

| Job | Fréquence | Action |
|---|---|---|
| `syncGoogleFitCron` | `0 */6 * * *` (0h/6h/12h/18h) | Pour chaque `google_fit_tokens` non expiré : `syncPatientData()` (`googlefit.service.js`) → écrit dans `wellness_logs` |
| `evaluateWellnessRulesCron` | `30 */6 * * *` (30 min après le sync) | Pour tout patient `is_active=true` : `evaluateRules()` (`wellness.service.js`) → compare `wellness_logs` du jour aux seuils `wellness_rules`, crédite Zora via `wellness_actions` si seuil atteint et pas déjà crédité |

Démarré dans `server.js:367-368` (`startWellnessCron()`), déclenché pour **tous les patients actifs**, pas seulement les salariés sous contrat entreprise.

---

## 5. Notifications Wellness

Aucun template WhatsApp dédié spécifiquement au mot « wellness » retrouvé dans `wellness.service.js`/`wellness.cron.js`/`googlefit.service.js` (ces flux ne déclenchent aucun `sendAutoMessage`). Les notifications liées au volet grands comptes (hors-catalogue, RH) sont documentées dans `docs/ARCHITECTURE_NOTIFICATIONS.md` et dans `ARCHITECTURE_SOINS_BOLAMU.md`/`ARCHITECTURE_FINANCIERE_BOLAMU.md` — non répétées ici.

---

## 6. Modèle économique Wellness

Aucune clé `platform_config` ni aucune constante code dédiée à un tarif « 10 000 FCFA/mois/employé », à un « pilote 90 jours », à des « KPI contractuels »/« primes de performance », à une « clause data-sharing trimestrielle » ou à un « financement Elonga par les surplus Wellness » — recherche exhaustive sans résultat. Les contrats B2B utilisent en pratique les **mêmes** clés tarifaires que les abonnements individuels (`price_essentiel`/`price_standard`/`price_premium`, `ARCHITECTURE_ADMIN_BACKOFFICE_BOLAMU.md` §4) : `admin.routes.js:1063` calcule `total_amount_fcfa = price_per_employee * max_employees` à la création du contrat, sans tarif dédié grand compte.

Ces éléments (tarif dédié, pilote KPI, data-sharing, financement Elonga) relèvent donc d'un narratif commercial/produit non traduit en code à ce jour — à trancher séparément côté produit, pas déductible du dépôt actuel.

---

## 7. Points de vigilance

**Bug confirmé — écriture dans `company_employees` cassée par TROIS chemins de code sur quatre, avec des jeux de colonnes incompatibles entre eux et avec le schéma réel.**

Schéma réel (`migration_006_bank_transfers.sql:158-191`, additive `migration_008_collecte_4canaux.sql:49-51`) : `id, contract_id, employee_phone, employee_name (NOT NULL), subscription_id, status, notes, created_at, updated_at, payeur_direct_phone`.

| Chemin de code | Colonnes utilisées | Verdict |
|---|---|---|
| `smartflow.service.js::calculerICP()` (lecture, ligne 501-502) : `SELECT employee_phone FROM company_employees WHERE contract_id=$1 AND status='active'` | `contract_id`, `employee_phone`, `status` | **Correct** — seul chemin dont les colonnes existent réellement |
| `admin.routes.js` `POST /company-contracts/:id/employees` (écriture, ligne 1249-1253) : INSERT `(contract_id, employee_phone, employee_name, matricule, categorie_rh, status, ...)` | `matricule` et `categorie_rh` **n'existent pas** sur `company_employees` (ce sont des colonnes de `config_categories_rh`, une autre table) | **Cassé** — échoue à chaque appel (`column "matricule" does not exist`) |
| `agence.routes.js` `POST /import-employes` (écriture, ligne 619-624) : INSERT `(company_contract_id, company_id, patient_phone, subscription_id, categorie_rh, enrolled_at, enrolled_by)` | `company_contract_id`, `company_id`, `patient_phone`, `enrolled_at`, `enrolled_by` **n'existent pas** ; `employee_name` (NOT NULL) jamais fourni | **Cassé** — échouerait à chaque appel si jamais exécuté (voir ci-dessous pourquoi il ne l'est jamais en pratique) |
| `smartflow.service.js::enregistrerHorsCatalogue()` (lecture RH, ligne 169-171) : `SELECT phone FROM company_employees WHERE company_contract_id=$1 AND role='company_rh' AND status='active'` | `company_contract_id`, `phone`, `role` **n'existent pas** — confirmé par le commentaire du développeur lui-même (ligne 166-168) | **Cassé, connu et documenté dans le code** — notification RH hors-catalogue jamais envoyée, échec silencieux (`catch(rhError)`) |

**Conséquence pratique en cascade** :
1. Le **seul** point d'entrée frontend réellement branché à un contrat (`admin/dashboard.html:1702` `importEmployees()`, appelant `POST /admin/company-contracts/:id/employees`) échoue systématiquement — l'import employés par Excel côté admin est non fonctionnel de bout en bout.
2. Le formulaire d'import de `agence/dashboard.html:711-759` (`btn-confirm-import-employes`, ligne 1916) **n'envoie jamais `company_contract_id`** dans son `fetch` — donc côté backend, `contractId = company_contract_id || null` vaut toujours `null`, et le bloc `if (contractId) { INSERT INTO company_employees ... }` (ligne 617-626) n'est **jamais exécuté** en usage réel. Ce formulaire crée bien des comptes patients + abonnements individuels (cette partie fonctionne), mais ne les rattache **jamais** à un contrat entreprise — même si la requête était corrigée, ce chemin frontend ne l'invoquerait toujours pas.
3. En conséquence, `company_employees` ne peut aujourd'hui être peuplée par **aucun** des deux parcours UI existants. `calculerICP()` (lecture correcte des colonnes) trouvera donc `nb_employes = 0` pour tout contrat réel, ce qui donne systématiquement `score_icp` proche de 0 (les termes `taux_activite` et le ratio `/nb_employes` sont neutralisés par la garde `nb_employes > 0 ? ... : 0`) — le tableau de bord ICP RH est fonctionnellement vide en production tant qu'aucun employé n'a été lié manuellement en base.

**Frontière SmartFlow/Wellness — tranchée** : les routes `smartflow.routes.js` préfixées `/rh/*` (dashboard, export, retenues, config/categories, icp, rapport) appartiennent au périmètre **Wellness/grands comptes** documenté dans ce fichier — elles concernent exclusivement la relation contrat-entreprise/employé (§1-§3), pas le tagging SSP/hors-catalogue individuel (qui reste dans `ARCHITECTURE_SOINS_BOLAMU.md`/`ARCHITECTURE_FINANCIERE_BOLAMU.md`). Le fait qu'elles vivent dans le même fichier `smartflow.routes.js` que le reste du module SmartFlow est une question d'organisation de code, pas une ambiguïté fonctionnelle.

**Rôle `company_rh`** : légataire, `0 compte réel en base` (`ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §5) — seul `rh` est un rôle réellement attribué ; `rhOnly` (`smartflow.routes.js:23`) accepte les deux par prudence historique.
