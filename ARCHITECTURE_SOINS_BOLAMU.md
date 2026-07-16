# Architecture du parcours de soins — Bolamu

> Document de référence sur le parcours de soins réel (RDV → consultation → ordonnance → dispensation → labo → résultats).
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` (schéma) et `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (rôles) — non répétés ici, seulement cités.
> Sources : `src/routes/{appointment,healthRecords,vaccination,dmn}.routes.js`, `src/controllers/{doctor,qr,consultation-report,lab,prescription,secretary,constantes-medicales,preRdv}.controller.js`, `src/services/{consultation,ordonnance,lab,pharmacie,secretariat,preRdv,renouvellement,dmn,ai-consult}.service.js`, `src/middleware/bhpAccess.js`, `public/{patient,medecin,pharmacie,secretaire,laboratoire}/dashboard.html`.

---

## 0. Vue d'ensemble du parcours de soins

**⚠️ Constat central, à lire avant tout le reste du document** : le parcours de soins n'est PAS un flux linéaire unique. Deux pipelines parallèles et non connectés coexistent, tous deux actifs en production (voir §3 pour le détail complet) :

```
SYSTÈME A (vivant côté pharmacie/patient/admin) :
Patient prend RDV (appointments) → Secrétaire confirme (secretariat.routes.js)
  → Médecin consulte → Prescription (prescriptions, liée à appointments)
  → Pharmacie scanne code session et dispense (prescriptions.status='delivered')
  → Patient notifié WhatsApp

SYSTÈME B (vivant côté médecin) :
Médecin ouvre consultation (POST /consultations/open, table consultations)
  → Clôture consultation (diagnostic/anamnese/examen_clinique)
  → Émission ordonnance (POST /ordonnances, tables ordonnances/ordonnance_items)
  → [PONT CASSÉ — aucune dispensation pharmacie ne lit cette table en pratique]

PARCOURS LABO (système unique, cohérent) :
Médecin prescrit examen (POST /lab/prescribe, lab_prescriptions)
  → Laborantin publie résultats (POST /lab/results/submit, lab_results)
  → Notification WhatsApp patient + médecin traitant
```

Le médecin crée son ordonnance via le Système B (`POST /ordonnances`, juste après la clôture de consultation dans le même geste UI), mais la pharmacie ne consomme que le Système A (`GET /prescriptions/by-session`, `POST /prescriptions/deliver`). Les deux tables ne se rejoignent jamais dans le flux réel — voir §3.

---

## 0bis. Système SSP (Soins de Santé Primaires)

**Principe** (règles de financement et de facturation détaillées dans `ARCHITECTURE_FINANCIERE_BOLAMU.md` §7, non répétées ici) : trois catalogues gratuits (actes cliniques / médicaments essentiels / examens biologiques) financés par la CDR. Tout item hors de ces catalogues est facturé **au tarif propre du partenaire** — Bolamu n'intervient pas dans ce prix et ne mentionne aucune réduction hors-catalogue nulle part dans le produit.

**Base de données** — aucune nouvelle table créée. Le système réutilise `ssp_catalog` (migration_034, 121 lignes réelles, colonne `type` unifiant médicament/examen/acte, colonne `est_ssp`), déjà existante avant ce chantier. `medicaments_catalogue` (B2B SmartFlow, 54 lignes) reste isolée et n'est pas touchée.

Migration `migration_059_ssp_is_ssp_flag.sql` (appliquée en prod) ajoute une colonne `is_ssp BOOLEAN` sur trois tables :

| Table | Écrite par | Calculée à |
|---|---|---|
| `ordonnance_items` | `POST /ordonnances` (Système B, §3) | création, par ligne médicament |
| `prescriptions` | `POST /prescriptions/create` (Système A, §3) | création, sur `medications` (texte libre) |
| `lab_prescriptions` | `POST /lab/prescribe` (§4) | création, sur `examens` (texte libre, `type='examen'`) |

`is_ssp` est calculé **une seule fois à la création**, jamais recalculé — un changement ultérieur du catalogue n'affecte pas rétroactivement les ordonnances déjà émises.

**Deux fonctions de correspondance, pas une** (`src/services/smartflow.service.js`) :
- `isSSP(nom_prestation, type=null)` — préexistante (SmartFlow B2B), direction `ssp_catalog.nom ILIKE '%' || input || '%'` : le nom du catalogue doit **contenir** l'entrée. Fonctionne seulement pour des noms courts et exacts.
- `isSSPFreeText(texte_libre, type=null)` — **nouvelle fonction**, direction inversée `input ILIKE '%' || ssp_catalog.nom || '%'` + `ORDER BY LENGTH(nom) DESC` : le texte libre doit **contenir** un nom de catalogue. Nécessaire car `prescriptions.medications` et `lab_prescriptions.examens` sont du texte libre avec dosage/fréquence embarqués (ex. `"Amoxicilline 500mg — 3x/jour — 7 jours"`), que `isSSP()` seul ne matchait jamais correctement (`is_ssp` retournait `false` pour un médicament pourtant couvert — bug détecté et corrigé pendant ce chantier, avant tout commit).

**Backend** :
- `ordonnance.service.js::createOrdonnance()` — `isSSPFreeText(item.medicament, 'medicament')` par ligne, stocké dans l'INSERT, retourné dans la réponse. `getOrdonnance()` inclut `is_ssp` dans le SELECT.
- `prescription.controller.js::createPrescription()` — `isSSPFreeText(medications, 'medicament')`, stocké à la création.
- `lab.controller.js::createLabPrescription()` — `isSSPFreeText(examens, 'examen')`, stocké à la création.
- Nouvel endpoint `src/routes/ssp.routes.js`, monté `/api/v1/ssp-catalog` : `GET /` (liste `ssp_catalog`, filtre `?type=` optionnel), `GET /check?nom=&type=` (lookup unitaire via `isSSPFreeText`). **Chevauchement connu, assumé** : `smartflow.routes.js` expose déjà `/smartflow/medicaments/check` et `/smartflow/ssp/medicaments`, plus restreints (médicaments uniquement). `/ssp-catalog` est conservé car seul à couvrir les 3 types ; les deux coexistent, non fusionnés dans ce chantier.

**Frontend** :
- `medecin/dashboard.html` — à l'émission d'ordonnance/prescription labo, statut par ligne affiché avant validation (« Gratuit (SSP) » vert / « Hors catalogue — facturé au tarif de la pharmacie/du labo » rouge).
- `pharmacie/dashboard.html`, `laboratoire/dashboard.html` — tagging SSP par ligne déjà existant avant ce chantier (non documenté jusqu'ici) ; seul le endpoint appelé était cassé (`/smartflow/catalogue`, 404), repointé vers `/ssp-catalog/check`.
- `patient/dashboard.html` — récapitulatif des médicaments par consultation avec statut SSP. Cas particulier : `is_ssp = NULL` (ordonnances antérieures à la migration_059) affiché « Statut non évalué » (gris), distinct de `false` (« À votre charge », rouge) — une confusion NULL/false aurait affiché à tort des ordonnances anciennes comme facturées.
- `secretaire/dashboard.html`, `secretaire/dashboard_v2.html`, `agence/dashboard.html` — catalogue affiché chargé dynamiquement depuis `/ssp-catalog` (plus de tableau `CATALOGUE_SSP` codé en dur), toute mention de réduction/tarif préférentiel hors-catalogue retirée.

**Téléconsultation — hors périmètre SSP, interdiction réglementaire** : la téléconsultation n'est pas un choix de catalogue mais une pratique bannie (Bolamu est un intermédiaire technologique, jamais un établissement de santé — voir `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md`). Toute trace fonctionnelle a été neutralisée à l'occasion de ce chantier (boutons de filtre morts dans les dashboards secrétaire/agence, mention contractuelle dans `cgu.html`, référence dans la liste des routes montées de `CLAUDE.md`/`AGENTS.md`, notice inscription médecin international dans `register.html`). Un reliquat documentaire (audits/comptes-rendus historiques en Markdown, page compilée `public/index.html`) reste signalé mais non traité — décision produit à trancher séparément, hors périmètre technique de ce document.

---

## 1. Prise de rendez-vous

**Base de données** : `appointments` (table réellement utilisée par ce flux) + `rendez_vous` (table distincte, créée migration_048 — anomalie déjà documentée dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.2 : aucun `INSERT INTO rendez_vous` trouvé dans le code, seule `consultation.service.js` y fait un `UPDATE` lors de l'ouverture de consultation, ce qui ne touche donc probablement aucune ligne puisque la table n'est jamais peuplée à la prise de RDV). **Reprise ici** : la prise de RDV n'écrit que dans `appointments` ; `rendez_vous` est une table parallèle orpheline pour ce flux précis.

**⚠️ Dette technique confirmée (audit Passe 3, non corrigée — scope trop large pour ce chantier) : `consultations.rdv_id` référence par FK réelle `rendez_vous(id)` (contrainte `consultations_rdv_id_fkey`, vérifiée sur Neon), mais `medecin/dashboard.html::ouvrirValidation()` envoie en réalité un `appointments.id` (récupéré via `GET /appointments/doctor/:phone`) comme `rdv_id` à `POST /consultations/open`.** Vérifié empiriquement : les 4 lignes de `rendez_vous` (ids 4-7) et les lignes `appointments` de mêmes ids portent des patients/dates totalement différents — la contrainte FK n'est satisfaite que par coïncidence numérique (les deux tables utilisent une séquence `SERIAL` qui se chevauche), pas par référence sémantique correcte. Conséquence directe : `POST /consultations/open` échoue avec une violation de contrainte FK dès qu'un `appointments.id` ne correspond à aucune ligne existante de `rendez_vous` (qui n'en compte que 4 au total) — testé et confirmé en Passe 3. Tant que ce bug n'est pas corrigé, toute jointure applicative s'appuyant sur `consultations.rdv_id` (ex. `ARCHITECTURE_SOINS_BOLAMU.md` §3bis) hérite de cette même fragilité.

**Backend** — `src/routes/appointment.routes.js` :
- `GET /api/v1/appointments/slots/:doctor_id?date=` (public) — calcule les créneaux depuis `doctor_availabilities`, exclut `agenda_blocks` et les RDV déjà pris.
- `POST /api/v1/appointments/book` (`authMiddleware`) — INSERT `appointments` (`status='confirme'`), notifie patient + médecin (WhatsApp `bolamu_rdv_confirme`).
- `GET /appointments/doctor/:phone`, `GET /appointments/patient/:phone` — listes.
- `POST /appointments/:id/validate` — vérifie `session_code`, passe `status='termine'`, crédite Zora (`action_type:'consultation'`).
- `POST /appointments/:id/open` — passe `status='en_cours'` — **endpoint historique, non appelé par le dashboard médecin actif** (qui utilise `/consultations/open`, voir §2).
- `POST /appointments/:id/symptoms` — upsert `appointment_symptoms` (motif/symptômes pré-RDV).

**Secrétariat** (rôle `secretaire`, `authMiddleware.requireSecretary`) — `src/routes/secretariat.routes.js` : `GET /secretariat/agenda`, `PATCH /rdv/:id/status`, `POST /rdv-manuel`, `POST /bloquer-creneau`, `GET /queue`, `PATCH /queue/:id/status`. **Trois implémentations parallèles de la file d'attente** coexistent : `queue_entries` (migration_024, via `secretary.controller.js`), `file_attente` (via `secretariat.service.js`), et `agenda_blocs`/`agenda_blocks` (deux tables au nom quasi identique — l'une avec un « s », l'autre sans). Le rôle secrétaire n'a confirmé aucun accès à `consultation_reports`/`prescriptions`/`ordonnances`/`lab_results` — cohérent avec la règle CLAUDE.md.

**Frontend** :
- `public/patient/dashboard.html` : `GET /appointments/slots/{doctorId}?date=` (chargement créneaux), `POST /appointments/book` (prise de RDV), `GET /doctors` (annuaire). Pas de garde bloquante dédiée à cette section.
- `public/secretaire/dashboard.html` (fichier actif — `dashboard_v2.html` est un prototype de test avec guard désactivé, jamais référencé par `secretaire/login.html`, à ignorer) : `GET /secretariat/queue?date=`, `GET /secretariat/agenda?doctor_phone=`, `PATCH /secretariat/rdv/{id}/status`, `POST /secretariat/bloquer-creneau`. Polling 30s (`setInterval`) mais **limité aux stats/agenda — la file d'attente elle-même n'est jamais auto-rafraîchie**, seulement au chargement initial et après action utilisateur.

---

## 2. Consultation médicale

**Base de données** : `consultations` (migration_048), `medical_records` (migration_048, distincte des colonnes constantes de `users` — voir §5), `health_records`/BHP (`migrations/bhp_001_health_records.sql`, hors `database/migrations/`), `consultation_reports` (système parallèle non branché au dashboard actif, voir ci-dessous).

**Backend** :
- `POST /api/v1/consultations/open` → `src/services/consultation.service.js` : 1) vérifie `subscriptions.is_active=true` (sinon erreur `ABONNEMENT_INACTIF`) 2) INSERT `consultations` (`status='open'`) 3) `UPDATE rendez_vous` (n'affecte probablement aucune ligne, voir §1) 4) `UPDATE file_attente` 5) INSERT/SELECT `medical_records`.
- `POST /consultations/:id/close` → clôture : UPDATE `consultations` (diagnostic, anamnese, examen_clinique, notes_confidentielles), UPDATE `medical_records.antecedents` (append), UPDATE `file_attente`, WhatsApp `bolamu_consultation_terminee`, crédit 50 Zora.
- **Système parallèle non utilisé par le frontend actif** : `src/controllers/consultation-report.controller.js` (`submitReport`) écrit dans **`consultation_reports`** (4ᵉ table de « compte rendu » distincte de `consultations`), lié à `appointments.report_submitted`, crédite aussi 50 Zora. Sa fonction `getPatientTimeline()` fait le seul JOIN qui relie `appointments` + `consultation_reports` + `prescriptions` + `lab_prescriptions` + `lab_results` — mais aucun appel frontend trouvé vers `/consultation-report`, donc cette vue unifiée n'est probablement jamais affichée à personne.
- **Accès BHP** : `bhpAccessMiddleware(allowedRoles)` (`src/middleware/bhpAccess.js:16-62`) — vérifie le rôle, puis si un `health_records.consent_granted` existe pour l'enregistrement ciblé, journalise systématiquement l'accès (autorisé ou refusé) dans `health_record_access_log`. Posé uniquement sur `consultation.routes.js` (`['medecin','admin']`) et `ordonnance.routes.js` (`['medecin','pharmacie','patient']`) — **donc uniquement sur le Système B**, jamais sur les routes du Système A (`appointment.routes.js`, `prescription.routes.js`, `lab.routes.js`), qui font leurs propres vérifications ad hoc.

**Frontend** — `public/medecin/dashboard.html` : `GET /consultations/queue` (file d'attente, non incluse dans le polling 60s), `GET /appointments/doctor/{phone}` (liste RDV, polling 60s si onglet visible), `POST /consultations/open`, `POST /consultations/{rdvId}/close` (inclut le compte rendu dans le body — pas d'appel séparé à `/reports/submit` dans ce flux actif malgré l'existence de cet endpoint ailleurs dans le code).

---

## 3. Ordonnances

**✅ Unifié (Passe 3, Option C — `prescriptions` canonique)** : jusqu'à cette passe, deux systèmes coexistaient sans jamais se rencontrer (le médecin écrivait dans `ordonnances`/`ordonnance_items`, la pharmacie ne lisait que `prescriptions` — voir historique ci-dessous, conservé pour traçabilité de la décision). Audit complet mené avant correction : `prescriptions` a été choisi comme système canonique car seul à avoir des preuves réelles de fonctionnement de bout en bout (lignes historiques `delivered` avec `appointment_id`/`session_code` réels), et parce que la structure en lignes de `ordonnance_items` (dosage/fréquence/durée séparés) n'était de toute façon jamais exploitée par le formulaire médecin actuel (un seul item, champs vides).

**État actuel** :

| | `ordonnances` / `ordonnance_items` (migration_048) | `prescriptions` — **canonique** |
|---|---|---|
| Rattachement | `consultation_id` → `consultations` | `appointment_id` → `appointments` |
| Structure | lignes structurées (jamais réellement exploitées par le frontend) | texte libre (`medications`) |
| Écrite par | **plus aucun appel actif** — `medecin/dashboard.html` appelle désormais `POST /prescriptions/create` | `POST /prescriptions/create` — **dashboard médecin actif** |
| Lue/dispensée par | **plus aucun appel actif** | `GET /prescriptions/by-session/:code`, `POST /prescriptions/deliver` — **dashboard pharmacie actif** |
| Statut | **déprécié, conservé pour historique BHP** (`src/services/ordonnance.service.js`, `src/routes/ordonnance.routes.js` marqués en commentaire, jamais supprimés, données existantes intactes — 5 lignes `ordonnances`/4 lignes `ordonnance_items`) | seul système alimenté désormais |

**Backend** :
- Émission (médecin, actif) : `POST /api/v1/prescriptions/create` → `prescription.controller.js::createPrescription()` — INSERT `prescriptions` avec `appointment_id` (= `currentRdv.rdvId`, déjà connu du frontend), `is_ssp` calculé via `isSSPFreeText()`.
- Dispensation (pharmacie, actif) : `GET /prescriptions/by-session/:code`, `POST /prescriptions/deliver` → UPDATE `prescriptions.status='delivered'` + **génère désormais un `clearing_transactions`** (`partner_type='pharmacie'`, tarif `platform_config.tarif_clearing_pharmacie`, migration_060 — corrige un gap financier réel où la dispensation active ne générait jusqu'ici aucune rémunération CDR pharmacie) + notifie **patient et médecin** (`bolamu_ordonnance_dispensee` / `bolamu_ordonnance_dispensee_medecin`) + `audit_log('prescription_delivered')`.
- **Renouvellement** : deux logiques incohérentes entre elles, non traitées dans cette passe. `src/services/renouvellement.service.js::demanderRenouvellement()` interroge en réalité `lab_prescriptions` (nommage trompeur — « renouvellement d'ordonnance » opère sur les prescriptions labo). `src/services/ai-consult.service.js::generateRenewal()` raisonne, lui, sur `prescriptions`.
- **Lien patient/consultations** : `patient.routes.js::GET /consultations/recentes` (affichage médicaments par consultation, `public/patient/dashboard.html`) lit désormais `prescriptions` via `JOIN prescriptions p ON p.appointment_id = c.rdv_id` — seule clé de liaison disponible tant que le bug FK `consultations.rdv_id`→`rendez_vous` (§1) n'est pas corrigé ; hérite donc de sa fragilité (une consultation dont l'ouverture a échoué sur ce bug FK n'aura simplement pas de ligne `consultations` du tout, donc rien à afficher — dégradation silencieuse, pas une erreur visible).

**Frontend** — `public/pharmacie/dashboard.html` : `GET /prescriptions/by-session/{codeSession}`, `POST /prescriptions/deliver`, `GET /prescriptions/pharmacie/{phone}` — inchangé, cette passe ne touche pas au dashboard pharmacie (il lisait déjà la bonne table). `public/medecin/dashboard.html` : formulaire de création inchangé (textarea libre unique), seul l'endpoint appelé change (`/prescriptions/create` au lieu de `/ordonnances`).

---

## 4. Prescriptions labo et résultats

**Base de données** : `lab_prescriptions` (préexistante, `priorite` ajoutée migration_019), `lab_results` (préexistante).

**Backend** — flux cohérent (contrairement aux ordonnances) mais avec **deux implémentations parallèles à statuts différents** :
- Voie active : `POST /api/v1/lab/prescribe` (`doctorOnly`) → INSERT `lab_prescriptions` (`prescription_code` 6 chiffres). `POST /lab/results/submit` (`labOnly`, upload Cloudinary) → vérifie `status='en_attente'`, INSERT `lab_results`, UPDATE `lab_prescriptions.status='traite'`, crédit Zora `analyse_labo`, notifications `bolamu_labo_resultats_disponibles` (patient) + `bolamu_resultats_disponibles`/notification médecin (voir `docs/ARCHITECTURE_NOTIFICATIONS.md` Boucle 5).
- Voie alternative (`lab.service.js`, mêmes endpoints du même contrôleur mais chemin de code différent `GET /lab/prescription/:code` + `POST` associé) : utilise des statuts **différents** (`pending`/`completed` au lieu de `en_attente`/`traite`) et génère en plus une ligne `clearing_transactions` (tarif `partner_zones`, fallback 5000 FCFA) — incohérence de statuts entre les deux chemins du même contrôleur, à faire trancher par `/tech-lead`.
- Accès résultats : `GET /lab/results/patient/:phone` — restreint patient/médecin traitant/labo traitant. Consultation par code : log dans `dossier_access_log`.

**Frontend** — `public/laboratoire/dashboard.html` : `GET /lab/pending`, `GET /lab/prescription/{code}`, `POST /lab/results/submit`. Aucun polling — la liste de prescriptions en attente n'est jamais auto-rafraîchie.

---

## 4bis. Carnet de vaccination

**Contexte réglementaire** : contrairement au reste du parcours de soins (§1-4), la vaccination est administrée par trois types de professionnels distincts (`doctor`, `pharmacie`, `laboratoire`), pas seulement `doctor`. Ceci entre en conflit direct avec TC-033 (« Pharmacie JAMAIS accès dossier médical »), qui interdit à `pharmacie`/`laboratoire` toute écriture dans `health_records` — confirmé dans `healthRecords.routes.js:8-11` (`bhpAccessMiddleware(['doctor'])`, seule route d'écriture existante avant ce chantier). Décision produit retenue : **ne pas lever TC-033** — création d'une table dédiée pour pharmacie/laboratoire, agrégée en lecture avec `health_records` (arbitrage détaillé dans `docs/scoping_vaccination.md`).

**Base de données** — deux sources, jamais fusionnées :

| Source | Écrite par | Table | Identifiant patient |
|---|---|---|---|
| Médecin | `POST /api/v1/health-records` (`record_type='vaccination'`) | `health_records` (legacy, `patient_id` entier) | résolu depuis `patient_phone` si fourni — la route n'acceptait jusqu'ici que `patient_id`, inconnu des dashboards pro (ajout de ce chantier) |
| Pharmacie / Laboratoire | `POST /api/v1/vaccination/attestation` | `vaccination_attestations` (migration_083, nouvelle table) | `patient_phone` (convention universelle du reste du backend) |

**Backend** :
- Écriture médecin : `healthRecords.routes.js` (route générique déjà existante, étendue) — après INSERT, si `record_type==='vaccination'`, résolution `patient_id→phone` puis `awardZora({action_type:'vaccination', proof_class:'ground_truth', proof_source:'doctor', proof_reference:'hr_'+id})`. Log BHP via `logAccessAttempt()` (`health_record_access_log`) — jusque-là jamais appelé sur ce POST (`bhpAccessMiddleware` ne journalise que si un `recordId` est présent dans les params, absent à la création), corrigé pour ce type d'enregistrement.
- Écriture pharmacie/laboratoire : `src/routes/vaccination.routes.js` (nouveau, monté `/api/v1/vaccination`) — réservé aux deux rôles, INSERT `vaccination_attestations`, `awardZora()` identique (`proof_reference:'va_'+id`), log via `dmn.service.logAccess()` (`dmn_access_log`, `access_type='update'`).
- **Préfixe `hr_`/`va_` sur `proof_reference`** : nécessaire pour éviter toute collision d'idempotence Zora entre les deux tables sources — un `health_records.id` et un `vaccination_attestations.id` numériquement identiques auraient sinon pu se neutraliser mutuellement sur la contrainte applicative `action_type`+`proof_reference`.
- Lecture unifiée : `GET /api/v1/dmn/vaccinations/:phone` (`dmn.routes.js`) → `dmn.service.js::getVaccinationCarnet()`, `UNION ALL` SQL entre les deux sources. Accès : patient (son propre carnet), `doctor` avec RDV existant avec ce patient, `pharmacie`/`laboratoire` ayant déjà enregistré une attestation pour ce patient, ou admin.

**Zora** : règle `vaccination` (`zora_earn_rules.id=4`, 100 pts, catégorie `sante`, `required_proof_class='ground_truth'`) — existait en base depuis un chantier antérieur mais **jamais déclenchée par aucun code** avant ce chantier (confirmé : les lignes `zora_ledger.action_type='vaccination'` préexistantes étaient toutes des crédits manuels de test, `proof_reference` du type `test_migration073_...`). `ground_truth` exigé et vérifié par la hiérarchie de preuve d'`awardZora()` (`src/services/zora.service.js`) — jamais `system_event` (utilisé par `analyse_labo`, §4), car la vaccination n'a pas d'équivalent « dépôt de résultat » intermédiaire : c'est l'acte lui-même, constaté directement par le professionnel qui l'administre.

**Frontend** :
- `medecin/dashboard.html` : modal « Enregistrer un vaccin » (même pattern que le modal « Prescrire un examen labo » existant), déclenché depuis chaque RDV confirmé/terminé.
- `pharmacie/dashboard.html`, `laboratoire/dashboard.html` : carte « Enregistrer une vaccination » dans le panel DMN existant (scanner dossier), formulaire direct par téléphone patient — **pas de RDV ni de prescription préalable requis**, cohérent avec la réalité clinique (vaccination en officine/centre de biologie sans rendez-vous).
- `patient/dashboard.html` : section « Carnet de vaccination » (Suivre > Dossier médical), lecture seule, triée par date décroissante ; carte vitrine dans Gagner > Santé (dernier vaccin + statut crédit), sans aucune action d'écriture — cohérent avec le pattern déjà en place pour Analyse labo/Bilan annuel.
- **Lien calendrier vaccinal** : champ `prochain_rappel_prevu` (optionnel) stocké des deux côtés, affiché dans le carnet patient mais **aucun rappel automatique n'est envoyé** à ce jour — pas de cron ni de notification WhatsApp branchés sur cette date. Fonctionnalité future, hors périmètre de ce chantier.

---

## 5. Constantes médicales

**Base de données** — anomalie confirmée (déjà signalée dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.2/§3) : la table `constantes_medicales` **n'existe pas** en production. Le flux réel écrit sur les colonnes dédiées de `users` (`groupe_sanguin`, `allergies`, `maladies_chroniques`, `antecedents_medicaux`, `traitements_en_cours`, `poids`, `taille`, `contact_urgence_*` — migration_014).

**Backend** — `src/controllers/constantes-medicales.controller.js` :
- `GET /patients/constantes/:phone` et `GET /doctors/constantes/:phone` (même route montée deux fois) → `SELECT ... FROM users WHERE phone=$1`.
- `POST/PATCH/PUT /constantes` (patient) → `UPDATE users SET ...`, `constantes_remplies_par='patient'`.
- `PATCH/PUT /constantes-patient` (médecin, doit avoir eu un RDV avec le patient) → `UPDATE users` + INSERT `dossier_access_log`.
- **Conséquence directe** : `src/services/ai-consult.service.js` (briefing IA pré-consultation) fait un `SELECT * FROM constantes_medicales WHERE patient_phone=$1` sur la table inexistante/non alimentée — cette requête renvoie systématiquement vide, donc le champ « constantes » du briefing Amina transmis au médecin est **toujours `null`** en pratique.

**Frontend** — `public/patient/dashboard.html` : section « Constantes médicales », `POST /patients/constantes` (écriture), `GET /patients/constantes/{phone}` (lecture). `public/medecin/dashboard.html` : `GET /doctors/constantes-patient` (vue médecin).

---

## 6. Score Bolamu (`scoreBolamu.service.js`)

Ce document est propriétaire de cette section — détail complet disponible aussi dans `docs/SCORE_BOLAMU.md` (source vérifiée, mise à jour 2026-07-04).

**Base de données** — tables lues par `calculerScoreBolamu()` :
| Table | Composante | Fenêtre |
|---|---|---|
| `rendez_vous` | Assiduité RDV (30%) | 90 j / 90-180 j (comparaison tendance) |
| `event_registrations` + `elonga_events` (filtre `pillar='activite'`) | Engagement Elonga (25%) | 90 j / 90-180 j |
| `club_members` | Activité club (20%) | 30 j / 30-60 j |
| `zora_ledger` | Régularité Zora (15%) | 30 j / 30-60 j |
| `consultations` | Suivi médical (10%) | 6 mois / 6-12 mois |

**⚠️ Note de cohérence avec §1** : la composante « Assiduité RDV » lit `rendez_vous`, table que ce même document (§1) documente comme jamais peuplée par le flux réel de prise de RDV (qui écrit dans `appointments`). Cette composante du score est donc probablement toujours à 0/vide en pratique pour tous les patients — à vérifier avec `/database-admin`.

**Backend** — formule (`src/services/scoreBolamu.service.js:166-172`) :
```
score = round(rdvScore×0.30 + elongaScore×0.25 + clubScore×0.20 + zoraScore×0.15 + consultationScore×0.10)
```
Chaque composante recalculée sur la période précédente ; tendance `up`/`down`/`stable` si écart > ±5 points. Labels : ≥80 Excellent, ≥60 Très bon, ≥40 Bon, ≥20 En progression, sinon À démarrer. Si patient sans données : `score: null`.

**Endpoint** : `GET /api/v1/patients/score-bienetre` (`authMiddleware`) → `calculerScoreBolamu(req.user.phone)`.

**Frontend** — `public/patient/dashboard.html` : anneau SVG (`stroke-dasharray=188.5`, `offset = 188.5 × (1 − min(1, score/100))`), icône cœur, tendance ↑/↓/=, personnage 3D flottant (`garcons3Dbleu.png`). État `—`/« Données insuffisantes » si `score===null`.

---

## 7. Zora lié aux soins

Points Zora crédités lors d'une consultation/résultat labo (`action_type: 'consultation'`, `'analyse_labo'`) via `awardZora()` (`src/services/zora.service.js`), point d'entrée unique confirmé dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5. Montants et règles complètes (catégories, plafonds, paliers) : voir **`ARCHITECTURE_ZORA_BOLAMU.md`** — non redocumenté ici, seul point d'entrée mentionné : consultation clôturée (50 Zora), résultats labo publiés.

---

## 8. Notifications liées aux soins

Templates WAHA déclenchés par ce domaine (détail complet, params, messages exacts : voir **`docs/ARCHITECTURE_NOTIFICATIONS.md`** Boucle 4 et Boucle 5) :
- `bolamu_rdv_confirme` (RDV créé), `bolamu_rdv_nouveau` (médecin), `bolamu_rdv_rappel` (cron J-1)
- `bolamu_consultation_terminee` (clôture consultation)
- `bolamu_ordonnance_prete` / `bolamu_prescription_dispo` (ordonnance créée)
- `bolamu_ordonnance_dispensee` (patient) / `bolamu_ordonnance_dispensee_medecin` (médecin) / `bolamu_nouvelle_ordonnance_pharmacie` (pharmacie)
- `bolamu_analyse_demandee` (labo), `bolamu_labo_resultats` / `bolamu_resultats_disponibles` (résultats prêts)
- `bolamu_urgence_dossier_consulte` (scan QR urgence public)

Le service d'envoi réel est `sendAutoMessage()` dans **`src/services/whatsapp.service.js`** (appelle WAHA `/api/sendText`) — **note** : `docs/ARCHITECTURE_NOTIFICATIONS.md` référence par erreur un fichier `whatsapp-web.service.js` qui n'existe pas dans le dépôt ; le fichier réel actif est `whatsapp.service.js` (le fichier `whatsapp.service.META.DEPRECATED.js` est l'ancienne version Meta, non utilisée).

---

## 9. Points de vigilance et dette technique

1. **Deux systèmes d'ordonnance déconnectés** (§3) : `prescriptions` (écrite par personne côté médecin actif, dispensée par la pharmacie) vs `ordonnances` (écrite par le médecin actif, jamais dispensée par la pharmacie active). C'est l'anomalie la plus impactante du parcours de soins — à trancher en priorité par `/tech-lead` : soit brancher le dashboard pharmacie sur `/ordonnances/:id/dispense`, soit brancher le dashboard médecin sur `POST /prescriptions/create`.
2. **`rendez_vous` jamais peuplée par le code applicatif** (§1) — utilisée pourtant par `consultation.service.js` (UPDATE sans effet) et par le Score Bolamu (composante Assiduité RDV probablement toujours vide).
3. **Trois/quatre journaux d'accès BHP non unifiés** : `dossier_access_log`, `health_record_access_log` (BHP officiel, `bhpAccess.js`), `dmn_access_log` (DMN, service distinct) — aucun frontend ne consomme `/health-records` ni `/consent` directement (le futur remplaçant semble être `/dmn/*`, qui a lui-même sa propre gestion de consentement/log séparée du module BHP).
4. **`constantes_medicales` table fantôme** (§5) — jamais alimentée, rend le briefing IA Amina toujours incomplet sur ce point (`constantes: null` systématique).
5. **Deux logiques de « renouvellement d'ordonnance » incohérentes** (§3) — l'une opère sur `lab_prescriptions`, l'autre sur `prescriptions`.
6. **Trois implémentations parallèles de file d'attente secrétariat** (§1) : `queue_entries`, `file_attente`, `agenda_blocks`/`agenda_blocs`.
7. **Deux implémentations du contrôleur labo avec statuts incompatibles** (§4) : `en_attente`/`traite` vs `pending`/`completed`.
8. **`consultation_reports` et `getPatientTimeline()` probablement morts** (§2) : seule vue qui unifie tous les systèmes de soins en lecture, mais aucun frontend ne l'appelle.
9. **Aucun polling temps réel de file d'attente** sur les 5 dashboards audités (patient, médecin, pharmacie, secrétaire, laboratoire) — la queue n'est rafraîchie que par action utilisateur, malgré la présence de `setInterval` pour d'autres données (stats/RDV) sur médecin et secrétaire.
10. **`public/secretaire/dashboard_v2.html`** est un prototype de test (guard désactivé en dur dans le code, endpoints non confirmés existants) — à ne pas confondre avec `dashboard.html`, seul fichier actif en prod.
11. **Carnet de vaccination (§4bis) : deux journaux BHP distincts pour un même carnet** — écriture médecin loguée dans `health_record_access_log`, écriture pharmacie/laboratoire dans `dmn_access_log` (cohérent avec le mécanisme déjà utilisé par chaque table source, voir point 3 ci-dessus, mais un audit complet du carnet vaccinal d'un patient nécessite d'interroger deux tables distinctes, pas une vue unifiée).
