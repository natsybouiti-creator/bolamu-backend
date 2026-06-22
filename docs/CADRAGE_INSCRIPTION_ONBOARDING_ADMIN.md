# CADRAGE — INSCRIPTION, ONBOARDING & ADMIN (v2 — audit approfondi)
**Date** : 22 juin 2026  
**Type** : Audit lecture seule — aucune modification  
**Fichiers inspectés** : `auth.controller.js`, `auth.routes.js`, `agence.routes.js`, `admin.routes.js`, `payment.routes.js`, `upload.routes.js`, `auth.middleware.js`, `notification.service.js`, `prescription.controller.js`, `jobs/abonnement.job.js`, `utils/sendOnboardingLink.js`, `utils/cloudinary.js`

---

## 1. REGISTER PATIENT — FLUX COMPLET

### 1.a Formulaire → OTP → création compte → photo → CGU

| Étape | Route | Méthode | Table | Colonne | Statut |
|---|---|---|---|---|---|
| Demande OTP | `POST /api/v1/auth/request-otp` | POST | `otp_codes` | phone, hashed_otp, expires_at, attempts | ✅ CÂBLÉ |
| Vérification OTP | `POST /api/v1/auth/verify-otp` | POST | `otp_codes` | DELETE si valide, UPDATE attempts sinon | ✅ CÂBLÉ |
| Upload document pré-inscription | `POST /api/v1/upload/token` puis `POST /api/v1/upload/secure` | POST×2 | `documents` | owner_id=NULL, uploaded_by=phone, storage_path=URL Cloudinary | ✅ CÂBLÉ |
| Création compte | `POST /api/v1/auth/register/patient` | POST | `users` + `documents` | Tous les champs (voir §1.b) | ✅ CÂBLÉ |
| CGU acceptée | idem | POST | `users` | cgu_accepted, cgu_accepted_at | ✅ stocké en base |
| Notification bienvenue | (asynchrone post-register) | — | — | WhatsApp template `bolamu_bienvenue_patient_v4` | ⚠️ PARTIEL |
| Envoi mot de passe | (asynchrone post-register) | — | — | WhatsApp template `bolamu_code_acces` | ❌ BLOQUÉ (Meta) |
| Magic link onboarding | `sendOnboardingLink()` | — | `users` | onboarding_token, onboarding_token_expires_at | ✅ CÂBLÉ |

---

### 1.b OTP vérifié AVANT création du compte ?

**OUI — techniquement séquencé, mais sans verrou backend.**

- `POST /auth/verify-otp` et `POST /auth/register/patient` sont deux routes indépendantes.
- Le backend ne délivre aucun jeton de session post-OTP à passer dans le register.
- Un attaquant qui connaît l'API peut appeler directement `/register/patient` sans passer par `/verify-otp`.
- Le seul garde-fou est côté frontend (orchestration séquentielle dans le formulaire).

**Verdict** : OTP vérifié avant création dans le flux normal, mais **non enforced côté backend**.

---

### 1.c La photo est-elle uploadée et stockée ?

**Deux chemins, les deux fonctionnels :**

| Chemin | Mécanisme | Stockage |
|---|---|---|
| **Pré-upload avant register** | `POST /api/v1/upload/secure` → Cloudinary (mode `authenticated`) → INSERT `documents` avec `storage_path = secure_url` | ✅ `documents.storage_path` (URL Cloudinary) |
| **photoData inline dans register** | base64 dans le body → Cloudinary via `uploadToCloudinary()` → `users.photo_url` | ✅ `users.photo_url` (URL Cloudinary) |

⚠️ Le service upload (`upload.routes.js`) n'a **pas de fileFilter** — n'importe quel type MIME est accepté (seule limite : 5MB). Risque : upload de fichiers non-images/PDF.

---

### 1.d Le compte est-il actif immédiatement ?

**NON — `is_active = false` à la création.**

`registerPatient()` controller ligne 260 :
```js
is_active, trust_score, password_hash  // is_active est hardcodé false
```
Valeur : `false`.

**PROBLÈME** : le JWT émis immédiatement après register contient `is_active: false`. L'`authMiddleware` (ligne 27) bloque toute requête avec ce JWT :
```js
if (decoded.is_active === false) {
    return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu.' });
}
```
→ Un patient nouvellement inscrit ne peut donc PAS appeler de routes authentifiées tant que son abonnement n'est pas activé.

**Cohérence avec CONTEXT.md** : CONTEXT.md §INSCRIPTION PATIENTS dit `is_active = true immédiatement après inscription (pas de validation admin requise)`. Le code dit le contraire. C'est une ambiguïté de spec que le P0 va trancher : `is_active = false` jusqu'au premier paiement confirmé (nouveau comportement délibéré).

---

## 2. ONBOARDING POST-INSCRIPTION

### 2.a Flux onboarding distinct ou intégré ?

**Il existe un magic link distinct**, mais PAS de flux onboarding multi-étapes.

| Route | Méthode | Table | Comportement |
|---|---|---|---|
| `GET /api/v1/auth/onboarding/:token` | GET | `users` | Vérifie token, invalidation usage unique, émet JWT valide 15min |

**Ce que fait le magic link :**
1. Lit `users WHERE onboarding_token = $1`
2. Vérifie expiration `onboarding_token_expires_at`
3. SET `onboarding_token = NULL`, `onboarding_token_expires_at = NULL`, `first_login_done = TRUE`
4. INSERT `audit_log` (`event_type = 'auth.onboarding_login'`)
5. Retourne JWT + user data

**`first_login_done`** : correctement géré, mis à TRUE à l'usage du magic link. ✅

### 2.b Étapes onboarding (profil complet, abonnement, tutoriel)

**AUCUNE route d'onboarding multi-étapes n'existe.**

| Étape supposée | Route | Statut |
|---|---|---|
| Complétion profil guidée | MANQUANT | ❌ INEXISTANT |
| Choix plan d'abonnement | `GET /api/v1/agence/plans-config` (agent uniquement) | ❌ pas accessible patient |
| Tutoriel interactif | MANQUANT | ❌ INEXISTANT |
| Premier paiement onboarding | `POST /api/v1/payments/initiate` | ✅ (route générique, pas spécifique onboarding) |

**Décision de design assumée** : l'onboarding est implicite — le dashboard guide l'utilisateur. Pas de table `onboarding_steps`.

---

## 3. INSCRIPTION VIA AGENT

### 3.a `POST /agence/souscrire-complet` — persistance complète ?

| Vérification | Résultat |
|---|---|
| Photo uploadée Cloudinary ? | ✅ OUI — `photoData` base64 → Cloudinary → `users.photo_url` |
| Compte créé en base ? | ✅ OUI — INSERT `users` dans transaction BEGIN/COMMIT |
| Abonnement créé ? | ✅ OUI — INSERT `subscriptions` (status='active', expires_at+1 mois) |
| `member_code` généré ? | ✅ OUI — MAX()+1 sur `BLM-XXXXX` |
| Mot de passe temporaire ? | ✅ Généré + bcrypt, stocké dans `users.password_hash` |
| Envoi WhatsApp ? | ⚠️ Tenté (non bloquant) — `bolamu_code_acces` bloqué Meta |
| Magic link onboarding ? | ✅ OUI — `sendOnboardingLink()` appelé après COMMIT |
| audit_log ? | ✅ OUI — `event_type='agent.souscription_complete'` |
| ROLLBACK sur erreur ? | ✅ OUI |

**Verdict : persiste vraiment. ✅**

---

### 3.b `POST /agence/import-employes` — comptes liés à une company ?

| Vérification | Résultat |
|---|---|
| Comptes créés en base ? | ✅ OUI — INSERT `users` (individuel) |
| Abonnements créés ? | ✅ OUI — INSERT `subscriptions` |
| Lien `company_id` ? | ❌ ABSENT — aucun `company_id` dans le payload ni dans l'INSERT |
| Lien `company_contract_id` ? | ❌ ABSENT |
| INSERT `company_employees` ? | ❌ ABSENT |
| Photo gérée ? | ❌ ABSENT — aucun champ photo dans import CSV |
| Colonne `site` du CSV ? | ❌ NON LUE — ignorée dans le code |

**Verdict : enrôlement individuel en lot, pas un vrai B2B. ❌**

---

### 3.c 3 jeux de tarifs — source de vérité unique ?

**Backend : source unique = `platform_config`. ✅**

Toutes les routes agence (`/souscrire`, `/souscrire-complet`, `/import-employes`, `/plans-config`) lisent `platform_config.price_${plan}`. Aucune valeur hardcodée côté backend.

**Frontend : fallback hardcodé dangereux.** Si `GET /agence/plans-config` échoue, le UI affiche `15 000 / 35 000 / 70 000 FCFA` (valeurs fausses). Côté backend, le prix est recalculé depuis `platform_config` donc la facturation reste correcte même si l'affichage est faux.

---

### 3.d Réclamations — routes réelles ou FANTÔMES ?

| Action | Route backend | Statut |
|---|---|---|
| Réactiver compte | MANQUANT | ❌ FANTÔME |
| Changer de formule | MANQUANT | ❌ FANTÔME |
| Corriger une information | MANQUANT | ❌ FANTÔME |
| Signaler un problème | MANQUANT | ❌ FANTÔME |

`ouvrirActionModal()` dans le dashboard agent affiche un texte statique "sera connecté au module… contactez l'administrateur". **Aucun appel API.** 4/4 fantômes.

---

## 4. VALIDATION ADMIN

### 4.a Actions de validation — routes + tables modifiées

| Action | Route | Méthode | Tables modifiées | Statut |
|---|---|---|---|---|
| Valider médecin/pharmacie/labo | `POST /api/v1/admin/validate-user` | POST | `users` (is_active=true, validated_at) + table spécifique (is_active=true, status='verified') | ✅ |
| Rejeter | `POST /api/v1/admin/reject-user` | POST | `users` + table spécifique (status='rejected') | ✅ |
| Suspendre | `POST /api/v1/admin/suspend-user` | POST | `users` (banned=true) + table spécifique (status='suspended') | ✅ |
| Bannir | `POST /api/v1/admin/ban-user` | POST | `users` (banned=true, is_active=false, banned_at=NOW()) + table spécifique (status='banned') | ✅ |
| Toggle is_active | `PATCH /admin/users/:phone/toggle` | PATCH | `users` + table spécifique | ✅ |
| Unban | `PATCH /admin/users/:phone/unban` | PATCH | `users` (is_active=true, banned=false, ban_reason=NULL) | ✅ |
| Réhabiliter médecin | `PATCH /admin/doctors/:phone/rehabilitate` | PATCH | `users` + `doctors` (is_active=true, status='verified') | ✅ |
| Suspendre pour fraude | `PATCH /admin/fraud/:id/suspend` | PATCH | `users` + toutes tables spécifiques | ✅ |

**Validation patient** : non nécessaire pour l'inscription (patient devient is_active=false en attendant le paiement selon le nouveau modèle P0). La validation admin ne concerne que les partenaires.

### 4.b Bannissement — colonnes banned/ban_reason/banned_at

- `users.banned = TRUE` ✅
- `users.ban_reason = TEXT` ✅
- `users.banned_at = NOW()` ✅ (dans ban-user et fraud/suspend)

**Note** : `suspend-user` met `banned=true` mais ne met pas `banned_at`. Légère incohérence.

### 4.c Upload documents professionnels — stockés où ?

**Deux chemins qui se rejoignent :**

| Canal | Mécanisme | Stockage |
|---|---|---|
| Formulaire register (pre-upload) | `POST /upload/token` + `POST /upload/secure` → Cloudinary authenticated → INSERT `documents` | `documents.storage_path` = URL Cloudinary |
| Champ `document_file_id` dans register body | Cloudinary public_id stocké en JSONB dans `users.documents_file_ids` | `users.documents_file_ids` = `{ "diploma": "...", "ordre": "..." }` |

Les deux coexistent. L'admin voit les documents via `GET /api/v1/admin/documents` (admin-docs.routes.js) qui lit la table `documents`.

### 4.d SELECT * exposant password_hash — encore présent ?

**NON — corrigé. ✅**

`admin.routes.js` utilise `USER_SAFE_COLS` (liste explicite sans password_hash) pour `/admin/users/:phone/profile`.

⚠️ Exception mineure : `SELECT * FROM doctors WHERE phone=$1` (ligne 483) — retourne toutes les colonnes de `doctors`, qui ne contient pas `password_hash` (il est dans `users`). Pas de fuite, mais pattern à éviter.

---

## 5. UPLOAD DOCUMENTS (transversal)

| Aspect | Comportement | Statut |
|---|---|---|
| Service upload | `POST /api/v1/upload/token` (JWT 30min) + `POST /api/v1/upload/secure` (multer → Cloudinary) | ✅ |
| URL persistante en base | `documents.storage_path = result.secure_url` (Cloudinary HTTPS) | ✅ |
| Validation taille | 5MB max (multer limits) | ✅ |
| Validation type MIME | ❌ ABSENT dans `upload.routes.js` — tout type accepté | ⚠️ |
| Cloudinary mode | `authenticated` (URLs signées, non publiques) | ✅ Sécurisé |
| Fonctionne en production Render ? | ✅ OUI — Cloudinary est hébergé en cloud, indépendant de Render | ✅ |

---

## 6. BUGS CRITIQUES IDENTIFIÉS (P0 — cassent prod)

### Bug 1 — SQL invalide : UPDATE ... ORDER BY ... LIMIT (PostgreSQL)

**Fichier** : `src/services/notification.service.js` lignes 64-69

```js
await pool.query(`
    UPDATE notifications 
    SET canal = $1, sent_at = NOW() 
    WHERE user_phone = $2 AND type = $3 AND sent_at IS NULL
    ORDER BY created_at DESC LIMIT 1
`, [sentChannels[0] || 'sms', user_phone, type]);
```

**Problème** : PostgreSQL ne supporte pas `ORDER BY` ni `LIMIT` directement dans un `UPDATE`. Cette syntaxe est valide en MySQL uniquement. Ce SQL lève une `SyntaxError` côté PostgreSQL à chaque appel de `notify()`.

**Impact** : toutes les notifications passent par `notify()` → toutes les notifications en DB sont cassées silencieusement (l'UPDATE échoue mais `notify()` ne re-lève pas l'erreur car l'INSERT initial a déjà eu lieu).

---

### Bug 2 — audit_log : colonnes obligatoires manquantes dans deliverPrescription

**Fichier** : `src/controllers/prescription.controller.js` lignes 163-167

```js
await pool.query(
    `INSERT INTO audit_log (event_type, actor_phone, payload)
     VALUES ('prescription_delivered', $1, $2::jsonb)`,
    [pharmacie_phone, JSON.stringify({...})]
);
```

**Problème** : les colonnes `target_table` et `target_id` sont manquantes. Si ces colonnes ont une contrainte NOT NULL en base (comme défini dans CONTEXT.md), l'INSERT échoue → erreur 500 silencieuse à chaque délivrance.

---

### Bug 3 — payment/confirm ne met pas users.is_active = true

**Fichier** : `src/routes/payment.routes.js` `POST /payments/confirm/:reference`

Après confirmation paiement, le code crée un INSERT dans `subscriptions` (is_active=TRUE) mais **ne met pas à jour `users.is_active`**. Le patient reste bloqué (`is_active=false`) même après paiement confirmé.

---

### Bug 4 — Cron abonnement : expiration limitée à canal_paiement = 'momo_annuel'

**Fichier** : `src/jobs/abonnement.job.js` lignes 74-99

```sql
WHERE s.canal_paiement = 'momo_annuel'
AND s.statut_collecte = 'actif'
AND s.expires_at < NOW()
```

Les abonnements mensuels standard (sans `canal_paiement = 'momo_annuel'`) ne sont jamais expirés par le cron. Les utilisateurs dont l'abonnement mensuel expire restent `is_active = true` indéfiniment.

---

## 7. TABLEAU RÉCAPITULATIF — VERDICT PAR SYSTÈME

| Système | Fonctionnel | Lacunes |
|---|---|---|
| **OTP** | ✅ Câblé | OTP simulé (pas WhatsApp réel), pas de token post-OTP liant à register |
| **Register patient** | ✅ Câblé | is_active=false à l'inscription (intentionnel P0) |
| **Register partenaires** | ✅ Câblé | Aucune lacune critique |
| **Upload documents** | ✅ Câblé | Pas de validation MIME dans upload.routes.js |
| **Magic link onboarding** | ✅ Câblé | first_login_done correctement géré |
| **Souscription agent (complet)** | ✅ Câblé | — |
| **Import employes** | ⚠️ Partiel | Pas de company_id / company_contract_id |
| **Tarifs** | ✅ Source unique (backend) | Fallback frontend faux (cosmétique) |
| **Réclamations agent** | ❌ 4 FANTÔMES | Aucune route backend |
| **Validation admin** | ✅ Câblé | — |
| **Bannissement** | ✅ Câblé | suspend-user ne pose pas banned_at |
| **Password_hash exposé** | ✅ Corrigé | — |
| **Paiement → is_active** | ❌ MANQUANT | payment/confirm n'active pas users.is_active |
| **Cron expiration** | ⚠️ Partiel | Seul momo_annuel expiré, pas les mensuel |
| **notification.service.js SQL** | ❌ BUG PROD | UPDATE ORDER BY LIMIT invalide PostgreSQL |
| **audit_log deliverPrescription** | ❌ BUG PROD | Colonnes target_table/target_id manquantes |

---

## 8. CORRECTIONS À APPLIQUER (classées P0 → P2)

### P0 — Règle métier is_active (4 corrections)
1. `registerPatient()` → `is_active = false` (**déjà le cas** — pas de changement ici)
2. `POST /payments/confirm/:reference` → ajouter `UPDATE users SET is_active = TRUE WHERE phone = $1` après activation abonnement
3. Cron `abonnement.job.js` → étendre la requête d'expiration à TOUS les abonnements expirés (pas seulement `momo_annuel`)
4. `auth.controller.js` `login()` → vérifier `is_active` après le check bcrypt et retourner un message clair si false : *"Votre abonnement n'est pas actif. Veuillez souscrire pour accéder à la plateforme."*

### P0 — Bugs prescription (2 corrections)
5. `notification.service.js` → corriger UPDATE avec sous-requête PostgreSQL
6. `prescription.controller.js` `deliverPrescription()` → ajouter `target_table` et `target_id` dans audit_log INSERT

### P1 — Sécurité prescription (1 correction)
7. `prescription.routes.js` → ajouter `requireDoctor` sur `POST /create`

### P1 — Notifications prescription (2 corrections)
8. `notification.service.js` → ajouter type `'prescription_creee'` dans `contentMap` + `templateMap`
9. `prescription.controller.js` `deliverPrescription()` → appeler `notify(patient_phone, 'prescription_delivree', {...})`

### P2 — Réclamations agent (4 routes + 4 boutons frontend)
10. `agence.routes.js` → créer 4 routes : réactiver compte, changer formule, corriger info, signaler problème
11. `public/agence/dashboard.html` → câbler les 4 boutons

### P2 — Import B2B
12. `agence.routes.js` `/import-employes` → ajouter `company_contract_id` si fourni dans le payload + INSERT `company_employees`
