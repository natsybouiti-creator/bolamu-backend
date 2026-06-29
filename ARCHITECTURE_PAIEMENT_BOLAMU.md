# ARCHITECTURE_PAIEMENT_BOLAMU.md
> Document de référence — Paiements & Abonnements — Bolamu / NBA GESTION SARLU
> Version 1.1 — Juin 2026

---

## 1. IDENTITÉ MARCHANDE

| Opérateur | Identifiant marchand | Nom légal |
|-----------|---------------------|-----------|
| MTN MoMo | `503215` | NBA GESTION SARLU |
| Airtel Money | `057430079` | NBA GESTION SARLU |

---

## 2. PLANS D'ABONNEMENT

| Plan | Tarif mensuel | Cible |
|------|--------------|-------|
| MOTO | 2 000 XAF | Accès de base |
| NDEKO | 5 000 XAF | Accès standard |
| LIBOTA | 10 000 XAF | Accès premium |

> **Fréquence :** mensuelle uniquement.
> **Politique de frais :** Bolamu absorbe les commissions opérateurs côté marchand. Le patient paie le tarif affiché net.

---

## 3. FLUX DE PAIEMENT

### 3.1 Paiement initial (inscription)

Déclenché à l'**étape 5 du register** (`/register.html`).  
Mode : MoMo uniquement (MTN ou Airtel au choix du patient).  
Aucune API externe requise — flux USSD initié depuis le téléphone du patient.

### 3.2 Renouvellement mensuel (OVP)

Déclenché automatiquement chaque mois via **Ordre de Virement Permanent (OVP)** bancaire.

**Calendrier de prélèvement — contexte Congo Brazzaville :**

> Les salaires congolais sont versés dans la fenêtre **25 du mois → 5 du mois suivant**.  
> Le prélèvement est planifié le **1er du mois suivant**, soit immédiatement après la fin  
> de la fenêtre de versement, pour maximiser le taux de succès.

| Événement | Date |
|-----------|------|
| Fenêtre salaires | 25 → 5 du mois suivant |
| Prélèvement OVP | **1er du mois** |
| Relance si échec | **5 du mois** |
| Délai de grâce | jusqu'au **10 du mois** |
| Suspension abonnement | **10 du mois** si toujours impayé |
| Notification WhatsApp | à chaque étape (relance + suspension) |

> **Date fixe pour tous les abonnés** — pas de date anniversaire individuelle.

---

## 4. CODES USSD — FLUX PATIENT

### 4.1 MTN MoMo

**Code raccourci direct (one-shot) :**

```
*105*6*503215*[MONTANT]#
```

Exemples par plan :
```
MOTO  → *105*6*503215*2000#
NDEKO → *105*6*503215*5000#
LIBOTA→ *105*6*503215*10000#
```

**Comportement bouton UI :**
```javascript
const code = `*105*6*503215*${montant}#`;
window.location.href = `tel:${encodeURIComponent(code)}`;
```
→ Le composeur téléphonique s'ouvre avec le code pré-rempli. Le patient valide avec son PIN. ✅

---

### 4.2 Airtel Money

**Flux multi-étapes (pas de raccourci one-shot) :**

| Étape | Action patient |
|-------|---------------|
| 1 | Composer `*128*3*3#` |
| 2 | Sélectionner **3** (Paiement marchand) |
| 3 | Entrer le numéro marchand : `057430079` |
| 4 | Entrer le montant (ex : `5000`) |
| 5 | Entrer le PIN |
| 6 | Confirmer avec `#OK` |

**Comportement bouton UI :**
```javascript
window.location.href = `tel:${encodeURIComponent('*128*3*3#')}`;
```
→ Ouvre le composeur sur `*128*3*3#`. Les étapes suivantes sont guidées par des instructions affichées à l'écran.

---

## 5. COMPOSANT UI — ÉTAPE PAIEMENT

À afficher dans **deux surfaces** :
1. `/register.html` — étape 5 (souscription initiale)
2. `patient/dashboard.html` — onglet **Abonnement** (renouvellement / upgrade)

### Structure du composant

```
┌─────────────────────────────────────────┐
│  Vous avez choisi : Plan NDEKO          │
│  Montant : 5 000 XAF / mois             │
├─────────────────────────────────────────┤
│  Choisir votre opérateur :              │
│                                         │
│  [ 🟡 MTN MoMo ]  [ 🔴 Airtel Money ]  │
└─────────────────────────────────────────┘
```

**Onglet MTN MoMo :**
```
Appuyez sur le bouton — votre téléphone composera
automatiquement le code de paiement.

[ Payer avec MTN MoMo → ]

Après paiement, entrez votre référence de transaction
ci-dessous pour confirmer.
[ ________________________ ] [ Valider ]
```

**Onglet Airtel Money :**
```
Suivez ces étapes sur votre téléphone :

  1. Composez *128*3*3#
  2. Sélectionnez 3 (Paiement marchand)
  3. Numéro marchand : 057430079
  4. Montant : 5 000 XAF
  5. Entrez votre PIN et confirmez

[ Ouvrir le menu Airtel → ]

Après paiement, entrez votre référence de transaction
ci-dessous pour confirmer.
[ ________________________ ] [ Valider ]
```

---

## 6. FLUX DE CONFIRMATION

L'activation de l'abonnement est **semi-manuelle** (phase initiale) :

```
Patient paie (MTN ou Airtel)
        ↓
Patient reçoit SMS de confirmation de l'opérateur
        ↓
Patient entre la référence de transaction dans l'UI
        ↓
Backend enregistre la référence en base (table subscriptions)
        ↓
Admin valide dans le dashboard admin → abonnement activé
        ↓
Notification WhatsApp de confirmation au patient
```

> **Évolution future :** Intégration API MTN Collections pour activation automatique quand le volume justifie la négociation d'un taux préférentiel.

---

## 7. BACKEND — TABLES IMPLIQUÉES

### Table `subscriptions` (à vérifier / compléter)

```sql
id                    SERIAL PRIMARY KEY
patient_id            INTEGER REFERENCES patients(id)
plan                  VARCHAR(10)  -- 'MOTO' | 'NDEKO' | 'LIBOTA'
amount_xaf            INTEGER      -- 2000 | 5000 | 10000
operator              VARCHAR(20)  -- 'MTN' | 'AIRTEL'
payment_reference     VARCHAR(100) -- référence SMS opérateur
status                VARCHAR(20)  -- 'pending' | 'active' | 'suspended' | 'expired'
start_date            DATE
next_billing_date     DATE         -- toujours le 1er du mois suivant
created_at            TIMESTAMP DEFAULT NOW()
validated_by          INTEGER REFERENCES users(id) -- admin qui valide
validated_at          TIMESTAMP
```

### Endpoints backend impliqués

| Méthode | Route | Rôle |
|---------|-------|------|
| `POST` | `/api/v1/subscriptions/initiate` | Enregistrer une demande de souscription |
| `POST` | `/api/v1/subscriptions/confirm` | Patient soumet sa référence de transaction |
| `PUT` | `/api/v1/admin/subscriptions/:id/validate` | Admin active l'abonnement |
| `GET` | `/api/v1/patient/subscription` | Patient consulte son abonnement actif |
| `POST` | `/api/v1/subscriptions/suspend` | Suspension automatique le 10 (cron job) |

---

## 8. CRON JOBS REQUIS

```
1er du mois → Déclencher prélèvement OVP + notifier admin
5  du mois → Relance WhatsApp patients en échec OVP
10 du mois → Suspendre abonnements toujours impayés + notifier patients
```

---

## 9. ÉTAT D'AVANCEMENT

| Composant | Statut |
|-----------|--------|
| `momo.routes.js` | ✅ Existe |
| `airtel.routes.js` | ✅ Existe |
| `airtel.service.js` | ✅ Existe |
| Credentials `.env` MTN | ⚠️ Non configurés |
| Credentials `.env` Airtel | ⚠️ Non configurés |
| UI étape 5 register | 🔴 À construire |
| UI onglet abonnement dashboard | 🔴 À construire |
| Cron jobs OVP | 🔴 À construire |
| Flux confirmation admin | 🔴 À construire |

---

## 10. DÉCISIONS STRATÉGIQUES ACTÉES

1. **Pas d'API MoMo en phase initiale** — flux USSD pur, zéro dépendance externe.
2. **Bolamu absorbe les frais marchands** — tarifs affichés nets pour le patient.
3. **Renégociation taux préférentiel** prévue quand le volume le justifie.
4. **OVP bancaire** pour les renouvellements — prélèvement le **1er du mois** (post fenêtre salaires).
5. **Canal agence prioritaire** — le self-service MoMo est complémentaire, pas principal.
6. **Activation semi-manuelle** en phase beta — automatisation complète en V2.

---

*Document maintenu par : Natsy Bouiti — NBA GESTION SARLU*  
*Dernière mise à jour : Juin 2026 — Calendrier OVP révisé (prélèvement 1er du mois)*  
*Prochaine révision : à l'activation des credentials API MTN Collections*
