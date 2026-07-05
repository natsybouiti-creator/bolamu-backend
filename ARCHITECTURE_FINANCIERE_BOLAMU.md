# Architecture financière — Bolamu

> Document de référence sur les flux financiers réels : collecte abonnements, reversements partenaires, remise/tiers payant, CDR médecins, SmartFlow B2B, crédits.
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` et `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` — non répétés ici.
> Sources : `src/routes/{subscriptions,collecte,clearing,bank-transfer,credits,payouts}.routes.js`, `src/services/{billing,smartflow,prorata}.service.js`, `src/scripts/clearing-mensuel.js`, `src/controllers/remise-partenaire.controller.js`, requêtes directes `platform_config` sur Neon, `public/register.html`, `public/{admin,rh,patient}/dashboard.html`.

**⚠️ Note de cadrage sur les tarifs** : `ARCHITECTURE_PAIEMENT_BOLAMU.md` (déjà existant, daté juin 2026) documente une vision produit avec des plans nommés **MOTO/NDEKO/LIBOTA** à 2 000/5 000/10 000 FCFA. Ces noms sont réels mais ce sont des **libellés d'affichage uniquement** (`PLAN_LABEL` dans `subscriptions.routes.js:15`) — la colonne DB `subscriptions.plan` stocke en réalité `essentiel`/`standard`/`premium`. Confirmé aussi dans `public/cgu.html` (Article 2 : « Formule... MOTO, NDEKO, LIBOTA »). Les montants réels lus depuis `platform_config` sur Neon au moment de la rédaction : `price_essentiel=2000` (24 000/an), `price_standard=5000` (60 000/an — diffère de l'ancienne note mémoire à 4 000/48 000), `price_premium=10000` (120 000/an). Le seuil de rentabilité réel en base est `breakeven_subscribers=280`, **pas 1 000** comme parfois mentionné — voir §7.

---

## 0. Vue d'ensemble des flux financiers

```
Patient paie abonnement (4 canaux : OVP bancaire / MoMo annuel / familial / SEPA diaspora)
        ↓
Bolamu collecte (statut admin: pending → validé manuellement)
        ↓
Bolamu reverse les partenaires : CDR clinique/pharmacie/labo via clearing_transactions
        → clearing.routes.js déclenche runClearing() [STUB non implémenté, voir §2]
        → billing.service.js::calculerReversement()/validerClearing() [service orphelin, jamais appelé, voir §2]
        ↓
Médecins payés séparément via doctor_payouts (CDR clinique, calcul manuel admin, voir §4)
        ↓
Remise partenaire (tiers payant) appliquée directement au point de soin pharmacie/labo
        (transactions_remise_partenaire, initiée par le partenaire lui-même, voir §3)
```

---

## 1. Abonnements patients

**Base de données** : `subscriptions` (migration_001, + `canal_paiement`/`statut_collecte` migration_008), `payments` (préexistante), `ovp_documents`, `bank_transfer_requests`, `beneficiaires_familiaux` (migrations_005/006/008).

**Backend — 4 canaux via `src/routes/collecte.routes.js`** :

1. **OVP bancaire** (`POST /collecte/ovp/initier`, `authMiddleware` + `idempotencyMiddleware`) : lit le plan actif + nombre de bénéficiaires familiaux, calcule `montant = (personnes_plan + bénéficiaires) × price_par_personne` (2000 FCFA/pers.), génère un PDF d'Ordre de Virement Permanent (PDFKit) avec IBAN Ecobank, l'upload sur Cloudinary, INSERT `ovp_documents`, passe `subscriptions.statut_collecte='en_attente_ovp'`.
2. **MoMo annuel** (`POST /collecte/momo/initier`) : lit `price_{plan}_annual` depuis `platform_config`, crée une transaction `payments` en `status='pending'` avec référence `BOL-MOMO-{phone}-{timestamp}` — **paiement 100% déclaratif, aucun appel API MTN réel à ce stade** (le patient envoie le MoMo hors-app et communique la référence).
3. **Tiers payant familial** (`POST /collecte/familial/ajouter`) : ajoute un bénéficiaire dans `beneficiaires_familiaux`, exige un OVP du payeur déjà initié (`statut` dans `genere/envoye/signe/valide`), lie `users.payeur_principal_id`.
4. **SEPA diaspora** (`POST /collecte/sepa/initier`) : calcule le montant FCFA→EUR (taux `taux_change_eur_fcfa` en config, fallback 655.957 si absent), crée une demande `bank_transfer_requests` (`canal_type='sepa_diaspora'`, `destination_account_id='COMPTE_FRANCE_NBA'` — valeur codée en dur, pas une vraie FK vers `bolamu_accounts`).

**Validation admin** (`authMiddleware.requireAdmin`) : `PATCH /collecte/admin/ovp/valider/:phone` et `PATCH /collecte/admin/sepa/valider/:phone` — active le patient (`users.is_active=TRUE`) + tous ses bénéficiaires familiaux + `subscriptions.statut_collecte='actif'`. `GET /collecte/admin/ovp/fichier-mensuel` génère un CSV de remise à Ecobank (plafonné à 10 000 lignes, avertissement console si atteint — pas de pagination implémentée).

**Flux `subscriptions.routes.js` (souscription initiale, distinct de `collecte.routes.js`)** : `POST /initiate` (crée la ligne `subscriptions` en `pending`, `is_active=FALSE`) → `POST /confirm` (patient soumet sa référence de paiement, notifie l'admin via WhatsApp `bolamu_souscription_a_valider`) → `PUT /:id/validate` (admin, `['admin','content_admin']`) : désactive les anciens abonnements du patient, active le nouveau (`expires_at = fin du mois courant`), active `users.is_active`, notifie le patient (`bolamu_abonnement_active`).

**Frontend** : `public/register.html` (étape souscription, appelle `/subscriptions/initiate` + `/confirm`), `public/patient/dashboard.html` (section abonnement/paiement MoMo), `public/admin/dashboard.html` (validation OVP/SEPA/MoMo).

---

## 2. Reversements partenaires (clearing)

**Base de données** : `clearing_transactions` (migration_049) — `partner_type` CHECK `IN ('pharmacie','laboratoire','partenaire')`, **`doctor`/`medecin` explicitement exclu**. **Confirmé pourquoi** : le CDR clinique/médecin passe par un circuit entièrement séparé — `doctor_payouts` (voir §4) — jamais par `clearing_transactions`. Les cliniques (partenaires de type « clinique ») et les médecins individuels ne partagent donc pas le même mécanisme de reversement que pharmacie/laboratoire.

**⚠️ Anomalie majeure — le clearing mensuel n'est pas implémenté** :
- `POST /api/v1/clearing/run` (`clearing.routes.js:200-208`, admin) appelle `runClearing()` importée de `src/scripts/clearing-mensuel.js`. Ce fichier est **un stub complet** :
  ```js
  async function runClearing() {
    // TODO: logique de calcul CDR par zone/partenaire
    return { success: true };
  }
  ```
  Il ne fait qu'un `console.log` et retourne `success: true` sans toucher une seule table. **Le bouton « déclencher le clearing » de l'admin ne calcule donc actuellement rien.**
- `src/services/billing.service.js` contient pourtant un vrai algorithme fonctionnel : `calculerReversement(partner_phone, partner_type, periode)` (somme les `clearing_transactions` en `status='pending'` sur la période) et `validerClearing(partner_phone, periode)` (passe les transactions en `status='cleared'`, crée une ligne `partner_payouts`). **Grep exhaustif confirmé : ces deux fonctions ne sont appelées par aucun autre fichier du dépôt** — service entièrement orphelin, jamais branché à une route. `validerClearing()` contient de plus une requête SQL suspecte (`UPDATE ... RETURNING SUM(amount_fcfa)`), qui n'agrège pas correctement en PostgreSQL (RETURNING ne supporte pas les agrégats sur un UPDATE multi-lignes) — donc même si le service était branché, cette ligne échouerait probablement à l'exécution.
- Ce que `clearing.routes.js` fait réellement fonctionner : `GET /clearing/pending` (liste `partner_payouts` en attente), `PATCH /clearing/:id/pay` (déclenche un **vrai** versement automatique via API MTN Disbursement (`sandbox.momodeveloper.mtn.com` — **environnement sandbox, pas production**) ou Airtel Merchant Payment selon l'opérateur détecté du numéro), `PATCH /clearing/:id/fail` (marque échoué avec motif obligatoire).
- **Conclusion factuelle** : le pipeline de *calcul* du reversement (agréger les `clearing_transactions` pending → créer les lignes `partner_payouts`) n'existe pas en production active ; seul le pipeline de *paiement* d'un `partner_payouts` déjà existant (créé manuellement ou par un autre moyen non identifié) fonctionne, et encore, contre une API MTN en mode sandbox.

**Déclencheur** : manuel uniquement (`POST /clearing/run` depuis le dashboard admin) — aucun cron job de clearing trouvé dans `src/jobs/` ou `src/cron/`.

**Frontend** — `public/admin/dashboard.html` : section clearing (`GET /clearing/pending`, `POST /clearing/run`, `PATCH /clearing/:id/pay`).

---

## 3. Remise partenaire (ex tiers-payant)

**Base de données** : `transactions_remise_partenaire` (renommée de `transactions_tiers_payant`, migration_054), `partner_conventions` (préexistante, migration_005).

**Backend** — `src/controllers/remise-partenaire.controller.js`, workflow complet :
1. `initiateTransaction` — seuls `pharmacie`/`laboratoire` peuvent initier. Vérifie l'abonnement patient actif (`subscriptions.status='active' AND expires_at >= NOW()`), vérifie la convention du partenaire (`partner_conventions.status_new='actif'`), lit `discount_rate_{pharmacie|laboratoire}` depuis `platform_config` (confirmé : 0.15/0.10), calcule `montant_remise = round(montant_total × taux)` et `montant_patient = montant_total − montant_remise`, INSERT `transactions_remise_partenaire` (`status_new='pending'`).
2. `validateTransaction` — le **même partenaire** qui a initié passe la transaction en `status_new='validated'` (pas de contre-validation par une tierce partie).
3. `reconcileTransaction` (admin) — passe en `status_new='reconciling'`.
4. `listTransactionsPartenaire` / `listTransactionsAdmin` — listes paginées avec filtres (mois, statut, partenaire).

**⚠️ Point de vigilance** : aucun état final `cleared`/`paid` n'est atteint dans ce contrôleur — la boucle s'arrête à `reconciling`. Le passage vers un reversement effectif au partenaire dépendrait du même circuit clearing documenté en §2, lui-même non fonctionnel.

**Frontend** : aucun appel direct `/remise-partenaire/*` trouvé dans `public/pharmacie/dashboard.html` ou `public/laboratoire/dashboard.html` lors des passes de recherche précédentes (ces dashboards consomment `/prescriptions/*` et `/zora/vouchers/*` — voir `ARCHITECTURE_SOINS_BOLAMU.md` §3). Le flux remise-partenaire semble donc backend-only actuellement, sans interface dédiée confirmée.

---

## 4. Rémunération médecins (CDR)

**Base de données** : `doctor_payouts` (migration_004).

**Backend** — `src/routes/payouts.routes.js` (admin uniquement) :
- `GET /payouts/preview?period_start&period_end` — calcule le montant dû par médecin actif : `COUNT(appointments WHERE status='completed')` × tarif selon spécialité (`fee_infirmier`/`fee_specialiste`/`fee_generaliste` depuis `platform_config`, confirmés 5000/15000/8000 FCFA). **Note** : filtre sur `appointments.status='completed'`, alors que le workflow réel documenté dans `ARCHITECTURE_SOINS_BOLAMU.md` utilise les statuts `'confirme'`/`'en_cours'`/`'termine'` — `'completed'` n'apparaît dans aucune autre partie du code lue jusqu'ici, ce qui suggère que cette requête de preview ne remonte peut-être jamais de résultat en pratique (à vérifier avec `/database-admin`).
- `POST /payouts/initiate` — crée `doctor_payouts` en `status='pending'`, vérifie l'absence de doublon sur la période, exige un `momo_number` renseigné sur le médecin.
- `PATCH /payouts/:id/confirm` — passe en `status='paid'` avec une référence MoMo saisie **manuellement** par l'admin (`momo_reference` dans le body) — **contrairement au clearing partenaire (§2), aucun appel automatique à une API de disbursement MTN/Airtel n'est fait ici** ; le versement au médecin est effectué hors-app et l'admin ne fait que confirmer après coup.
- `GET /payouts/history` — historique.

**Frontend** : aucune section « revenus »/« payouts » trouvée dans `public/medecin/dashboard.html` lors des recherches précédentes — le médecin ne semble pas avoir de vue sur ses versements CDR depuis son propre dashboard ; ce module est piloté entièrement côté admin.

---

## 5. SmartFlow Grands Comptes (B2B)

**Base de données** : `company_contracts`, `company_employees` (migration_006), `hors_catalogue_transactions`, `export_paie_mensuel` (migration_026).

**Backend** — `src/services/smartflow.service.js` :
- `enregistrerHorsCatalogue()` — vérifie le patient actif, détecte s'il est salarié grand compte (`company_employees.company_contract_id`), INSERT `hors_catalogue_transactions` (`statut='notifie'`), notifie le patient (montant à sa charge, hors catalogue SSP), et **tente** de notifier le RH de l'entreprise.
- `getStatsPartenaire()`, `getStatsAdmin()`, `calculerICP()` (Indice de Couverture Prestataire ?), `genererExportPaie()` — export mensuel pour la paie (retenues sur salaire).

**Bug connu confirmé dans le code lui-même** (`smartflow.service.js:115-117`, commentaire du développeur) :
```js
// TODO: requête cassée — company_employees n'a pas de colonne company_contract_id
// ni role (FK réelle = contract_id, pas de colonne role). Feature SmartFlow RH
// non fonctionnelle tant que ce sujet séparé n'est pas corrigé.
const rhCheck = await client.query(
  `SELECT phone FROM company_employees
   WHERE company_contract_id = $1 AND role = 'company_rh' AND status = 'active'`,
  [company_contract_id]
);
```
Cette requête est encapsulée dans un `try/catch` qui avale l'erreur (`logger.warn`) — **la transaction hors-catalogue principale réussit toujours**, mais la notification RH échoue silencieusement à chaque fois. Documenté ici tel quel, sans correction, conformément à la demande. (Rappel : ce même `company_rh` apparaît aussi comme valeur legacy dans `rhOnly` du RBAC — voir `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §5.)

**Frontend** : `public/rh/dashboard.html` — section Smart Flow (retenues, export paie, catégories de config, ICP).

---

## 6. Crédits Bolamu

**Base de données** : `credits`, `credit_transactions`, `credit_partners` — système **distinct de Zora** (`zora_ledger`/`zora_points`), confirmé par `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §3 (« statut de coexistence non clarifié »).

**Backend** — `src/routes/credits.routes.js` :
- Règles d'attribution mensuelle (`CREDIT_RULES`, codées en dur dans le fichier, **pas dans `platform_config`** — contraste avec la règle « taux/prix toujours depuis platform_config ») : patient 100/mois (+50 bonus fidélité si ≥3 mois consécutifs), médecin 200/mois (s'il a eu ≥1 RDV `status='termine'` sur 30j), pharmacie/laboratoire 150/mois.
- `GET /balance`, `GET /balance/:phone` — solde + 20 dernières transactions + partenaires actifs.
- `POST /grant` — attribution manuelle libre (`phone`, `amount`, `reason`).
- `POST /distribute-monthly` — distribution automatique à tous les comptes éligibles (parcourt patients abonnés actifs, médecins actifs, pros vérifiés).
- `POST /spend` — dépense chez un `credit_partners`, réduction calculée `floor(amount/100) × discount_per_100_credits`.
- **✅ Corrigé** : `POST /grant` et `POST /distribute-monthly` n'étaient protégées que par `authMiddleware`, sans vérification de rôle admin (contrairement à `payouts.routes.js`/`clearing.routes.js`, qui ont un `adminOnly` explicite) — n'importe quel utilisateur authentifié pouvait s'attribuer des crédits ou déclencher une distribution mensuelle à tous les comptes éligibles. Corrigé en ajoutant le même middleware `adminOnly` que `payouts.routes.js`/`clearing.routes.js` sur ces deux routes (`src/routes/credits.routes.js`, commit `fix(security): controle role admin sur credits grant/distribute-monthly`). `GET /balance`, `POST /spend`, `GET /partners` restent inchangées et accessibles comme avant. Les routes `GET /admin/all`, `POST /partners`, `PATCH /partners/:id` du même fichier portent des noms évocateurs d'un usage admin mais n'ont **pas** été incluses dans ce correctif (hors périmètre demandé) — même gap potentiel à vérifier séparément avec `/security-officer`.

**Frontend** : aucun appel `/credits/*` confirmé dans `public/patient/dashboard.html` lors des recherches précédentes — le système de crédits semble backend-only à ce jour, sans interface patient dédiée trouvée.

---

## 7. Modèle économique Bolamu

**Plans d'abonnement** (réels, `platform_config` sur Neon — vérifié en direct, pas supposé) :

| Plan (DB) | Libellé public (CGU) | Personnes couvertes | Mensuel | Annuel |
|---|---|---|---|---|
| `essentiel` | MOTO | 1 (`plan_essentiel_personnes`) | 2 000 FCFA | 24 000 FCFA |
| `standard` | NDEKO | 2 (`plan_standard_personnes`) | 5 000 FCFA | 60 000 FCFA |
| `premium` | LIBOTA | 5 (`plan_premium_personnes`) | 10 000 FCFA | 120 000 FCFA |

**Reversements (CDR — Contribution de Disponibilité Réseau)**, définie dans `public/cgu.html` Article 2 et confirmée par `platform_config` : **50% Bolamu / 30% clinique / 12,5% pharmacie / 7,5% laboratoire** (`partner_rate_bolamu=0.50`, `partner_rate_clinique=0.30`, `partner_rate_pharmacie=0.125`, `partner_rate_laboratoire=0.075` — total 100%). Le CGU précise explicitement que la CDR est **versée indépendamment du nombre de consultations** — elle rémunère la disponibilité du Hub dans la zone, pas des actes, ce qui la distingue d'un modèle d'assurance (voir `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md` §0).

**Seuil de rentabilité réel** : `breakeven_subscribers = 280` (valeur `platform_config` vérifiée en direct sur Neon) — **et non 1 000** comme parfois indiqué ; toute communication ou décision produit doit se référer à cette valeur de configuration, pas à un chiffre rond mémorisé.

**Autres tarifs de configuration confirmés** : `doctor_fee_bootstrap/growth/maturity` = 2500/3500/5000 FCFA (phase actuelle : `active_phase='bootstrap'`), `discount_rate_pharmacie=0.15`, `discount_rate_laboratoire=0.10`, `max_discount_rate=50`, `fee_generaliste/infirmier/specialiste` = 8000/5000/15000 FCFA (base du calcul CDR médecin, §4).

---

## 8. Notifications liées aux paiements

Templates WAHA de ce domaine (détail complet dans **`docs/ARCHITECTURE_NOTIFICATIONS.md`**) : `bolamu_abonnement_active`, `bolamu_abonnement_expire` (cron J-7), `bolamu_souscription_a_valider` (admin), `bolamu_credits_ajoutes_solde`, `bolamu_credits_mensuels`, `bolamu_credits_depenses`, `bolamu_voucher_genere`/`bolamu_voucher_utilise` (Zora, hors périmètre de ce document — voir `ARCHITECTURE_ZORA_BOLAMU.md`), `bolamu_hors_catalogue_patient`/`bolamu_hors_catalogue_rh` (SmartFlow, §5 — la notification RH échoue silencieusement, voir bug connu ci-dessus).
