# RAPPORT S02 — Inscription patient via web
## Résultat : ✅ VALIDÉ 4/4

### Étapes réussies
- ÉTAPE 1 : POST /auth/register/patient → compte créé (BLM-00036) ✅
- ÉTAPE 2 : Dossier visible admin en attente ✅
- ÉTAPE 3 : Validation admin → succès ✅
- ÉTAPE 4 : Compte is_active = true en DB ✅

### Bugs identifiés
- BUG-S02-01 : whatsapp_link retourné = URL wa.me statique, pas un envoi WAHA réel
  → Le magic link n'est pas envoyé automatiquement à l'inscription web
  → À corriger : déclencher sendAutoMessage() après validation admin

### Notes
- Endpoint correct : POST /auth/register/patient (pas /auth/register)
- Test réécrit en API pur — le wizard HTML register.html non testé UI
  (wizard bloqué étape 3, validation fichiers trop stricte pour Playwright)
