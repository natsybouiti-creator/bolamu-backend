# CADRAGE — FLUX PRESCRIPTION (inter-rôles)
**Date** : 22 juin 2026  
**Type** : Audit lecture seule — aucune modification  
**Fichiers inspectés** : `src/routes/prescription.routes.js`, `src/controllers/prescription.controller.js`, `src/services/notification.service.js`, `CONTEXT.md`

---

## VERDICT GLOBAL

**OUI — le flux est câblable de bout en bout aujourd'hui.**  
Toutes les routes existent et sont implémentées. Il reste deux lacunes : la notification de délivrance vers le patient n'est pas câblée, et il n'y a pas d'insertion dans `zora_ledger` pour récompenser l'acte santé.

---

## 1. FLUX VERTICAL — MAILLON PAR MAILLON

### a. Médecin crée une prescription

| Élément | Valeur |
|---|---|
| **Route** | `POST /api/v1/prescriptions/create` |
| **Méthode** | POST |
| **Middleware** | `authMiddleware` (JWT requis — tout rôle authentifié) |
| **Fichier** | `prescription.routes.js` ligne 14 → `prescription.controller.js` `createPrescription()` |
| **Tables écrites** | `prescriptions` (INSERT) |
| **Colonnes insérées** | `appointment_id`, `patient_phone`, `doctor_phone`, `medications`, `instructions`, `status='active'`, `session_code` |
| **Champs obligatoires** | `patient_phone`, `doctor_phone`, `medications` |
| **Champ optionnel** | `appointment_id` (si fourni, récupère le `session_code` depuis `appointments`) |
| **Guard doublon** | SELECT sur `prescriptions WHERE appointment_id = $1 AND status = 'active'` — retourne 409 si une ordonnance active existe déjà pour ce RDV |

⚠️ **Lacune sécurité** : le middleware `authMiddleware` ne filtre pas par rôle `doctor`. N'importe quel utilisateur authentifié peut appeler cette route. Il manque un guard `requireDoctor`.

---

### b. Notification vers le patient — déclenchée automatiquement ?

**Oui, déclenchée automatiquement** — mais de façon asynchrone et incomplète.

Dans `createPrescription()` (controller lignes 55-73) :

```js
setImmediate(async () => {
    const { notify } = require('../services/notification.service');
    await notify(patient_phone, 'message_recu', {
        message: `Votre ordonnance Bolamu est disponible...`
    });
    buildWameLink(patient_phone, 'ordonnance_creee', { ... });
});
```

| Canal | Comportement réel |
|---|---|
| **Table `notifications`** | ✅ INSERT effectué via `notify()` → `notification.service.js` ligne 17 |
| **WhatsApp template** | ❌ Le type `'message_recu'` n'a **pas** de mapping dans `templateMap` → `getWhatsAppTemplate()` retourne `null` → le template ne part pas |
| **Push** | ✅ Tentative si `push_subscriptions` active pour ce patient |
| **Wame link** | `buildWameLink()` construit un lien wa.me mais **ne l'envoie pas** (pas d'appel `sendWhatsAppTemplate`) |

**À câbler** : ajouter `'prescription_creee'` dans `contentMap` et `templateMap` de `notification.service.js`, avec appel direct à `sendWhatsAppTemplate()` et un template Meta approuvé.

---

### c. Patient lit ses prescriptions

| Élément | Valeur |
|---|---|
| **Route** | `GET /api/v1/prescriptions/patient/:phone` |
| **Méthode** | GET |
| **Middleware** | `authMiddleware` |
| **Fichier** | `prescription.routes.js` ligne 26 → `getPrescriptionsByPatient()` |
| **Tables lues** | `prescriptions` + LEFT JOIN `appointments` (session_code, date) + LEFT JOIN `doctors` (nom, spécialité) |
| **Filtre** | `WHERE p.patient_phone = $1` |
| **Résultat** | Toutes les prescriptions du patient, triées par `created_at DESC` |
| **Statut** | ✅ CÂBLÉ |

⚠️ **Point d'attention** : `phone` est passé en **path param** (`:phone`). Règle CONTEXT.md §27 : le `+` dans un path param pose problème. Le frontend doit utiliser `encodeURIComponent(phone)` ou la route doit migrer en query param `?phone=`.

---

### d. Pharmacie voit l'ordonnance — route + filtre

**Route de scan QR (principale) :**

| Élément | Valeur |
|---|---|
| **Route** | `GET /api/v1/prescriptions/by-session/:code` |
| **Méthode** | GET |
| **Middleware** | `authMiddleware` |
| **Fichier** | `prescription.routes.js` ligne 17 → `getPrescriptionBySession()` |
| **Tables lues** | `prescriptions` + LEFT JOIN `appointments` + LEFT JOIN `doctors` |
| **Filtre** | `WHERE (a.session_code = $1 OR p.session_code = $1) AND p.status = 'active'` |
| **Résultat** | Une seule ordonnance active (LIMIT 1) avec nom médecin, spécialité, date RDV |
| **Statut** | ✅ CÂBLÉ |

**Route historique délivrances (secondaire) :**

| Élément | Valeur |
|---|---|
| **Route** | `GET /api/v1/prescriptions/pharmacie/:phone` |
| **Méthode** | GET |
| **Filtre** | `WHERE p.pharmacie_phone = $1` — ordonnances délivrées par cette pharmacie |
| **Statut** | ✅ CÂBLÉ |

**Mécanisme d'accès** : la pharmacie scanne le QR code du patient (qui contient le `session_code`) et appelle `/by-session/:code`. Pas de vérification que l'appelant est bien une pharmacie (`requirePharmacie` absent) — lacune mineure.

---

### e. Pharmacie délivre — route + changement d'état

| Élément | Valeur |
|---|---|
| **Route** | `POST /api/v1/prescriptions/deliver` |
| **Méthode** | POST |
| **Middleware** | `authMiddleware` |
| **Fichier** | `prescription.routes.js` ligne 20 → `deliverPrescription()` |
| **Champs requis** | `prescription_id`, `pharmacie_phone` |
| **Tables modifiées** | `prescriptions` : UPDATE `status='delivered'` + `pharmacie_phone` + `delivered_at=NOW()` |
| **Guard anti-rejeu** | Vérifie `status === 'delivered'` → 409 si déjà délivrée |
| **audit_log** | ✅ INSERT `event_type='prescription_delivered'`, actor=pharmacie_phone |
| **Statut** | ✅ CÂBLÉ |

⚠️ **Lacune** : après la délivrance, **aucune notification n'est envoyée** au patient ni au médecin. À câbler : `notify(patient_phone, 'prescription_delivree', {...})`.

---

## 2. ÉVÉNEMENTS INTER-RÔLES

| Événement | Déclenché ? | Table cible | Détail |
|---|---|---|---|
| **audit_log — délivrance** | ✅ OUI | `audit_log` | `event_type='prescription_delivered'`, acteur=pharmacie |
| **notifications — création** | ⚠️ PARTIEL | `notifications` | INSERT OK en base, mais template WhatsApp ne part pas (type non mappé) |
| **notifications — délivrance** | ❌ MANQUANT | `notifications` | Aucun appel `notify()` dans `deliverPrescription()` |
| **zora_ledger — acte santé** | ❌ MANQUANT | `zora_ledger` | Retrait d'ordonnance non récompensé en Zora Points |
| **health_records** | ❌ MANQUANT | `health_records` | Prescription non intégrée dans le BHP v1.2 |

---

## 3. SCHÉMA TABLE `prescriptions` — COLONNES RÉELLES

| Colonne | Type | Remarque |
|---|---|---|
| `id` | SERIAL | PK |
| `appointment_id` | INTEGER | FK → appointments.id (nullable) |
| `patient_phone` | VARCHAR | Identifiant universel patient |
| `doctor_phone` | VARCHAR | Identifiant universel médecin |
| `medications` | TEXT/JSONB | Contenu ordonnance |
| `instructions` | TEXT | Nullable |
| `status` | VARCHAR | `'active'` → `'delivered'` |
| `session_code` | VARCHAR | Copié depuis appointments à la création |
| `pharmacie_phone` | VARCHAR | Rempli lors de `/deliver` |
| `delivered_at` | TIMESTAMP | Rempli lors de `/deliver` |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | ⚠️ Dette P2-DB-09 — migration vers WITH TIME ZONE planifiée |

---

## 4. LACUNES À COMBLER (classées par priorité)

| # | Lacune | Sévérité | Action |
|---|---|---|---|
| 1 | `requireDoctor` absent sur `POST /create` | 🔴 HAUT | Ajouter guard rôle dans `prescription.routes.js` |
| 2 | `requirePharmacie` absent sur `/by-session` et `/deliver` | 🟠 MOYEN | Ajouter guard rôle |
| 3 | Template WhatsApp `prescription_creee` manquant dans `notification.service.js` | 🟠 MOYEN | Ajouter dans `contentMap` + `templateMap` + template Meta |
| 4 | Notification de délivrance vers patient absente | 🟠 MOYEN | Appeler `notify()` dans `deliverPrescription()` |
| 5 | `phone` en path param (risque `+` URL) | 🟡 MINEUR | Vérifier encodage frontend ou migrer en query param |
| 6 | Pas d'entrée `zora_ledger` pour l'acte santé | 🟡 MINEUR | Appeler `awardZora()` à la délivrance |
| 7 | Prescription non intégrée dans `health_records` BHP | 🟡 MINEUR | À décider selon roadmap BHP v1.2 |
| 8 | `created_at` TIMESTAMP WITHOUT TIME ZONE | 🟡 MINEUR | Migration dédiée planifiée — ne pas mélanger |

---

## 5. SÉQUENCE COMPLÈTE — ÉTAT ACTUEL

```
MÉDECIN
  └─ POST /api/v1/prescriptions/create
       ├─ [prescriptions] INSERT status='active'   ✅
       ├─ [notifications] INSERT (asynchrone)      ✅
       └─ WhatsApp template                        ❌ ne part pas (type non mappé)

PATIENT
  └─ GET /api/v1/prescriptions/patient/:phone      ✅ lit ses ordonnances
       └─ Récupère session_code pour donner à la pharmacie

PHARMACIE
  └─ GET /api/v1/prescriptions/by-session/:code    ✅ voit l'ordonnance active
  └─ POST /api/v1/prescriptions/deliver
       ├─ [prescriptions] UPDATE → 'delivered'     ✅
       ├─ [audit_log] INSERT                       ✅
       └─ Notification patient                     ❌ absente
```

---

## VERDICT FINAL

**Flux câblable de bout en bout : OUI.**

Les 5 routes sont présentes, écrivent en base et lisent correctement. Le flux médecin → patient → pharmacie fonctionne. Les lacunes identifiées (guards de rôle, template WhatsApp notification, notification de délivrance) sont des améliorations de sécurité et d'expérience, pas des bloquants fonctionnels.
