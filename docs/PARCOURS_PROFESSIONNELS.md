# PARCOURS PROFESSIONNELS — Bolamu

> Pendant professionnel du `CATALOGUE_SYSTEMES_PARCOURS.md` (qui couvre le patient).
> Pour chaque rôle : sa journée type, ses tables, ses points de contrôle, et les
> relais qu'il échange avec les autres rôles. Double regard : **ingénieur** (tables,
> contrôles, contraintes) et **utilisateur** (ce que le professionnel vit à l'écran).
>
> Deux familles de rôles :
> – **Chaîne de soin** (séquentielle, le patient circule) : secrétariat → médecin →
>   pharmacie / laboratoire.
> – **Transverses** (sur d'autres objets) : admin (supervision), RH (entreprise
>   anonymisée), agence (acquisition).

---

## R1 — Secrétariat (l'aiguilleur)

- **Mission.** Accueil, prise et gestion des RDV, file d'attente, orientation du patient.
- **Journée type.** Ouvrir l'agenda du jour → voir la file d'attente → confirmer /
  reprogrammer des RDV → traiter les pré-RDV → orienter le patient vers le bon médecin →
  gérer les litiges de premier niveau.
- **Tables.** `appointments`, `time_slots`, `doctor_availabilities`, `queue_entries`,
  `file_attente`, `agenda_blocks`/`agenda_blocs` (⚠ doublon à clarifier),
  `pre_rdv_formulaires`, `appointment_symptoms`, `secretaires`, `conflicts`.
- **Points de contrôle.** Validation de présence du patient (QR check-in), états du RDV
  (machine à états), file.
- **Relais.** Reçoit la demande de RDV du **patient** → alimente l'agenda du **médecin**
  → notifie le patient.
- **Vue utilisateur.** « Je vois qui arrive, je place les RDV, j'oriente — sans
  chevauchement. »
- **DOC / CODE / TEST.** Clarifier le doublon agenda ; vérifier propagation
  RDV→agenda médecin + notification ; tester la file et les états.

---

## R2 — Médecin (+ Amina)

- **Mission.** Consultations, tenue du dossier, prescriptions, demandes d'analyses.
- **Journée type.** Voir ses RDV du jour → ouvrir le dossier patient (sous
  consentement) → **briefing Amina** → consulter → rédiger le compte-rendu (SOAP) →
  **prescrire** et/ou **demander des analyses** → valider.
- **Tables.** `doctors`, `doctor_availabilities`, `appointments`, `health_records`,
  `patient_consents`, `consultation_reports`, `prescriptions`, `lab_prescriptions`,
  `ai_consult_sessions`, `doctor_payouts`.
- **Points de contrôle.** **Consentement** avant lecture du dossier ; **code de
  session** pour la téléconsultation (Jitsi) ; **Amina assiste, ne décide jamais** (le
  médecin valide chaque suggestion).
- **Relais.** Reçoit le RDV du **secrétariat** → envoie l'ordonnance à la **pharmacie**,
  les analyses au **labo** → notifie le **patient** → écrit au **dossier partagé**.
- **Vue utilisateur.** « Mon agenda est prêt, le dossier s'ouvre, Amina m'a préparé un
  brief, je prescris en deux clics. »
- **DOC / CODE / TEST.** Vérifier gating consentement à chaque ouverture ; câbler
  prescription/analyses + notifications ; tester Amina (suggestion → validation humaine).

---

## R3 — Pharmacie (la délivrance)

- **Mission.** Délivrer les ordonnances, gérer le stock, les transactions tiers-payant.
- **Journée type.** Voir les ordonnances entrantes (de sa zone) → **vérifier l'identité
  du patient (QR de retrait)** → délivrer (changement de statut) → mettre à jour le
  stock → enregistrer la transaction tiers-payant.
- **Tables.** `pharmacies`, `prescriptions`, `catalogue_pharmacie`,
  `medicaments_catalogue`, `hors_catalogue_transactions`, `transactions_tiers_payant`,
  `partner_payouts`.
- **Points de contrôle.** **QR de retrait** (anti-fraude : la bonne personne retire la
  bonne ordonnance), idempotence des transactions, statut de délivrance.
- **Relais.** Reçoit l'ordonnance du **médecin** → confirme au **patient** → reversement
  mensuel via la **finance/admin** (12,5 % indexé sur les abonnés de la zone).
- **Vue utilisateur.** « Je vois l'ordonnance, je scanne le patient, je délivre, c'est
  tracé. »
- **DOC / CODE / TEST.** Câbler la file d'ordonnances filtrée par zone + le QR de
  retrait ; tester délivrance + idempotence transaction.

---

## R4 — Laboratoire (l'analyse)

- **Mission.** Réaliser les analyses demandées, déposer les résultats.
- **Journée type.** Voir les demandes (`lab_prescriptions`) → **check-in patient (QR)**
  → réaliser → **déposer les résultats** → notifier médecin + patient.
- **Tables.** `laboratories`, `lab_prescriptions` (nom correct, pas `lab_orders`),
  `lab_results`, `partner_payouts`.
- **Points de contrôle.** **QR de présence**, dépôt de résultat traçable, consentement
  pour l'écriture au dossier.
- **Relais.** Reçoit la demande du **médecin** → dépose au **dossier** → notifie
  **patient** et **médecin**.
- **Vue utilisateur.** « Je vois les demandes, je scanne le patient, je dépose le
  résultat, tout le monde est prévenu. »
- **DOC / CODE / TEST.** Câbler dépôt résultat + notifications + visibilité
  patient/médecin ; tester la traçabilité.

---

## R5 — RH (SmartFlow, frontière d'anonymisation)

- **Mission.** Piloter le bien-être agrégé des employés d'une entreprise cliente.
- **Journée type.** Consulter le tableau de bord **agrégé** (ICP, participation,
  tendances) → suivre l'évolution → gérer contrats et exports paie.
- **Tables.** `companies`, `company_employees`, `company_contracts`,
  `config_categories_rh`, `export_paie_mensuel`, `retenues_validees`.
- **Points de contrôle.** **Anonymisation dure** : jamais d'employé nommé avec sa
  santé ou ses Zora individuels ; uniquement des agrégats.
- **Relais.** Consomme des **agrégats anonymisés** issus du système (aucun lien direct
  avec les dossiers individuels). Données encadrées par clause contractuelle de partage.
- **Vue utilisateur.** « Je vois la santé globale de mes équipes et le ROI SmartFlow,
  pas la vie privée des gens. »
- **DOC / CODE / TEST.** Auditer **chaque** endpoint RH contre toute fuite d'individu ;
  tester que seuls des agrégats sortent.

---

## R6 — Agent Bolamu (inscription assistée, agence & terrain)

- **Mission.** L'agent, en agence ou sur le terrain, **inscrit les adhérents** : des
  particuliers (saisie de toutes les infos requises + photo) et des **entreprises en
  mode groupé** (enrôlement collectif des employés). C'est l'outil d'acquisition
  front-line de Bolamu.
- **Réalisation clé.** C'est le **jumeau assisté de S1** : la même porte d'entrée que
  l'auto-inscription du patient, mais opérée par un agent — même backend (compte, OTP,
  photo, CGU), avec en plus l'**enrôlement groupé** côté entreprise.
- **Journée type.** Accueillir un particulier → saisir ses infos + photo → créer le
  compte (et ses bénéficiaires familiaux) ; OU enrôler une entreprise → saisir/importer
  ses employés en lot → rattacher au contrat B2B.
- **Tables.** `users` (`created_by`, `member_code`, `payeur_principal_id`),
  `beneficiaires_familiaux`, `subscription_members`, `subscriptions`, `companies`,
  `company_employees`, `company_contracts`, `otp_codes`/`otps`. (Flux exact —
  individuel vs groupé — à confirmer sur `public/agence/dashboard.html` + routes
  register/agent.)
- **Points de contrôle.** **Photo + identité** (anti-fraude), mandat de l'agent,
  `member_code`, rattachement payeur/famille ou contrat entreprise.
- **Relais.** Alimente directement **S1 (inscription)**, **N8 (famille)** et **N10
  (entreprise)** ; commissions suivies via **admin/finance**.
- **Vue utilisateur (agent).** « Sur le terrain, j'inscris une personne ou toute une
  entreprise d'un coup, photo comprise, et le compte est actif. »
- **DOC / CODE / TEST.** Confirmer le flux exact sur le fichier ; câbler création compte
  + photo + enrôlement lot entreprise ; tester qu'un compte créé par agent est
  réellement persistant et utilisable.

---

## R7 — Admin (pilotage, le toit de l'usine)

- **Mission.** Supervision, arbitrage, configuration, modération, anti-fraude.
- **Journée type.** Tableaux de bord globaux → lire l'audit → traiter les signaux de
  fraude → bannir si besoin → configurer les taux → valider les reversements partenaires
  → surveiller les crons.
- **Tables.** `admins`, `audit_log`, `fraud_signals`, `platform_config`,
  `partner_conventions`, `partner_payouts`, `partner_zones`, `cron_logs`,
  `migrations_applied`, `conflicts`, `users` (`banned`, `ban_reason`).
- **Points de contrôle.** Accès total **mais journalisé** ; **tous les taux dans
  `platform_config`**, jamais en dur ; idempotence des reversements.
- **Relais.** Observe **tous les nerfs** ; arbitre les **litiges** ; valide les
  **reversements** vers cliniques/pharmacies/labos.
- **Vue utilisateur.** « Je vois tout, j'arbitre, je configure, je sanctionne les abus. »
- **DOC / CODE / TEST.** Dashboard admin **à intégrer au plan des chantiers** ; auditer
  la couverture réelle de l'`audit_log` ; tester la config centralisée.

---

## Synthèse des relais (qui passe la main à qui)

- Patient → **Secrétariat** (demande RDV) → **Médecin** (consultation).
- Médecin → **Pharmacie** (ordonnance) et/ou **Laboratoire** (analyses) → retour
  **patient** (notification + dossier).
- Pharmacie / Labo / Clinique → **Admin/finance** (reversements mensuels).
- Agence → **Inscription** (nouveaux adhérents) → Admin (commissions).
- RH ← **agrégats anonymisés** uniquement (aucune entrée dans la chaîne de soin).
- Admin ↔ **tous** (supervision, arbitrage, configuration).

## Invariants professionnels (à tester partout)

1. **QR / code de session** : chaque validation de présence, retrait ou acte passe par
   un jeton vérifiable (`qr_tokens`, `elonga_checkin_tokens`, codes de session) — jamais
   une validation « sur parole ».
2. **Consentement** avant toute lecture de dossier par un rôle autre que le patient,
   avec journalisation.
3. **Anonymisation RH** : aucun endpoint ne renvoie d'individu nommé.
4. **Notification** : chaque relais inter-rôles prévient le destinataire concerné.
5. **Taux & reversements** : toujours depuis `platform_config`, jamais en dur ;
   idempotents.
