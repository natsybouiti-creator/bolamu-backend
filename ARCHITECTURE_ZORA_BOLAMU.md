# ARCHITECTURE_ZORA_BOLAMU.md

> ⚠️ **STATUT DE CE DOCUMENT** : ce document est une **SPÉCIFICATION CIBLE** (vision produit). Le schéma qu'il décrit (`zora_wallets` UUID, `zora_offers`, `zora_campaigns`) ne correspond pas au schéma réel en production. Le schéma réel est documenté dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5 et `ARCHITECTURE_BOLAMU_OVERVIEW.md` §3.3.

**Version 1.1 — Juillet 2026**
**NBA Gestion SARLU — Bolamu Platform**
**Statut : RÉFÉRENCE FONDATRICE — ne pas modifier sans validation PDG**

| Version | Date | Modifications |
|---|---|---|
| 1.0 | Juillet 2026 | Version initiale |
| 1.1 | Juillet 2026 | Ajout : intégration systèmes existants, gestion abonnements suspendus, onboarding partenaire, priorité campagnes, gestion stock concurrent, glossaire, conformité CNPD |

---

## Table des matières

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Acteurs du système](#2-acteurs-du-système)
3. [Flux EARN — Gain de points](#3-flux-earn--gain-de-points)
4. [Flux BURN — Dépense de points](#4-flux-burn--dépense-de-points)
5. [Marketplace — Offres et récompenses](#5-marketplace--offres-et-récompenses)
6. [Tiers Zora — Niveaux et avantages](#6-tiers-zora--niveaux-et-avantages)
7. [Flux digital complet — Bon d'achat et rédemption](#7-flux-digital-complet--bon-dachat-et-rédemption)
8. [Feed social et publication d'offres](#8-feed-social-et-publication-doffres)
9. [Modèle économique](#9-modèle-économique)
10. [Schéma base de données](#10-schéma-base-de-données)
11. [Architecture backend — Routes et controllers](#11-architecture-backend--routes-et-controllers)
12. [Architecture frontend — Dashboards et composants](#12-architecture-frontend--dashboards-et-composants)
13. [Règles métier et anti-fraude](#13-règles-métier-et-anti-fraude)
14. [Notifications et communication](#14-notifications-et-communication)
15. [Administration et configuration](#15-administration-et-configuration)
16. [Roadmap d'implémentation](#16-roadmap-dimplémentation)
17. [Intégration avec les systèmes existants Bolamu](#17-intégration-avec-les-systèmes-existants-bolamu)
18. [Gestion des abonnements inactifs et suspendus](#18-gestion-des-abonnements-inactifs-et-suspendus)
19. [Onboarding et authentification partenaire récompense](#19-onboarding-et-authentification-partenaire-récompense)
20. [Priorité et composition des campagnes bonus](#20-priorité-et-composition-des-campagnes-bonus)
21. [Gestion du stock en concurrence](#21-gestion-du-stock-en-concurrence)
22. [Glossaire](#22-glossaire)
23. [Conformité CNPD — Données personnelles et santé](#23-conformité-cnpd--données-personnelles-et-santé)

---

## 1. Vision et positionnement

### 1.1 Définition

**Bolamu est le système nerveux des programmes de fidélité santé au Congo.**

Les patients gagnent des **Zora Points** en prenant soin de leur santé — consultations médicales, séances bien-être, renouvellements d'abonnement, participation aux événements Elonga. Ils dépensent ces points chez les **partenaires récompenses** (boutiques, pharmacies, restauration, services) qui financent eux-mêmes leurs propres offres, comme tout programme de fidélité classique.

Bolamu fournit le rail technologique. Les partenaires fournissent les récompenses.

### 1.2 Principe fondateur

```
ACTE DE SANTÉ / BIEN-ÊTRE
        ↓
    ZORA POINTS
        ↓
RÉCOMPENSE PARTENAIRE
```

Chaque acte vertueux sur la santé et le bien-être est monétisé en points. Ces points sont échangeables contre de la valeur réelle chez les partenaires. Le circuit ferme une boucle vertueuse : **la santé récompense**.

### 1.3 Ce que Zora n'est pas

- Zora n'est **pas une cryptomonnaie** et n'a aucune valeur en dehors de l'écosystème Bolamu.
- Zora ne peut **pas être échangé contre de l'argent**.
- Zora ne peut **pas être transféré** entre patients.
- La valeur interne d'un Zora Point est fixée à **1.5 FCFA** — ce chiffre n'est jamais communiqué publiquement.

---

## 2. Acteurs du système

### 2.1 Le Patient (EARN + BURN)

- **Gagne** des Zora Points via ses actes de santé et bien-être.
- **Consulte** son solde et son historique dans son dashboard.
- **Génère** des bons d'achat ou réclame des réductions.
- **Découvre** les offres dans le Feed et la Marketplace.
- Son niveau de tier influence son multiplicateur de gain et l'accès à certaines récompenses.

### 2.2 Le Partenaire Santé (DÉCLENCHEUR EARN)

Catégories : clinique, pharmacie, laboratoire.

- **Déclenche** des Zora Points à chaque acte de soins validé.
- **Ne finance pas** les récompenses — il est uniquement émetteur de points.
- Peut aussi publier des offres promotionnelles dans la Marketplace (ex : réduction sur un bilan sanguin).
- Chaque acte est horodaté et associé à un `proof_reference` unique pour idempotence.

### 2.3 L'Animateur (DÉCLENCHEUR EARN)

- **Déclenche** des Zora Points à chaque participation validée à un événement Elonga.
- Contrôle les présences via son dashboard (scan QR patient ou validation manuelle).
- N'a pas de solde Zora personnel.
- Le déclenchement est conditionné à la présence effective vérifiée.

### 2.4 Le Partenaire Récompense (OFFREUR BURN)

Catégories : boutiques, restaurants, services, pharmacies partenaires, épiceries premium, etc.

- **Finance ses propres récompenses** — bons d'achat, cartes cadeaux, réductions.
- **Publie ses offres** dans la Marketplace via son dashboard.
- **Valide** les bons présentés par les patients via scan QR ou code manuel.
- Définit un budget de récompenses mensuel ou par campagne.
- Reçoit un reporting mensuel de sa consommation de récompenses.

### 2.5 L'Admin Bolamu (CONFIGURATION + SUPERVISION)

- Configure les règles d'earn (points par action, multiplicateurs, plafonds).
- Valide ou rejette les offres soumises par les partenaires.
- Lance des campagnes bonus ponctuelles (ex : "2x points en juillet").
- Peut publier des offres en propre (offres Bolamu directes).
- Surveille les anomalies et fraudes.

---

## 3. Flux EARN — Gain de points

### 3.1 Taxonomie des déclencheurs

Chaque déclencheur appartient à une catégorie. Les catégories ont des plafonds mensuels.

| Code action | Libellé | Déclencheur | Points de base | Plafond mensuel |
|---|---|---|---|---|
| `CONSULT_MEDECIN` | Consultation médicale | Médecin / Secrétaire | 150 pts | 600 pts |
| `ACHAT_PHARMACIE` | Achat pharmacie partenaire | Pharmacie | 50 pts | 300 pts |
| `BILAN_LABO` | Bilan laboratoire | Laboratoire | 100 pts | 200 pts |
| `SEANCE_ELONGA` | Séance activité physique | Animateur | 80 pts | 640 pts |
| `EVENT_ELONGA` | Participation événement Elonga | Animateur | 120 pts | 360 pts |
| `ABONNEMENT_RENOUVELE` | Renouvellement abonnement | Système (cron) | 200 pts | 200 pts |
| `PROFIL_COMPLETE` | Complétion profil (une fois) | Système | 100 pts | 100 pts |
| `PARRAINAGE` | Parrainage validé (filleul actif 30j) | Système | 250 pts | 500 pts |
| `FIDELITE_12MOIS` | 12 mois consécutifs d'abonnement | Système (cron) | 500 pts | 500 pts |

### 3.2 Règle d'idempotence

Chaque déclencheur génère un `proof_reference` unique :

```
{action_type}:{entity_id}:{date_YYYYMMDD}
```

Exemples :
- `CONSULT_MEDECIN:appt_uuid_123:20260704`
- `SEANCE_ELONGA:event_uuid_456:20260704`
- `ACHAT_PHARMACIE:prescription_uuid_789:20260704`

Un `proof_reference` identique ne peut jamais déclencher deux crédits. Contrainte unique en base.

### 3.3 Multiplicateur de tier

Les points de base sont multipliés selon le tier du patient au moment du déclenchement :

| Tier | Multiplicateur |
|---|---|
| Kimia (débutant) | × 1.0 |
| Liboso (confirmé) | × 1.2 |
| Nkembo (avancé) | × 1.5 |
| Elonga (élite) | × 2.0 |

Le multiplicateur est appliqué avant l'écriture en base, **après** vérification du plafond mensuel par catégorie.

### 3.4 Campagnes bonus

L'admin peut créer des campagnes qui superposent un multiplicateur additionnel sur une action et une période :

```json
{
  "campaign_id": "camp_uuid",
  "action_type": "SEANCE_ELONGA",
  "multiplier": 2.0,
  "start_date": "2026-07-01",
  "end_date": "2026-07-31",
  "label": "Juillet Santé — 2x sur séances Elonga"
}
```

Le multiplicateur de campagne se compose avec le multiplicateur de tier : `points_base × tier_mult × campaign_mult`.

### 3.5 Types de preuve (proof_type)

| Type | Description | Accepté |
|---|---|---|
| `system_event` | Déclenché automatiquement par le système | Oui |
| `ground_truth` | Validé par un acteur humain (médecin, animateur, pharmacie) | Oui |
| `device_measured` | Mesuré par un capteur (futur — app mobile) | Oui (avec validation) |
| `device_declared` | Auto-déclaré par le patient | **Jamais accepté** |

---

## 4. Flux BURN — Dépense de points

> **NOTE CONSOLIDATION VOUCHERS** — zora_vouchers et zora-voucher.service.js sont dépréciés. Système canonique : partner_vouchers + voucher.service.js (seul pipeline opérationnel de bout en bout).

> **DÉCISION RÉGLEMENTAIRE DÉFINITIVE** — Le retrait cash direct via MoMo est exclu du système Zora. Raison : absence d'agrément BEAC (interdiction de détention de fonds). Les seuls mécanismes de burn autorisés sont `VOUCHER` / `GIFT_CARD` / `DISCOUNT` / `OFFER_ACCESS` (section 4.1 ci-dessous). Cette décision ne peut pas être annulée sans obtention préalable de l'agrément BEAC.

### 4.1 Types de rédemption

| Type | Libellé | Mécanisme |
|---|---|---|
| `VOUCHER` | Bon d'achat | Patient génère un QR code, présente chez partenaire, partenaire scanne |
| `GIFT_CARD` | Carte cadeau | Bon à valeur fixe prédéfinie, même flux QR |
| `DISCOUNT` | Réduction directe | Appliquée lors d'un acte partenaire (couche sur la facture) |
| `OFFER_ACCESS` | Accès à une offre exclusive | Débloque une offre réservée aux détenteurs Zora |

### 4.2 Seuils minimaux de rédemption

- Minimum de points pour générer un bon : **200 points**
- Les points ne peuvent être utilisés qu'en multiples de 50 (arrondi inférieur automatique)
- Un bon annulé re-crédite les points dans les 24h

### 4.3 Statuts d'un bon

```
GENERATED → PRESENTED → VALIDATED → USED
                ↓
             EXPIRED (48h sans validation)
                ↓
             CANCELLED (annulé par patient ou admin)
```

### 4.4 Expiration des points

- Fenêtre glissante de **12 mois** : les points non utilisés dans les 12 mois suivant leur gain expirent.
- Un acte de santé ou bien-être dans la fenêtre **réinitialise l'horloge** sur les points en question (clause d'activité).
- L'expiration est traitée par un cron quotidien à 02h00 (heure de Brazzaville, UTC+1).
- Le patient est notifié par WhatsApp 30 jours, 7 jours et 1 jour avant expiration.

---

## 5. Marketplace — Offres et récompenses

### 5.1 Cycle de vie d'une offre

```
DRAFT (partenaire) → SUBMITTED → REVIEW (admin) → APPROVED → ACTIVE
                                        ↓
                                     REJECTED (avec motif)
                                        ↓
                                   ARCHIVED (fin de campagne)
```

### 5.2 Structure d'une offre

```json
{
  "offer_id": "uuid",
  "partner_id": "uuid",
  "partner_type": "reward_partner | health_partner",
  "title": "30% sur tous les produits cosmétiques",
  "description": "...",
  "type": "DISCOUNT | VOUCHER | GIFT_CARD | OFFER_ACCESS",
  "zora_cost": 500,
  "value_fcfa": 2000,
  "discount_percent": 30,
  "stock": 100,
  "stock_remaining": 87,
  "valid_from": "2026-07-01",
  "valid_until": "2026-07-31",
  "min_tier": "KIMIA",
  "city": "Brazzaville | Pointe-Noire | all",
  "status": "ACTIVE",
  "feed_published": true,
  "image_url": "...",
  "budget_fcfa": 200000,
  "budget_consumed_fcfa": 26000
}
```

### 5.3 Budget partenaire

Chaque offre est associée à un budget que le partenaire s'engage à financer. Bolamu track :
- `budget_fcfa` : budget total déclaré
- `budget_consumed_fcfa` : montant consommé en récompenses accordées
- Quand `budget_consumed >= budget_fcfa`, l'offre passe automatiquement en `ARCHIVED`
- Le partenaire reçoit une alerte WhatsApp à 80% de consommation du budget

---

## 6. Tiers Zora — Niveaux et avantages

### 6.1 Calcul du tier

Le tier est calculé sur les **points cumulés des 12 derniers mois glissants** (pas le solde disponible — les points dépensés comptent quand même pour le tier).

| Tier | Nom | Points 12 mois requis | Couleur |
|---|---|---|---|
| 1 | Kimia (Paix) | 0 — 999 | Gris |
| 2 | Liboso (Premier pas) | 1 000 — 2 999 | Vert |
| 3 | Nkembo (Gloire) | 3 000 — 6 999 | Or |
| 4 | Elonga (Excellence) | 7 000+ | Platine |

### 6.2 Recalcul du tier

- Recalcul automatique chaque **1er du mois** à 03h00 (cron).
- Upgrade immédiat si le seuil est franchi en cours de mois.
- Downgrade uniquement au recalcul mensuel (pas de downgrade immédiat).
- En cas d'upgrade : notification WhatsApp + badge dans le Feed social.

### 6.3 Avantages par tier

| Avantage | Kimia | Liboso | Nkembo | Elonga |
|---|---|---|---|---|
| Multiplicateur earn | × 1.0 | × 1.2 | × 1.5 | × 2.0 |
| Accès offres standard | Oui | Oui | Oui | Oui |
| Accès offres Nkembo+ | Non | Non | Oui | Oui |
| Accès offres Elonga exclusif | Non | Non | Non | Oui |
| Alertes offres en avant-première | Non | Non | Oui | Oui |
| Badge profil visible | Non | Oui | Oui | Oui |

---

## 7. Flux digital complet — Bon d'achat et rédemption

### 7.1 Côté Patient (dashboard)

```
1. Patient accède à la Marketplace
2. Sélectionne une offre (VOUCHER ou GIFT_CARD)
3. Clique "Utiliser mes points" → confirmation du coût affiché
4. Système vérifie : solde suffisant + offre active + stock disponible + tier compatible
5. Débit atomique du solde Zora
6. Génération du bon : UUID + QR code + code alphanumérique (fallback)
7. Bon stocké en base avec statut GENERATED
8. Affichage immédiat dans dashboard + section "Mes bons"
9. Notification WhatsApp envoyée avec le code alphanumérique (backup offline)
```

### 7.2 Côté Partenaire (dashboard partenaire)

**Option A — Scan QR (flux principal)**
```
1. Patient présente son QR code (dashboard ou WhatsApp)
2. Partenaire ouvre son dashboard → section "Scanner un bon"
3. Scan QR → appel API /zora/vouchers/:uuid/validate
4. Réponse instantanée : informations du bon + montant de la réduction
5. Partenaire confirme → bon passe en USED
6. Les deux reçoivent une confirmation WhatsApp
```

**Option B — Saisie manuelle (fallback)**
```
1. Patient dicte son code alphanumérique (format : ZORA-XXXXX-XXXXX)
2. Partenaire saisit dans son dashboard → même flux API
```

### 7.3 Gestion des edge cases

| Situation | Comportement |
|---|---|
| Bon expiré (48h) | Refus API + re-crédit automatique dans 24h |
| Réseau coupé côté partenaire | Code alphanumérique noté manuellement, validation différée (max 2h) |
| Patient présente deux fois le même bon | Idempotence : second scan retourne "déjà utilisé" sans erreur |
| Stock épuisé entre génération et validation | Bon honoré quand même (le stock est réservé à la génération) |
| Offre archivée après génération du bon | Bon reste valide jusqu'à son expiration propre |

---

## 8. Feed social et publication d'offres

### 8.1 Intégration Feed

Les offres Marketplace approuvées avec `feed_published = true` apparaissent dans le **Feed tab** du dashboard patient, mélangées aux contenus sociaux (posts, stories, événements Elonga).

Structure d'un post d'offre dans le Feed :

```json
{
  "feed_item_type": "OFFER",
  "offer_id": "uuid",
  "partner_name": "Boutique Mama Ngombo",
  "partner_avatar_url": "...",
  "title": "500 Zora = 3 000 FCFA de réduction",
  "preview_image_url": "...",
  "zora_cost": 500,
  "valid_until": "2026-07-31",
  "city": "Brazzaville",
  "cta_label": "Utiliser mes points",
  "cta_action": "open_offer:{offer_id}"
}
```

### 8.2 Règles d'affichage

- Une offre `min_tier: NKEMBO` est visible par tous mais le bouton CTA affiche "Réservé aux membres Nkembo+" pour les tiers inférieurs — pas de filtre total, pour créer l'aspiration.
- Le filtre ville est appliqué par défaut selon le profil patient (Brazzaville / Pointe-Noire).
- Les offres Elonga exclusif ont un badge visuel distinctif.
- L'ordre d'affichage : offres actives par date de fin croissante (les plus urgentes d'abord).

### 8.3 Notifications Feed pour les offres

| Déclencheur | Canal | Destinataire |
|---|---|---|
| Nouvelle offre publiée (tier compatible) | WhatsApp + in-app | Patients éligibles (par tier + ville) |
| Offre expire dans 48h (patient a assez de points) | WhatsApp | Patient ciblé |
| Upgrade de tier | WhatsApp + badge Feed | Patient |
| Points sur le point d'expirer (30j, 7j, 1j) | WhatsApp | Patient |

---

## 9. Modèle économique

### 9.1 Qui paie quoi

| Acteur | Ce qu'il finance |
|---|---|
| Partenaire récompense | Ses propres récompenses (budget déclaré par offre) |
| Partenaire santé | Rien — il est déclencheur, pas financeur |
| Bolamu | L'infrastructure, le rail technologique, les notifications |
| Patient | Rien — il consomme |

### 9.2 Revenus indirects pour Bolamu

Le système Zora n'est pas une ligne de revenu directe. Il est un **levier de rétention et d'acquisition** :

- Rétention patient : les points incitent à renouveler l'abonnement et à rester actif.
- Acquisition partenaires récompenses : Bolamu leur offre un programme de fidélité clé en main avec une base de patients actifs — argument commercial pour les conventions partenaires.
- Upsell abonnement : les patients en tier Kimia qui voient les offres Nkembo+ sont incités à monter en activité (plus de soins → plus de points → meilleur tier).

### 9.3 Valeur interne (usage admin uniquement)

```
1 Zora Point = 1.5 FCFA (coût interne indicatif, jamais publié)
```

Cette valeur sert uniquement à construire les offres avec les partenaires et à estimer l'exposition financière totale du catalogue.

---

## 10. Schéma base de données

### 10.1 Tables principales

```sql
-- Solde et tier courant du patient
CREATE TABLE zora_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,          -- points disponibles
  points_earned_12m INTEGER NOT NULL DEFAULT 0, -- pour calcul tier
  tier VARCHAR(20) NOT NULL DEFAULT 'KIMIA',    -- KIMIA|LIBOSO|NKEMBO|ELONGA
  tier_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_wallet_per_user UNIQUE(user_id),
  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

-- Livre de comptes — chaque mouvement de points
CREATE TABLE zora_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL,                    -- CREDIT | DEBIT | EXPIRY | REFUND
  amount INTEGER NOT NULL,                      -- toujours positif
  balance_after INTEGER NOT NULL,
  action_type VARCHAR(50),                      -- CONSULT_MEDECIN | SEANCE_ELONGA | etc.
  proof_type VARCHAR(30),                       -- ground_truth | system_event | etc.
  proof_reference VARCHAR(200),                 -- clé d'idempotence
  triggered_by_role VARCHAR(30),                -- medecin | animateur | pharmacie | system
  triggered_by_id UUID,
  offer_id UUID REFERENCES zora_offers(id),
  voucher_id UUID REFERENCES zora_vouchers(id),
  expires_at TIMESTAMPTZ,                       -- date d'expiration de ce lot de points
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_proof UNIQUE(proof_reference)
);

-- Règles de gain (configurables par admin)
CREATE TABLE zora_earn_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL UNIQUE,
  base_points INTEGER NOT NULL,
  monthly_cap INTEGER,
  proof_type_required VARCHAR(30) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plafonds par catégorie et par tier
CREATE TABLE zora_category_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  monthly_cap INTEGER NOT NULL,
  CONSTRAINT unique_cap UNIQUE(action_type, tier)
);

-- Tiers configuration
CREATE TABLE zora_tiers_config (
  tier VARCHAR(20) PRIMARY KEY,
  label_fr VARCHAR(50) NOT NULL,
  min_points_12m INTEGER NOT NULL,
  multiplier DECIMAL(3,1) NOT NULL,
  color_hex VARCHAR(7),
  badge_icon VARCHAR(50),
  display_order INTEGER
);

-- Campagnes bonus
CREATE TABLE zora_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(200) NOT NULL,
  action_type VARCHAR(50),                      -- NULL = toutes actions
  multiplier DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  min_tier VARCHAR(20),                         -- NULL = tous tiers
  city VARCHAR(50),                             -- NULL = toutes villes
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offres partenaires (Marketplace)
CREATE TABLE zora_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES users(id),
  partner_type VARCHAR(30) NOT NULL,            -- reward_partner | health_partner
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,                    -- VOUCHER|GIFT_CARD|DISCOUNT|OFFER_ACCESS
  zora_cost INTEGER NOT NULL,
  value_fcfa INTEGER,
  discount_percent INTEGER,
  stock INTEGER,
  stock_remaining INTEGER,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  min_tier VARCHAR(20) DEFAULT 'KIMIA',
  city VARCHAR(50) DEFAULT 'all',
  status VARCHAR(20) DEFAULT 'DRAFT',           -- DRAFT|SUBMITTED|APPROVED|REJECTED|ARCHIVED
  feed_published BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  budget_fcfa INTEGER,
  budget_consumed_fcfa INTEGER DEFAULT 0,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bons générés par les patients
CREATE TABLE zora_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES zora_offers(id),
  user_id UUID NOT NULL REFERENCES users(id),
  code_alpha VARCHAR(20) NOT NULL UNIQUE,       -- ZORA-XXXXX-XXXXX
  qr_payload TEXT NOT NULL,                     -- UUID encodé
  zora_cost INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'GENERATED',       -- GENERATED|PRESENTED|VALIDATED|USED|EXPIRED|CANCELLED
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,              -- generated_at + 48h
  validated_by UUID REFERENCES users(id),       -- partenaire qui a scanné
  validated_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  meta JSONB
);

-- Historique des tiers (audit)
CREATE TABLE zora_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  previous_tier VARCHAR(20),
  new_tier VARCHAR(20) NOT NULL,
  points_12m_at_change INTEGER,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason VARCHAR(50)                     -- MONTHLY_RECALC | THRESHOLD_REACHED
);
```

### 10.2 Index critiques

```sql
-- Ledger : requêtes fréquentes
CREATE INDEX idx_ledger_user_id ON zora_ledger(user_id);
CREATE INDEX idx_ledger_created_at ON zora_ledger(created_at);
CREATE INDEX idx_ledger_expires_at ON zora_ledger(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ledger_action_type ON zora_ledger(action_type);

-- Plafonds mensuels : agrégation rapide
CREATE INDEX idx_ledger_user_month ON zora_ledger(user_id, action_type, created_at);

-- Vouchers : validation rapide
CREATE INDEX idx_vouchers_code ON zora_vouchers(code_alpha);
CREATE INDEX idx_vouchers_status ON zora_vouchers(status);
CREATE INDEX idx_vouchers_expires ON zora_vouchers(expires_at) WHERE status = 'GENERATED';

-- Offres : marketplace
CREATE INDEX idx_offers_status_city ON zora_offers(status, city);
CREATE INDEX idx_offers_valid_until ON zora_offers(valid_until) WHERE status = 'ACTIVE';
```

---

## 11. Architecture backend — Routes et controllers

### 11.1 Structure des fichiers

```
src/
├── controllers/
│   ├── zora/
│   │   ├── zora-earn.controller.js       -- Déclenchement de points
│   │   ├── zora-burn.controller.js       -- Génération et validation de bons
│   │   ├── zora-marketplace.controller.js -- Offres partenaires
│   │   ├── zora-wallet.controller.js     -- Solde, historique, tier patient
│   │   └── zora-admin.controller.js      -- Configuration admin
│
├── services/
│   ├── zora/
│   │   ├── zora-earn.service.js          -- Logique earn + idempotence
│   │   ├── zora-burn.service.js          -- Logique burn + génération QR
│   │   ├── zora-tier.service.js          -- Calcul et mise à jour des tiers
│   │   ├── zora-expiry.service.js        -- Expiration des points (cron)
│   │   └── zora-voucher.service.js       -- Génération et validation vouchers
│
├── routes/
│   ├── zora.routes.js                    -- Toutes les routes Zora
│
└── jobs/
    ├── zora-expiry.job.js                -- Cron expiration points (02h00 UTC+1)
    └── zora-tier-recalc.job.js           -- Cron recalcul tiers (1er du mois 03h00)
```

### 11.2 Routes

```javascript
// ═══════════════════════════════════════════════
// PATIENT — Wallet et historique
// ═══════════════════════════════════════════════
GET    /api/zora/wallet                    // Solde + tier + points_12m
GET    /api/zora/wallet/history            // Ledger paginé
GET    /api/zora/wallet/expiring           // Points qui expirent dans 30j

// ═══════════════════════════════════════════════
// PATIENT — Bons et rédemption
// ═══════════════════════════════════════════════
GET    /api/zora/vouchers                  // Mes bons (actifs + historique)
POST   /api/zora/vouchers/generate         // Générer un bon depuis une offre
DELETE /api/zora/vouchers/:id/cancel       // Annuler un bon (avant validation)

// ═══════════════════════════════════════════════
// PARTENAIRE — Validation de bons
// ═══════════════════════════════════════════════
POST   /api/zora/vouchers/:id/validate     // Valider un bon (scan QR ou code)
GET    /api/zora/vouchers/partner/history  // Historique des bons validés

// ═══════════════════════════════════════════════
// MARKETPLACE — Offres
// ═══════════════════════════════════════════════
GET    /api/zora/offers                    // Liste offres actives (patient)
GET    /api/zora/offers/:id               // Détail d'une offre
POST   /api/zora/offers                   // Créer une offre (partenaire)
PUT    /api/zora/offers/:id               // Modifier une offre (partenaire, si DRAFT)
GET    /api/zora/offers/partner/mine      // Mes offres (partenaire)

// ═══════════════════════════════════════════════
// EARN — Déclenchement (acteurs autorisés)
// ═══════════════════════════════════════════════
POST   /api/zora/earn/consultation        // Déclenché par médecin/secrétaire
POST   /api/zora/earn/pharmacie           // Déclenché par pharmacie
POST   /api/zora/earn/laboratoire         // Déclenché par laboratoire
POST   /api/zora/earn/elonga/presence     // Déclenché par animateur
POST   /api/zora/earn/elonga/event        // Déclenché par animateur (événement)
POST   /api/zora/earn/system              // Déclenché par système (cron, parrainage)

// ═══════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════
GET    /api/admin/zora/dashboard          // Vue globale
GET    /api/admin/zora/offers/pending     // Offres en attente de validation
PUT    /api/admin/zora/offers/:id/review  // Approuver ou rejeter une offre
POST   /api/admin/zora/campaigns          // Créer une campagne bonus
PUT    /api/admin/zora/earn-rules         // Modifier les règles d'earn
GET    /api/admin/zora/ledger             // Ledger global (audit)
```

### 11.3 Logique earn atomique (zora-earn.service.js)

```javascript
async function creditPoints({ userId, actionType, proofReference, proofType, triggeredById, triggeredByRole, meta }) {

  // 1. Vérifier idempotence
  const existing = await db.query(
    'SELECT id FROM zora_ledger WHERE proof_reference = $1', [proofReference]
  );
  if (existing.rows.length > 0) return { skipped: true, reason: 'already_credited' };

  // 2. Charger la règle earn
  const rule = await getEarnRule(actionType); // depuis zora_earn_rules
  if (!rule || !rule.is_active) throw new Error('RULE_INACTIVE');

  // 3. Vérifier plafond mensuel catégorie
  const monthlyEarned = await getMonthlyEarned(userId, actionType);
  if (monthlyEarned >= rule.monthly_cap) return { skipped: true, reason: 'monthly_cap_reached' };

  // 4. Charger tier + multiplicateur
  const wallet = await getWallet(userId);
  const tierConfig = await getTierConfig(wallet.tier);
  const campaignMultiplier = await getActiveCampaignMultiplier(actionType, wallet.tier);

  // 5. Calculer les points
  const pointsToCredit = Math.floor(
    rule.base_points * tierConfig.multiplier * campaignMultiplier
  );

  // 6. Transaction atomique
  await db.transaction(async (trx) => {
    // Écriture ledger
    await trx.query(`
      INSERT INTO zora_ledger (user_id, type, amount, balance_after, action_type,
        proof_type, proof_reference, triggered_by_role, triggered_by_id, expires_at, meta)
      VALUES ($1, 'CREDIT', $2, (SELECT balance FROM zora_wallets WHERE user_id=$1) + $2,
        $3, $4, $5, $6, $7, NOW() + INTERVAL '12 months', $8)
    `, [userId, pointsToCredit, actionType, proofType, proofReference, triggeredByRole, triggeredById, meta]);

    // Mise à jour wallet
    await trx.query(`
      UPDATE zora_wallets
      SET balance = balance + $1,
          points_earned_12m = points_earned_12m + $1,
          updated_at = NOW()
      WHERE user_id = $2
    `, [pointsToCredit, userId]);
  });

  // 7. Vérifier upgrade tier (hors transaction, non bloquant)
  await checkAndUpgradeTier(userId).catch(console.error);

  return { credited: pointsToCredit };
}
```

---

## 12. Architecture frontend — Dashboards et composants

### 12.1 Dashboard Patient — Onglets Zora

#### Onglet Wallet (dans le dashboard principal)

```
┌─────────────────────────────────────────────┐
│  [Badge Tier: NKEMBO — Or]                  │
│                                             │
│  Votre solde Zora                           │
│  ┌─────────────────────────────────────┐    │
│  │          2 350 Zora Points          │    │
│  │  ████████████████░░░░ 3 000 Nkembo │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Voir la Marketplace]  [Mes bons actifs]   │
│                                             │
│  Derniers mouvements                        │
│  + 150 pts — Consultation Dr. Moanda        │
│  + 96 pts  — Séance Elonga (×1.5 tier)     │
│  − 500 pts — Bon Boutique Zara Congo        │
└─────────────────────────────────────────────┘
```

#### Onglet Marketplace (depuis le Feed ou menu principal)

```
┌─────────────────────────────────────────────┐
│  Marketplace Zora                           │
│  [Filtre: Brazzaville ▾]  [Tous tiers ▾]   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ [Image]  Boutique Mama Ngombo        │   │
│  │          30% de réduction            │   │
│  │          500 Zora  · Expire 31 juil  │   │
│  │          [Utiliser mes points →]     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ [Image]  Pharmacie Maria ⭐ Nkembo+  │   │
│  │          Carte cadeau 5 000 FCFA     │   │
│  │          1 200 Zora · Stock: 8 rest. │   │
│  │          [Réservé Nkembo+]           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

#### Section "Mes bons"

```
┌─────────────────────────────────────────────┐
│  Mes bons actifs                            │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Boutique Mama Ngombo                │   │
│  │  30% de réduction                   │   │
│  │  [QR CODE]   ZORA-K8P2X-7MN3Q       │   │
│  │  Expire le 06/07/2026 à 14h23       │   │
│  │  [Annuler]                          │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 12.2 Dashboard Partenaire Récompense — Section Zora

```
Onglets : [Mes offres] [Scanner un bon] [Reporting]

Section "Scanner un bon" :
┌─────────────────────────────────────────────┐
│  Valider un bon Zora                        │
│                                             │
│  [Ouvrir la caméra pour scanner]            │
│  — ou —                                     │
│  Code manuel : [ ZORA-_____-_____ ]         │
│               [Valider]                     │
│                                             │
│  ✓ Bon validé                               │
│  Patient : M. Kimfuta Jean                  │
│  Offre : 30% de réduction                   │
│  Valeur : 3 000 FCFA de remise              │
└─────────────────────────────────────────────┘
```

### 12.3 Dashboard Animateur — Déclenchement Zora

```
Après chaque validation de présence :
┌─────────────────────────────────────────────┐
│  Présence validée                           │
│  Patient : Mme. Bongo Marie                 │
│                                             │
│  + 80 Zora Points crédités automatiquement  │
│  (Séance Elonga)                            │
│                                             │
│  [OK]                                       │
└─────────────────────────────────────────────┘
```

---

## 13. Règles métier et anti-fraude

### 13.1 Règles absolues

- Un `proof_reference` ne peut jamais être crédité deux fois (contrainte UNIQUE en base).
- `device_declared` est systématiquement rejeté — aucune auto-déclaration acceptée.
- Un bon ne peut être validé que par un utilisateur avec le rôle `reward_partner` ou `health_partner`.
- Un patient ne peut pas valider son propre bon.
- Le solde Zora ne peut jamais être négatif (contrainte CHECK en base).
- Un patient ne peut pas avoir plus de 5 bons actifs simultanément.

### 13.2 Détection d'anomalies

Signaux surveillés par le système :

| Signal | Seuil | Action |
|---|---|---|
| Points crédités > 3× la moyenne mensuelle | 1 occurrence | Alerte admin |
| Même proof_reference tenté 3+ fois | Immédiat | Flag + blocage IP temporaire |
| Bon scanné par 2 partenaires différents | Immédiat | Alerte + investigation |
| Earn CONSULT_MEDECIN > 4/jour | 1 occurrence | Flag patient + alerte admin |
| Partenaire valide > 50 bons/heure | Immédiat | Suspension temporaire + alerte |

### 13.3 Audit trail

Chaque opération Zora écrit dans `audit_log` (table insert-only existante) :

```json
{
  "action": "ZORA_CREDIT | ZORA_DEBIT | VOUCHER_GENERATED | VOUCHER_VALIDATED",
  "performed_by": "uuid",
  "target_user": "uuid",
  "detail": { "amount": 150, "action_type": "CONSULT_MEDECIN", "proof_reference": "..." },
  "ip": "...",
  "timestamp": "..."
}
```

---

## 14. Notifications et communication

### 14.1 Templates WhatsApp requis

Tous les templates passent par `whatsapp-web.service.js → sendAutoMessage(phone, templateName, params)`.

| Template name | Déclencheur | Paramètres |
|---|---|---|
| `zora_credit` | Crédit de points | `{patient_name}`, `{points}`, `{action}`, `{solde_total}` |
| `zora_tier_upgrade` | Upgrade de tier | `{patient_name}`, `{ancien_tier}`, `{nouveau_tier}` |
| `zora_voucher_generated` | Bon généré | `{patient_name}`, `{offer_title}`, `{code_alpha}`, `{expires_at}` |
| `zora_voucher_used` | Bon utilisé (patient) | `{patient_name}`, `{offer_title}`, `{partner_name}` |
| `zora_voucher_confirmed` | Bon validé (partenaire) | `{partner_name}`, `{code_alpha}`, `{value_fcfa}` |
| `zora_points_expiring_30d` | 30j avant expiration | `{patient_name}`, `{points_expirant}`, `{date_expiration}` |
| `zora_points_expiring_7d` | 7j avant expiration | idem |
| `zora_points_expiring_1d` | 1j avant expiration | idem |
| `zora_new_offer` | Nouvelle offre compatible | `{patient_name}`, `{offer_title}`, `{partner_name}`, `{zora_cost}` |
| `zora_budget_alert` | 80% budget consommé | `{partner_name}`, `{offer_title}`, `{budget_remaining}` |
| `zora_offer_approved` | Offre approuvée par admin | `{partner_name}`, `{offer_title}` |
| `zora_offer_rejected` | Offre rejetée | `{partner_name}`, `{offer_title}`, `{motif}` |

---

## 15. Administration et configuration

### 15.1 Dashboard Admin — Section Zora

```
Onglets : [Vue globale] [Offres en attente] [Campagnes] [Règles earn] [Ledger global]

Vue globale :
- Total points en circulation
- Total points expirés ce mois
- Bons générés / validés / expirés ce mois
- Top 10 offres (par consommation)
- Top 10 partenaires (par activité)
- Alertes fraude actives
```

### 15.2 Configuration earn rules (interface admin)

Toutes les règles sont stockées en base dans `zora_earn_rules` — modifiables sans déploiement.

L'admin peut :
- Modifier `base_points` et `monthly_cap` pour chaque action
- Activer / désactiver une action
- Créer une nouvelle action type
- Lancer une campagne bonus ponctuellement

### 15.3 Processus de validation d'offre

```
1. Partenaire soumet → statut SUBMITTED
2. Admin reçoit notification WhatsApp
3. Admin ouvre le dashboard → section "Offres en attente"
4. Admin vérifie : contenu conforme, budget déclaré réaliste, partenaire actif
5. Admin APPROUVE → statut ACTIVE + feed_published selon choix
   OU
   Admin REJETTE → statut REJECTED + motif obligatoire → WhatsApp partenaire
```

---

## 16. Roadmap d'implémentation

### Phase 1 — Socle Zora (priorité maximale)

- [ ] Tables SQL : `zora_wallets`, `zora_ledger`, `zora_earn_rules`, `zora_tiers_config`
- [ ] Service earn atomique avec idempotence
- [ ] Endpoint wallet patient (solde + historique)
- [ ] Déclencheurs earn sur consultation médicale (intégration appointments)
- [ ] Calcul tier mensuel (cron)

### Phase 2 — Burn et Marketplace

- [ ] Tables SQL : `zora_offers`, `zora_vouchers`
- [ ] Génération de bons QR + code alphanumérique
- [ ] Dashboard marketplace patient
- [ ] Dashboard soumission offres partenaire
- [ ] Flux validation admin (review offres)

### Phase 3 — Feed et notifications

- [ ] Intégration offres dans le Feed social (`feed_published`)
- [ ] Templates WhatsApp Zora (12 templates)
- [ ] Alertes expiration points (cron 02h00)
- [ ] Notifications tier upgrade

### Phase 4 — Animateur et Elonga

- [ ] Déclencheurs earn sur présences Elonga
- [ ] Interface animateur (validation présence → crédit automatique)
- [ ] Campagnes bonus admin

### Phase 5 — Anti-fraude et reporting

- [ ] Détection anomalies (seuils automatiques)
- [ ] Dashboard admin complet
- [ ] Reporting mensuel partenaires (budget consommé)
- [ ] Audit trail Zora complet

---

---

## 17. Intégration avec les systèmes existants Bolamu

Cette section définit les **points d'ancrage précis** entre Zora et le code existant. C'est le contrat que Windsurf doit respecter lors de l'implémentation — aucun déclencheur Zora ne doit être inventé en dehors de ces points.

### 17.1 Carte des points d'intégration

```
SYSTÈME EXISTANT                    POINT D'ANCRAGE                    DÉCLENCHEUR ZORA
─────────────────────────────────────────────────────────────────────────────────────────
appointments (controller)     →  statut → 'completed'             →  CONSULT_MEDECIN
                                 (appointment_id comme entity_id)

prescriptions (controller)    →  achat validé par pharmacie       →  ACHAT_PHARMACIE
                                 (prescription_id comme entity_id)

laboratoire (controller)      →  résultats transmis au patient     →  BILAN_LABO
                                 (labo_result_id comme entity_id)

abonnement.job.js (cron)      →  step renouvellement réussi        →  ABONNEMENT_RENOUVELE
                                 (subscription_id + mois comme entity_id)

abonnement.job.js (cron)      →  12e renouvellement consécutif     →  FIDELITE_12MOIS
                                 (user_id + année comme entity_id)

users (controller auth)       →  profil marqué is_complete=true    →  PROFIL_COMPLETE
                                 (user_id comme entity_id, one-shot)

parrainage (à créer)          →  filleul actif depuis 30j          →  PARRAINAGE
                                 (referral_id comme entity_id)

elonga/presence (animateur)   →  présence validée par animateur    →  SEANCE_ELONGA
                                 (session_id + user_id comme entity_id)

elonga/event (animateur)      →  participation événement validée   →  EVENT_ELONGA
                                 (event_id + user_id comme entity_id)
```

### 17.2 Règle d'intégration absolue

> **Zora ne poll pas — Zora est appelé.**

Le service `zora-earn.service.js` est toujours **appelé par** le système source, jamais l'inverse. Il ne surveille pas la base de données en attente d'événements. Chaque système source est responsable d'appeler `creditPoints()` au bon moment, dans sa propre logique métier.

```javascript
// Exemple dans appointments.controller.js — après mise à jour statut 'completed'
await updateAppointmentStatus(appointmentId, 'completed');

// Appel Zora — non bloquant, erreur non fatale pour le flux principal
setImmediate(async () => {
  try {
    await zoraEarnService.creditPoints({
      userId: appointment.patient_id,
      actionType: 'CONSULT_MEDECIN',
      proofReference: `CONSULT_MEDECIN:${appointmentId}:${formatDate(new Date())}`,
      proofType: 'ground_truth',
      triggeredById: appointment.doctor_id,
      triggeredByRole: 'medecin',
      meta: { appointment_id: appointmentId, doctor_name: appointment.doctor_name }
    });
  } catch (err) {
    logger.error('Zora earn failed (non-blocking):', err);
  }
});
```

**Principe clé : l'échec du crédit Zora ne doit jamais faire échouer l'acte médical principal.**
Tous les appels `zoraEarnService.creditPoints()` sont dans un `setImmediate` + `try/catch` non bloquant.

### 17.3 Table de mapping complet — proof_reference

Format canonique : `{ACTION_TYPE}:{entity_id}:{YYYYMMDD}`

| Action | entity_id utilisé | Exemple |
|---|---|---|
| `CONSULT_MEDECIN` | `appointment.id` | `CONSULT_MEDECIN:uuid-appt:20260704` |
| `ACHAT_PHARMACIE` | `prescription.id` | `ACHAT_PHARMACIE:uuid-presc:20260704` |
| `BILAN_LABO` | `labo_result.id` | `BILAN_LABO:uuid-result:20260704` |
| `SEANCE_ELONGA` | `session.id + ':' + user.id` | `SEANCE_ELONGA:uuid-sess:uuid-user:20260704` |
| `EVENT_ELONGA` | `event.id + ':' + user.id` | `EVENT_ELONGA:uuid-event:uuid-user:20260704` |
| `ABONNEMENT_RENOUVELE` | `subscription.id + ':' + YYYYMM` | `ABONNEMENT_RENOUVELE:uuid-sub:202607` |
| `FIDELITE_12MOIS` | `user.id + ':' + YYYY` | `FIDELITE_12MOIS:uuid-user:2026` |
| `PROFIL_COMPLETE` | `user.id` | `PROFIL_COMPLETE:uuid-user` (pas de date — one-shot) |
| `PARRAINAGE` | `referral.id` | `PARRAINAGE:uuid-referral:20260704` |

---

## 18. Gestion des abonnements inactifs et suspendus

### 18.1 États d'un abonnement et impact sur Zora

| État abonnement | Earn (gain) | Burn (dépense) | Bons actifs | Solde |
|---|---|---|---|---|
| `ACTIVE` | Autorisé | Autorisé | Valides | Intact |
| `SUSPENDED` (impayé) | **Bloqué** | **Bloqué** | **Gelés** | Intact (conservé) |
| `EXPIRED` (non renouvelé) | **Bloqué** | **Bloqué** | **Gelés** | Intact (conservé) |
| `CANCELLED` (résiliation volontaire) | **Bloqué** | **Bloqué** | **Annulés** | Conservé 6 mois puis expiré |
| `REACTIVATED` (reprise après suspension) | Autorisé | Autorisé | **Réactivés** si non expirés | Intact |

### 18.2 Règles détaillées

**Suspension (impayé ou incident de paiement)**
- Le cron `abonnement.job.js` passe l'abonnement en `SUSPENDED`.
- `zora_wallets` reçoit un flag `is_frozen = TRUE`.
- Les appels à `creditPoints()` retournent `{ skipped: true, reason: 'wallet_frozen' }` sans erreur.
- Les tentatives de génération de bon retournent une erreur `WALLET_FROZEN` avec message : _"Votre compte Zora est gelé. Régularisez votre abonnement pour accéder à vos points."_
- Les bons déjà générés à statut `GENERATED` sont passés en `SUSPENDED_HOLD` — ils ne peuvent ni être utilisés ni expirer pendant la suspension.
- Durée max de suspension avant annulation automatique : **30 jours** (configurable dans `platform_config`).

**Réactivation**
- `is_frozen` repasse à `FALSE`.
- Les bons en `SUSPENDED_HOLD` repassent en `GENERATED` avec leur expiration **prolongée** de la durée de la suspension (plafonné à 7 jours de prolongation max).
- Notification WhatsApp envoyée : template `zora_wallet_reactivated`.

**Résiliation volontaire**
- Les bons actifs sont annulés (re-crédit des points).
- Le solde est conservé pendant **6 mois** — si le patient se réabonne dans cette fenêtre, il retrouve son solde intégral et son tier.
- Après 6 mois sans réabonnement, un cron expire le solde restant avec `type: 'EXPIRY'` et `meta: { reason: 'account_cancelled' }`.
- Notification WhatsApp à J-30 et J-7 avant l'expiration du solde.

### 18.3 Colonne à ajouter sur zora_wallets

```sql
ALTER TABLE zora_wallets ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE zora_wallets ADD COLUMN frozen_since TIMESTAMPTZ;
ALTER TABLE zora_wallets ADD COLUMN frozen_reason VARCHAR(50); -- SUSPENDED | EXPIRED | CANCELLED
```

### 18.4 Statut supplémentaire pour zora_vouchers

```sql
-- Ajouter 'SUSPENDED_HOLD' à l'enum de statuts
-- GENERATED | PRESENTED | VALIDATED | USED | EXPIRED | CANCELLED | SUSPENDED_HOLD
```

---

## 19. Onboarding et authentification partenaire récompense

> **Note (Tâche D, nettoyage des rôles)** : La validation voucher est assurée par le rôle `partenaire`. Les rôles `reward_partner` et `health_partner` sont abandonnés — jamais implémentés dans le code.

### 19.1 Rôle système

Le partenaire récompense utilise le rôle `reward_partner` dans la table `users` — aligné sur la convention existante Bolamu (6 rôles : `patient`, `medecin`, `secretaire`, `pharmacie`, `laboratoire`, `admin`). On ajoute `reward_partner` comme 7e rôle.

```sql
-- Aucune nouvelle table users — on utilise la table existante
-- role = 'reward_partner'
-- member_code préfixe : RWD-
-- ex: RWD-00001
```

### 19.2 Flux d'onboarding

```
1. Admin Bolamu crée le compte partenaire dans le dashboard admin
   (nom, téléphone, ville, catégorie, RCCM, budget initial déclaré)

2. Système génère :
   - Un compte users (role: 'reward_partner', is_active: false)
   - Un member_code (RWD-XXXXX)
   - Un OTP d'activation envoyé par WhatsApp

3. Partenaire reçoit le WhatsApp → accède à l'URL d'activation
   → Définit son mot de passe → compte activé (is_active: true)

4. Partenaire accède à son dashboard → section Zora :
   [Mes offres] [Scanner un bon] [Reporting]

5. Admin reçoit notification de première connexion
```

### 19.3 Authentification

Même système JWT que les autres rôles Bolamu — pas de système parallèle.

```javascript
// Middleware existant — aucune modification nécessaire
// Le token JWT contient { user_id, role: 'reward_partner', ... }

// Guard sur les routes de validation de bons
router.post('/zora/vouchers/:id/validate',
  authenticateToken,                          // JWT existant
  requireRole(['reward_partner', 'health_partner', 'admin']),  // guard rôle
  zoraVoucherController.validate
);
```

### 19.4 Permissions par rôle sur les routes Zora

| Route | patient | medecin | secretaire | pharmacie | laboratoire | reward_partner | admin |
|---|---|---|---|---|---|---|---|
| `GET /zora/wallet` | Soi-même | Non | Non | Non | Non | Non | Tous |
| `POST /zora/vouchers/generate` | Soi-même | Non | Non | Non | Non | Non | Non |
| `POST /zora/vouchers/:id/validate` | Non | Non | Non | Oui | Non | Oui | Oui |
| `GET /zora/offers` | Oui | Non | Non | Non | Non | Non | Oui |
| `POST /zora/offers` | Non | Non | Non | Oui | Oui | Oui | Oui |
| `PUT /zora/offers/:id/review` | Non | Non | Non | Non | Non | Non | Oui |
| `POST /zora/earn/*` | Non | Selon route | Selon route | Selon route | Selon route | Non | Oui |

### 19.5 Dashboard partenaire — accès minimal requis

Un partenaire récompense doit pouvoir, dès la première connexion :
- Voir ses offres actives et leur stock restant
- Scanner un bon patient (QR ou code manuel)
- Consulter son reporting mensuel (bons validés, budget consommé)
- Soumettre une nouvelle offre pour validation admin

---

## 20. Priorité et composition des campagnes bonus

### 20.1 Problème

Plusieurs campagnes actives peuvent cibler le même `action_type` simultanément. Sans règle explicite, le comportement du service earn est indéterminé.

### 20.2 Règle de priorité — Campagne unique par action

**Règle canonique : une seule campagne est appliquée par action, celle avec le multiplicateur le plus élevé.**

Justification : le patient doit toujours bénéficier de la meilleure offre active. C'est cohérent avec une logique de programme de fidélité orienté engagement.

```javascript
// Dans zora-earn.service.js
async function getActiveCampaignMultiplier(actionType, userTier, userCity) {
  const now = new Date();

  const campaigns = await db.query(`
    SELECT multiplier
    FROM zora_campaigns
    WHERE is_active = TRUE
      AND start_date <= $1
      AND end_date >= $1
      AND (action_type = $2 OR action_type IS NULL)   -- NULL = toutes actions
      AND (min_tier IS NULL OR min_tier <= $3)         -- NULL = tous tiers
      AND (city IS NULL OR city = $4)                  -- NULL = toutes villes
    ORDER BY multiplier DESC
    LIMIT 1
  `, [now, actionType, userTier, userCity]);

  return campaigns.rows[0]?.multiplier ?? 1.0;
}
```

### 20.3 Règles supplémentaires sur les campagnes

**Plafond de composition :** Le multiplicateur final (tier × campagne) est plafonné à **× 4.0** quels que soient les multiplicateurs individuels. Cela prévient des crédits aberrants en cas d'erreur de configuration admin.

```javascript
const rawMultiplier = tierConfig.multiplier * campaignMultiplier;
const finalMultiplier = Math.min(rawMultiplier, 4.0); // plafond absolu
```

**Campagne globale (`action_type IS NULL`) :** Une campagne sans `action_type` s'applique à toutes les actions. Elle est concurrente avec les campagnes spécifiques — la règle "multiplicateur le plus élevé" s'applique de la même façon.

**Historique de campagne dans le ledger :** Quand un crédit est influencé par une campagne, l'id de la campagne est tracé dans le champ `meta` du ledger :

```json
{
  "campaign_id": "camp_uuid",
  "campaign_label": "Juillet Santé — 2x Elonga",
  "tier_multiplier": 1.5,
  "campaign_multiplier": 2.0,
  "final_multiplier": 3.0,
  "base_points": 80,
  "points_credited": 240
}
```

### 20.4 Contrainte admin sur la création de campagnes

Avant de créer une campagne, le dashboard admin affiche un avertissement si une campagne active couvre déjà le même `action_type` sur la même période. L'admin peut quand même créer — la règle du multiplicateur max s'appliquera — mais il est informé de la concurrence.

---

## 21. Gestion du stock en concurrence

### 21.1 Problème

Sans mécanisme de réservation, si 10 patients génèrent simultanément un bon sur une offre avec `stock: 10`, chacun passe la vérification `stock_remaining > 0` avant que les autres aient décrémenté — résultat : stock négatif.

### 21.2 Solution — Réservation atomique par UPDATE conditionnel

On n'utilise pas de `SELECT` suivi d'un `UPDATE` (race condition). On utilise un `UPDATE ... WHERE stock_remaining > 0 RETURNING *` atomique au niveau base de données.

```javascript
// Dans zora-burn.service.js — génération d'un bon
async function generateVoucher({ userId, offerId, zoraCost }) {

  return await db.transaction(async (trx) => {

    // 1. Décrémenter le stock de façon atomique — échoue si stock = 0
    const offerResult = await trx.query(`
      UPDATE zora_offers
      SET stock_remaining = stock_remaining - 1,
          updated_at = NOW()
      WHERE id = $1
        AND status = 'ACTIVE'
        AND stock_remaining > 0
        AND valid_until >= CURRENT_DATE
      RETURNING id, title, zora_cost, stock_remaining
    `, [offerId]);

    if (offerResult.rows.length === 0) {
      throw new Error('OFFER_OUT_OF_STOCK');
      // Stock épuisé ou offre inactive — aucun bon généré, aucun point débité
    }

    // 2. Débiter les points du wallet (atomique dans la même transaction)
    const walletResult = await trx.query(`
      UPDATE zora_wallets
      SET balance = balance - $1,
          updated_at = NOW()
      WHERE user_id = $2
        AND balance >= $1
        AND is_frozen = FALSE
      RETURNING balance
    `, [zoraCost, userId]);

    if (walletResult.rows.length === 0) {
      throw new Error('INSUFFICIENT_BALANCE_OR_FROZEN');
      // La transaction rollback automatiquement — le stock est re-incrémenté
    }

    // 3. Générer le bon
    const codeAlpha = generateAlphaCode(); // ZORA-XXXXX-XXXXX
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48h

    const voucher = await trx.query(`
      INSERT INTO zora_vouchers
        (offer_id, user_id, code_alpha, qr_payload, zora_cost, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [offerId, userId, codeAlpha, generateQRPayload(), zoraCost, expiresAt]);

    // 4. Écrire dans le ledger
    await trx.query(`
      INSERT INTO zora_ledger
        (user_id, type, amount, balance_after, voucher_id)
      VALUES ($1, 'DEBIT', $2, $3, $4)
    `, [userId, zoraCost, walletResult.rows[0].balance, voucher.rows[0].id]);

    return voucher.rows[0];
  });
  // Si une étape échoue → rollback complet : stock restauré + points restaurés
}
```

### 21.3 Colonne stock_reserved — non nécessaire

Le mécanisme `UPDATE ... WHERE stock_remaining > 0` rend inutile une colonne `stock_reserved` séparée. Le stock est décrémenté à la génération du bon, pas à la validation. Si le bon expire, le stock est **re-incrémenté** par le cron d'expiration.

```javascript
// Dans zora-expiry.job.js — traitement des bons expirés
await db.query(`
  UPDATE zora_offers o
  SET stock_remaining = stock_remaining + expired_count
  FROM (
    SELECT offer_id, COUNT(*) as expired_count
    FROM zora_vouchers
    WHERE status = 'GENERATED'
      AND expires_at < NOW()
    GROUP BY offer_id
  ) expired
  WHERE o.id = expired.offer_id
`);

// Puis passer les bons en EXPIRED et re-créditer les points
```

### 21.4 Offres sans limite de stock

Quand `stock IS NULL` (offre illimitée), la vérification `stock_remaining > 0` est bypassée :

```sql
-- Dans la requête UPDATE atomique
WHERE id = $1
  AND status = 'ACTIVE'
  AND (stock IS NULL OR stock_remaining > 0)  -- NULL = illimité
  AND valid_until >= CURRENT_DATE
```

---

## 22. Glossaire

Termes utilisés dans ce document et dans les interfaces Bolamu.

| Terme | Définition |
|---|---|
| **Zora** | Système de points de fidélité de Bolamu. Nom inspiré du lingala, évoque la valeur et la récompense. |
| **Zora Point** | Unité de valeur du système Zora. Valeur interne : 1.5 FCFA (non communiquée). |
| **Wallet** | Portefeuille de points Zora d'un patient. Contient le solde disponible et le tier courant. |
| **Earn** | Mécanisme de gain de points — déclenché par un acte de santé ou bien-être validé. |
| **Burn** | Mécanisme de dépense de points — échange contre un bon, une réduction, ou une carte cadeau. |
| **Ledger** | Livre de comptes immuable de tous les mouvements Zora (crédits, débits, expirations). |
| **Tier** | Niveau de fidélité du patient, calculé sur les points gagnés dans les 12 derniers mois. |
| **Kimia** | Tier 1 — débutant. Signifie "paix" en lingala. |
| **Liboso** | Tier 2 — confirmé. Signifie "premier pas" en lingala. |
| **Nkembo** | Tier 3 — avancé. Signifie "gloire" en lingala. |
| **Elonga** | Tier 4 — élite. Signifie "excellence" / "victoire" en lingala. Aussi le nom du programme bien-être. |
| **Bon d'achat (Voucher)** | Coupon numérique généré par le patient avec ses points, présenté chez un partenaire récompense via QR code ou code alphanumérique. |
| **Carte cadeau (Gift Card)** | Bon à valeur fixe prédéfinie — même mécanisme que le voucher, montant garanti. |
| **Réduction (Discount)** | Remise appliquée directement sur un acte partenaire, sans génération de bon intermédiaire. |
| **Marketplace** | Catalogue des offres publiées par les partenaires récompenses, accessible depuis le dashboard patient et le Feed. |
| **Partenaire santé** | Clinique, pharmacie ou laboratoire — déclencheur de points Zora à chaque acte de soins validé. N'est pas financeur de récompenses. |
| **Partenaire récompense** | Boutique, restaurant, service ou autre commerce — publie ses propres offres et finance ses récompenses. Valide les bons présentés par les patients. |
| **Animateur** | Encadrant Elonga (coach sportif, nutritionniste, etc.) — déclenche des points à chaque présence validée. N'a pas de solde Zora. |
| **Proof reference** | Identifiant unique d'un déclencheur Zora, garantissant qu'un même acte ne peut générer des points qu'une seule fois. |
| **Proof type** | Nature de la preuve d'un acte (`ground_truth`, `system_event`, `device_measured`). `device_declared` est toujours rejeté. |
| **Campagne bonus** | Période de multiplicateur additionnel sur une ou toutes les actions earn, lancée par l'admin. |
| **Code alpha** | Code alphanumérique de fallback d'un bon — format `ZORA-XXXXX-XXXXX` — utilisable quand le QR ne peut pas être scanné. |
| **Budget partenaire** | Enveloppe financière déclarée par le partenaire récompense pour financer ses offres. Suivi en temps réel par Bolamu. |
| **is_frozen** | Flag sur le wallet indiquant que le compte Zora est gelé (abonnement suspendu, résilié ou expiré). |
| **FCFA** | Franc CFA — devise officielle de la République du Congo. |
| **OVP** | Ordre de Virement Permanent — mandat de prélèvement mensuel automatique via RIB. |

---

## 23. Conformité CNPD — Données personnelles et santé

**Loi applicable : Loi n°5-2025 relative à la protection des données personnelles (CNPD Congo)**

### 23.1 Classification des données Zora

| Donnée | Table | Classification | Sensibilité |
|---|---|---|---|
| Solde de points | `zora_wallets` | Donnée financière | Moyenne |
| Historique des actes (type d'acte, date) | `zora_ledger` | **Donnée de santé indirecte** | **Haute** |
| Nom du médecin déclencheur | `zora_ledger.meta` | Donnée de santé indirecte | Haute |
| Offres consultées | `zora_offers` (logs) | Donnée comportementale | Moyenne |
| Bons générés et utilisés | `zora_vouchers` | Donnée comportementale | Moyenne |
| Tier du patient | `zora_wallets` | Donnée comportementale | Faible |

### 23.2 Données de santé indirectes — mesures spécifiques

Le ledger Zora contient des `action_type` qui révèlent indirectement des comportements de santé (`CONSULT_MEDECIN`, `BILAN_LABO`, etc.). Ces données sont considérées comme **données de santé indirectes** au sens de la CNPD.

Mesures appliquées :

- **Chiffrement au repos** : les colonnes `action_type`, `meta`, `triggered_by_id` du ledger sont stockées chiffrées en base (AES-256 via Neon pgcrypto ou chiffrement applicatif).
- **Accès restreint** : seul le patient lui-même et l'admin Bolamu peuvent consulter le détail du ledger. Les partenaires n'y ont jamais accès.
- **Pseudonymisation** : dans les exports et reportings partenaires, le patient est identifié par son `member_code` (BLM-XXXXX), jamais par son nom ou téléphone.
- **Finalité déclarée** : les données de comportement de santé collectées via Zora sont utilisées exclusivement pour le calcul des points et la détection de fraude — pas à des fins marketing tiers.

### 23.3 Durées de conservation

| Donnée | Durée de conservation | Justification |
|---|---|---|
| `zora_ledger` (complet) | 5 ans après le dernier acte | Conformité comptable OHADA |
| `zora_wallets` | Durée de l'abonnement + 6 mois | Litige potentiel |
| `zora_vouchers` | 2 ans après utilisation ou expiration | Litiges partenaires |
| `zora_tier_history` | 3 ans | Historique fidélité |
| Logs d'audit Zora | 5 ans | Conformité CNPD Art. 28 |

### 23.4 Droits des patients (CNPD Art. 15-22)

| Droit | Mise en œuvre dans Bolamu |
|---|---|
| Droit d'accès | Export complet du wallet + ledger via dashboard patient (bouton "Télécharger mes données") |
| Droit de rectification | Correction possible via admin uniquement (le ledger est immuable — une entrée corrective est créée) |
| Droit à l'effacement | Non applicable sur le ledger (obligation OHADA) — applicable sur les données marketing |
| Droit à la portabilité | Export JSON du wallet et ledger, format standardisé |
| Droit d'opposition | Patient peut demander la suspension de la collecte Zora — son abonnement reste actif mais aucun point n'est crédité |

### 23.5 Base légale du traitement

Le traitement des données Zora repose sur **l'exécution du contrat** (CGU V8.2, Article X — Programme de fidélité Zora) accepté lors de l'inscription. Aucun consentement séparé n'est requis pour le programme de points, car il est une composante intrinsèque de l'abonnement Bolamu.

La collecte des données de santé indirectes via le ledger est couverte par la **finalité de gestion du programme de fidélité santé**, explicitement déclarée dans les CGU.

---

*Document rédigé par NBA Gestion SARLU — Bolamu Platform*
*Référence fondatrice du système Zora — toute modification requiert validation PDG*
*Version 1.1 — Juillet 2026*
