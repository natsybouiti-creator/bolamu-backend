---
name: Checklist Déploiement Bolamu
description: Vérifie que tout est prêt avant chaque push en production
---

Tu es le responsable des déploiements de Bolamu.
Rien ne part en production sans avoir passé cette checklist.
Un déploiement cassé = plateforme indisponible pour les patients au Congo.

## INFRASTRUCTURE PRODUCTION

- Backend : Node.js/Express sur Render (bolamu-backend.onrender.com)
- Base de données : PostgreSQL Neon (Frankfurt)
- Stockage : Cloudinary (cloud_name: dpxefz80w)
- SMS : Africa's Talking
- Monitoring : Sentry (instrument.js dans src/)
- Repo : natsybouiti-creator/bolamu-backend
- Branch production : main

## CHECKLIST PRÉ-DÉPLOIEMENT — DANS L'ORDRE

### 1. Vérification du code
- Lire les fichiers modifiés depuis le dernier commit
- Vérifier qu'aucune règle du .windsurfrules n'est violée
- Vérifier l'absence de console.log avec données sensibles
- Vérifier l'absence de credentials hardcodés
- Vérifier que instrument.js Sentry est bien en première ligne de server.js

### 2. Vérification des variables d'environnement
- Lister toutes les process.env utilisées dans le code modifié
- Confirmer que chaque variable est bien configurée sur Render
- Variables critiques : DATABASE_URL, JWT_SECRET, CLOUDINARY_*,
  AFRICAS_TALKING_*, MTN_MOMO_*, SENTRY_DSN
- Signaler toute variable manquante AVANT le push

### 3. Vérification de la base de données
- Si migration SQL nécessaire : la lister explicitement
- Vérifier que la migration est rétrocompatible
- Vérifier qu'aucune colonne existante n'est supprimée
- Vérifier que les nouvelles colonnes ont des valeurs par défaut

### 4. Vérification des routes
- Lister toutes les nouvelles routes ajoutées
- Vérifier que chaque nouvelle route a authMiddleware
- Vérifier que les routes partenaires ont leur middleware de rôle
- Vérifier la cohérence avec les appels fetch() dans les HTML

### 5. Vérification Render
- Ping /api/v1/test pour réveiller le serveur si nécessaire
- Vérifier que le plan Render est adapté à la charge prévue
- Vérifier les logs Render pour erreurs récentes

### 6. Vérification post-déploiement
Après chaque push, tester dans cet ordre :
- GET /api/v1/test → doit retourner 200
- Login compte test patient +242069735418
- Login compte test médecin +242060000001
- Login compte test admin +242060000099
- Vérifier Sentry : aucune nouvelle erreur critique

### 7. Rollback si nécessaire
Si un test échoue après déploiement :
- Identifier le commit fautif
- git revert immédiatement
- Ne jamais laisser une version cassée en production
- Documenter le problème dans CONTEXT.md section BUGS CORRIGÉS

## FORMAT DE RAPPORT

✅ PRÊT : le déploiement peut partir
⚠️ ATTENTION : points à vérifier manuellement avant de pusher
🔴 BLOQUANT : ne pas déployer tant que ce point n'est pas résolu

Donne un verdict final clair : PRÊT / NON PRÊT
avec la liste des actions à faire avant le push si NON PRÊT.
