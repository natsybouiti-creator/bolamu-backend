# AUDIT CONTRATS API BILATERAL

**Dernière mise à jour :** 1 juillet 2026

---

## INHOMOGÉNÉITÉS DE CONTRAT API À MIGRER

### /patients/subscription/upgrade (PATCH)
**Statut :** 🔴 NON CONFORME AU STANDARD

**Problèmes détectés :**
1. **Paramètre d'entrée :** Attend `nouveau_plan` (français) au lieu de `new_plan` (anglais)
2. **Format de réponse :** Renvoie directement les champs sans wrapper `data` :
   ```json
   {
     "success": true,
     "payment_required": true,
     "montant_du": 9933.33,
     "prorata": { ... },
     "coupon_applique": null
   }
   ```
   Au lieu du standard :
   ```json
   {
     "success": true,
     "data": {
       "payment_required": true,
       "amount_due": 9933.33,
       "prorata": { ... },
       "coupon_applied": null
     }
   }
   ```

**Impact :**
- Tests E2E doivent adapter les noms de champs (FR/EN)
- Frontend doit gérer deux formats différents
- Non conforme au standard Bolamu `{ success, data, message? }`

**Action requise :**
- Migrer le handler vers le standard `{ success, data }`
- Renommer les champs en anglais (`nouveau_plan` → `new_plan`, `montant_du` → `amount_due`, etc.)
- Migrer tous les appelants (frontend + tests) en même temps
- À traiter après BLOC 1

---

### /patients/subscription (GET)
**Statut :** ✅ CORRIGÉ (commit 286e85b)

**Problème corrigé :**
- Route dupliquée dans patient.routes.js (handler inline non conforme)
- Handler inline renvoyait `{ subscription }` au lieu de `{ data }`
- Suppression du handler inline, enrichissement du controller avec `next_billing_date` et support JWT

**Action effectuée :**
- Commit chirurgical : `fix(subscription): enrichir getSubscription (next_billing_date + phone JWT) + supprimer route /subscription dupliquee non conforme`
- Déployé en prod (Render Live)
- Validé par S02 (non-régression) et S03 étape 1 (format `{data}` conforme)

---

### /payments/momo/request (POST)
**Statut :** 🔴 NON CONFORME AU STANDARD

**Problèmes détectés :**
1. **URL incomplète :** Test appelait `/momo/request` au lieu de `/payments/momo/request` (manque le préfixe `/payments`)
2. **Paramètres d'entrée :** Handler attend `{ amount, plan }` mais test envoyait `{ amount, phone }`

**Impact :**
- Tests E2E doivent adapter l'URL complète
- Tests E2E doivent inclure le paramètre `plan` obligatoire
- Non conforme au contrat API documenté

**Action requise :**
- Documenter clairement l'URL complète dans les specs
- S'assurer que tous les tests incluent les paramètres requis (amount, plan)
- À traiter après BLOC 1

---

### /animateur/clubs/:id/notify (POST)
**Statut :** ✅ CORRIGÉ (1 juillet 2026)

**Problème corrigé :**
- Frontend envoyait `{ message }` mais backend attendait `{ message_type, params }`
- Handler retournait 400 systématiquement (message_type et params requis)
- Template WhatsApp attendu : `bolamu_club_message` avec params `[nom_club, message]`

**Action effectuée :**
- Correction de sendNotification() et sendClubNotif() dans public/animateur/dashboard.html
- Envoi maintenant `{ message_type: 'bolamu_club_message', params: [nom_club, message] }`
- Protocole test sendNotificationToClub() aligné sur le même format
- BUG-009 documenté dans docs/BUGS.md

---

## STATISTIQUES

- **Total incohérences :** 2
- **Corrigées :** 1
- **En attente :** 2 (/patients/subscription/upgrade, /payments/momo/request)
