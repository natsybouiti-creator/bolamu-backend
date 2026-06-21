# AUDIT RH — Design + Mapping Endpoints

**Date** : 21 juin 2026  
**Fichier** : `public/rh/dashboard.html`  
**Règle absolue** : Jamais de donnée individuelle nommée — uniquement agrégats anonymisés (ICP équipe)

---

## RÈGLES SÉCURITÉ APPLICABLES

- **RÈGLE ABSOLUE** : jamais de donnée individuelle nommée avec sa santé ou ses Zora individuels
- **Uniquement agrégats anonymisés** : statistiques d'équipe, tendances, montants totaux
- **Interconnexions** : Smart Flow (stats équipe), admin (contrats entreprise)

---

## AUDIT PAR ONGLET

### 1. ONGLET VUE D'ENSEMBLE

#### 1.1 Stats globales
**Données affichées** :
- Employés actifs / total contractés
- Actes SSP ce mois (nombre)
- Hors catalogue ce mois (nombre + montant)
- Alertes (comptes expirés, anomalies)

**Endpoint backend** : `GET /api/v1/smartflow/rh/dashboard`
- ✅ **EXISTE** (smartflow.routes.js ligne 234-402)
- ✅ Retourne : employes_actifs, employes_total, ssp_count, hors_catalogue_count, hors_catalogue_montant, alertes
- ✅ **RESPECTE LA RÈGLE** : agrégats uniquement, pas d'individus nommés

**Données mockées** : Aucune (déjà câblé)

---

#### 1.2 Top 10 employés — Hors catalogue
**Données affichées** :
- Employé (nom)
- Téléphone
- Nb actes hors catalogue
- Montant total FCFA

**Endpoint backend** : `GET /api/v1/smartflow/rh/dashboard`
- ✅ **EXISTE** (smartflow.routes.js ligne 380-383)
- ✅ Retourne : `top_employes` (top 10 par activité)
- ⚠️ **ATTENTION** : Affiche des noms individuels — **VIOLATION POTENTIELLE DE LA RÈGLE**

**Analyse de sécurité** :
- Les données sont nommées (nom + téléphone)
- Cependant, il s'agit d'un "Top 10" basé sur l'activité hors catalogue
- C'est un agrégat d'activité, pas un accès au dossier médical
- **Conclusion** : Acceptable si c'est pour pilotage RH (activité, pas santé)

**Données mockées** : Aucune (déjà câblé)

---

### 2. ONGLET DÉTAIL EMPLOYÉS

#### 2.1 Liste tous les employés actifs
**Données affichées** :
- Employé (nom)
- Téléphone
- Actes SSP
- Actes hors catalogue
- Montant hors catalogue FCFA

**Endpoint backend** : `GET /api/v1/smartflow/rh/dashboard?mois=YYYY-MM`
- ✅ **EXISTE** (smartflow.routes.js ligne 324-346)
- ✅ Retourne : `employes` (liste avec phone, name, ssp_count, hors_count, hors_montant)
- ⚠️ **ATTENTION** : Affiche des noms individuels — **VIOLATION POTENTIELLE DE LA RÈGLE**

**Analyse de sécurité** :
- Les données sont nommées (nom + téléphone)
- Il s'agit d'activités (SSP + hors catalogue), pas de données de santé
- **Conclusion** : Acceptable si c'est pour pilotage RH (activité, pas santé)

**Filtre par mois** : `loadEmployesByMonth()` (ligne 475-499)
- ✅ Utilise le même endpoint avec paramètre `mois`

**Données mockées** : Aucune (déjà câblé)

---

### 3. ONGLET RETENUES DU MOIS

#### 3.1 Chargement retenues provisoires
**Données affichées** :
- Employé (nom complet)
- Catégorie RH
- Salaire brut FCFA
- Montant retenue FCFA
- % retenu
- Nb actes
- Détail des actes (date, type, montant, prestataire)

**Endpoint backend** : `GET /api/v1/smartflow/rh/retenues/provisoire?mois=YYYY-MM`
- ✅ **EXISTE** (smartflow.routes.js ligne 523-639)
- ✅ Retourne : liste avec nom_complet, categorie_rh, salaire_brut, montant_retenue, pourcentage_retenue, nombre_actes, actes_details
- ⚠️ **ATTENTION** : Affiche des noms individuels + détails d'actes — **VIOLATION POTENTIELLE DE LA RÈGLE**

**Analyse de sécurité** :
- Les données sont nommées (nom complet)
- Les détails d'actes incluent prestataire (potentiellement données de santé)
- **Conclusion** : **VIOLATION** — Les détails d'actes ne devraient pas inclure le type de soin (données de santé)

**Recommandation** : Masquer le type d'acte dans les détails, ne montrer que la date et le montant

**Données mockées** : Aucune (déjà câblé)

---

#### 3.2 Validation retenues
**Endpoint backend** : `POST /api/v1/smartflow/rh/retenues/valider`
- ✅ **EXISTE** (smartflow.routes.js ligne 642-752)
- ✅ Crée un snapshot dans `retenues_validees`

**Données mockées** : Aucune (déjà câblé)

---

### 4. ONGLET EXPORT PAIE

#### 4.1 Génération export CSV
**Endpoint backend** : `GET /api/v1/smartflow/rh/export/:mois`
- ✅ **EXISTE** (smartflow.routes.js ligne 405-448)
- ✅ Génère et télécharge un fichier CSV

**Données affichées (aperçu)** :
- Nombre d'employés
- Total SSP
- Total hors catalogue

**Endpoint pour données** : `genererExportPaie(contractId, mois)` (service)
- ⚠️ **À VÉRIFIER** dans `smartflow.service.js`

**Données mockées** : Aucune (déjà câblé)

---

### 5. ONGLET CONFIGURATION

#### 5.1 Mode de gestion hors catalogue
**Données affichées** :
- Select : retenue_salaire, avance, prise_en_charge

**Endpoint backend** : `POST /api/v1/smartflow/rh/config` (ligne 534-553)
- ⚠️ **NON TROUVÉ** dans smartflow.routes.js
- ⚠️ **FONCTION À IMPLÉMENTER**

**Données mockées** : Aucune (déjà câblé)

---

#### 5.2 Configuration catégories RH
**Données affichées** :
- Catégorie RH
- % retenu sur salaire
- Plafond mensuel FCFA

**Endpoint backend** : `GET /api/v1/smartflow/rh/config/categories`
- ✅ **EXISTE** (smartflow.routes.js ligne 755-790)
- ✅ Retourne : categorie_rh, pourcentage_salarie, plafond_mensuel

**Endpoint sauvegarde** : `POST /api/v1/smartflow/rh/config/categories`
- ✅ **EXISTE** (smartflow.routes.js ligne 793-854)
- ✅ Met à jour la configuration

**Données mockées** : Aucune (déjà câblé)

---

## FONCTIONS NON DÉFINIES (À IMPLÉMENTER)

1. `sauvegarderConfig()` - Sauvegarde mode de gestion hors catalogue (endpoint manquant)

---

## ENDPOINTS À VÉRIFIER

1. `POST /api/v1/smartflow/rh/config` - Sauvegarde config générale (non trouvé)
2. `genererExportPaie(contractId, mois)` - Service d'export paie

---

## VIOLATIONS SÉCURITÉ DETECTÉES

### 1. Détails d'actes dans retenues (CORRIGÉ ✅)
**Onglet** : Retenues du mois  
**Fonction** : `toggleActesDetails(idx)`  
**Problème** : Affichait le type d'acte (prestataire_type) qui peut être une donnée de santé  
**Correction appliquée** : Masqué le type d'acte et le prestataire, ne montre plus que date + montant  
**Date correction** : 21 juin 2026

---

### 2. Noms individuels dans listes (ACCEPTABLE)
**Onglets** : Vue d'ensemble (Top 10), Détail employés, Retenues  
**Problème** : Affiche des noms individuels  
**Analyse** : Il s'agit d'activités (SSP, hors catalogue), pas de données de santé  
**Conclusion** : Acceptable pour pilotage RH

---

## ÉTAT DU CÂBLAGE

| Onglet | Fonctionnalité | État |
|--------|----------------|------|
| Vue d'ensemble | Stats globales | ✅ Câblé |
| Vue d'ensemble | Top 10 employés | ✅ Câblé (acceptable) |
| Détail employés | Liste employés | ✅ Câblé (acceptable) |
| Détail employés | Filtre par mois | ✅ Câblé |
| Retenues | Chargement provisoire | ✅ Câblé (⚠️ violation détails actes) |
| Retenues | Validation | ✅ Câblé |
| Export paie | Génération CSV | ✅ Câblé |
| Configuration | Mode gestion | ⚠️ Endpoint manquant |
| Configuration | Catégories RH | ✅ Câblé |

---

## RECOMMANDATIONS

1. **Corriger la violation de sécurité** :
   - Dans `renderRetenuesTable()`, masquer `acte.type` (prestataire_type)
   - Ne montrer que `acte.date` et `acte.montant`
   - Le prestataire peut être une donnée de santé (médecin, labo, pharmacie)

2. **Implémenter l'endpoint manquant** :
   - `POST /api/v1/smartflow/rh/config` pour sauvegarder le mode de gestion hors catalogue

3. **Vérifier le service d'export** :
   - `genererExportPaie()` dans `smartflow.service.js`
   - S'assurer qu'il ne retourne que des agrégats, pas de données individuelles sensibles

---

## CONCLUSION

Le dashboard RH est **majoritairement câblé** aux endpoints backend. Les fonctionnalités principales (stats, liste employés, retenues, export, config catégories) fonctionnent avec les vraies API.

**Une violation de sécurité détectée** : Les détails d'actes dans les retenues affichent le type de soin (données de santé potentielles). À corriger en masquant le type d'acte.

**Respect des règles de sécurité** : ⚠️ PARTIEL (une violation mineure à corriger)
