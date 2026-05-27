# BOLAMU — Smart Flow Grands Comptes

## Principe CDR
- **SSP gratuit** : Les médicaments et actes du catalogue SSP OMS 2023 sont couverts par la CDR (Caisse de Dépôt et Réglementation)
- **Hors catalogue prix plein** : Tout acte ou médicament hors catalogue est facturé au prix plein du prestataire
- **Traçabilité complète** : Toutes les transactions hors catalogue sont tracées dans Bolamu pour les grands comptes

## Schéma des 3 tables

### 1. hors_catalogue_transactions
Table principale des transactions hors catalogue
- `patient_phone` : Référence vers users(phone)
- `prestataire_phone` : Référence vers users(phone)
- `prestataire_type` : ENUM (pharmacie, laboratoire, doctor)
- `libelle` : Description de l'acte ou médicament
- `prix_plein` : Prix plein facturé (NUMERIC(12,2), > 0)
- `company_contract_id` : Référence vers company_contracts (NULL si patient individuel)
- `statut` : ENUM (notifie, acquitte, retenue_salaire, prise_en_charge)
  - `notifie` : Patient informé, montant à régler au prestataire
  - `acquitte` : Patient a payé cash
  - `retenue_salaire` : Brasco paie, retenue générée sur salaire
  - `prise_en_charge` : Brasco assume sans retenue
- `ssp_reference_id` : Référence vers ordonnance/consultation SSP liée (si mixte)
- `ssp_reference_type` : ENUM (prescription, appointment, lab)
- `notifie_patient_at` : Timestamp notification patient
- `notifie_rh_at` : Timestamp notification RH (si grand compte)
- `acquitte_at` : Timestamp paiement cash

### 2. medicaments_catalogue
Catalogue de tagging médicaments SSP vs hors catalogue
- `nom_generique` : Nom générique du médicament
- `nom_commercial` : Nom commercial (optionnel)
- `categorie` : Catégorie thérapeutique (antipaludique, antibiotique, chronique, maternel, etc.)
- `is_ssp` : BOOLEAN (true = SSP gratuit, false = hors catalogue)
- `source_oms` : Source (OMS_2023 par défaut)
- `is_active` : BOOLEAN (true par défaut)

### 3. export_paie_mensuel
Exports paie mensuels pour grands comptes
- `company_contract_id` : Référence vers company_contracts
- `mois` : Format YYYY-MM
- `nb_employes_actifs` : Nombre d'employés actifs
- `nb_actes_ssp` : Toujours 0 (couvert CDR)
- `montant_ssp` : Toujours 0 (couvert CDR)
- `nb_actes_hors_catalogue` : Nombre d'actes hors catalogue
- `montant_hors_catalogue` : Montant total hors catalogue
- `details_json` : JSONB [{employee_phone, libelle, montant, statut}]
- `statut` : ENUM (brouillon, finalise, exporte)
- `exporte_at` : Timestamp export
- `exporte_par` : Référence vers users(phone)

## Règle tagging
**TOUT enregistrement de médicament ou acte doit d'abord vérifier isSSP()**
- Appeler `isSSP(nom_medicament)` avant toute transaction
- Si `is_ssp = true` : Ne PAS enregistrer dans hors_catalogue_transactions (gratuit CDR)
- Si `is_ssp = false` : Enregistrer dans hors_catalogue_transactions avec prix plein

## 3 modes grand compte

### 1. Bon sur salaire (retenue_salaire)
- Brasco paie le prestataire
- Retenue générée sur le salaire de l'employé
- RH notifié pour gestion paie

### 2. Avance (acquitte)
- Patient paie cash au prestataire
- Remboursé par Brasco via avance sur salaire
- Statut passe de `notifie` → `acquitte`

### 3. Prise en charge (prise_en_charge)
- Brasco assume le coût sans retenue
- Pour les cas exceptionnels ou avantages sociaux
- RH notifié mais sans impact paie

## Routes complètes

### Prestataires (pharmacie, labo, médecin)
- `POST /api/v1/smartflow/hors-catalogue` → enregistrerHorsCatalogue
- `GET /api/v1/smartflow/medicaments/check?nom=XXX` → isSSP
- `GET /api/v1/smartflow/stats/moi?mois=YYYY-MM` → getStatsPartenaire

### RH Grand Compte
- `GET /api/v1/smartflow/rh/dashboard` → Vue temps réel employés + SSP + hors catalogue
- `GET /api/v1/smartflow/rh/export/:mois` → genererExportPaie → téléchargement CSV

### Admin
- `GET /api/v1/admin/smartflow/stats?mois=YYYY-MM` → getStatsAdmin
- `GET /api/v1/admin/smartflow/partenaire/:phone?mois=YYYY-MM` → Stats détaillées partenaire

## notify() obligatoire
**Toute transaction hors catalogue doit déclencher :**
1. Notification patient (SMS + Push) : "Acte hors catalogue : [libelle] — [prix] FCFA à régler directement au prestataire"
2. Notification RH (si grand compte) : SMS + Push vers company_rh du contrat
3. Audit log : INSERT dans audit_log avec event_type `hors_catalogue.created`

## Export paie
- Format CSV standard
- Colonnes : Matricule, Nom, Telephone, Nb_Actes, Montant_Total, Statut
- Groupé par employé
- Prêt à importer dans système paie (SAGE, etc.)

## Service smartflow.service.js
Fonctions disponibles :
- `isSSP(nom_medicament)` : Vérifie si médicament est SSP
- `enregistrerHorsCatalogue(data)` : Enregistre transaction hors catalogue avec notifications
- `getStatsPartenaire(prestataire_phone, mois)` : Stats prestataire
- `genererExportPaie(company_contract_id, mois)` : Génère CSV export paie
- `getStatsAdmin(mois?)` : Stats globales admin

## Middleware de sécurité
- `prestataireOnly` : Restreint aux roles (pharmacie, laboratoire, doctor)
- `rhOnly` : Restreint au role company_rh
- `adminOnly` : Restreint au role admin

## Seed médicaments SSP
52 médicaments SSP OMS 2023 peuplés dans medicaments_catalogue :
- Antipaludiques (4)
- Antibiotiques (9)
- Antiparasitaires (6)
- Analgésiques (5)
- Chroniques HTA/Diabète (9)
- Respiratoire (3)
- Santé maternelle (9)
- Dermatologie/ORL (5)
- Santé mentale/Neurologie (4)

## Index performance
- `idx_hors_cat_patient` : sur patient_phone
- `idx_hors_cat_prestataire` : sur prestataire_phone
- `idx_hors_cat_contract` : sur company_contract_id
- `idx_hors_cat_statut` : sur statut
- `idx_hors_cat_created` : sur created_at DESC
- `idx_medicaments_ssp` : sur (is_ssp, is_active)
- `idx_export_paie_contract` : sur (company_contract_id, mois)
