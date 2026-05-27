# BOLAMU — RAPPORT SPRINT 7
**Date :** 20 mai 2026  
**Objectif :** Notifications push web (FCM) + WhatsApp Business API

---

## RÉSUMÉ EXÉCUTIF

Le Sprint 7 a enrichi l'expérience utilisateur post-lancement avec un système de notifications unifié intégrant Web Push API (FCM) et WhatsApp Business API. Le système permet d'envoyer des notifications via trois canaux (WhatsApp → Push → SMS) avec une priorité automatique et une gestion non-bloquante pour ne jamais impacter l'UX principal.

**Composants créés :**
- Schéma notifications (push_subscriptions + notifications)
- Service push notifications (Web Push API avec VAPID)
- Service WhatsApp Business (templates + webhook)
- Service notification unifié (canal intelligent + fallback)
- Routes notifications (subscribe, list, read, webhook)
- Skill Windsurf notifications
- Rapport Sprint 7

---

## DÉTAIL DES TÂCHES

### TÂCHE 1 — Schéma Notifications (migration_023)

**Fichiers créés :**
- `database/migration_023_notifications.sql`
- `scripts/run_migration_023.js`

**Tables créées :**
- **push_subscriptions** : Abonnements Web Push API pour notifications push
  - user_phone, endpoint, p256dh, auth, device_type, is_active, created_at
  - UNIQUE(user_phone, endpoint)

- **notifications** : Historique des notifications envoyées
  - user_phone, type, titre, message, data, canal, is_read, sent_at, read_at, created_at
  - Types : rdv_confirme, rdv_rappel, rdv_annule, paiement_recu, abonnement_expire, abonnement_renouvele, conflit_update, message_recu, alerte_systeme, whatsapp_message
  - Canaux : push, whatsapp, sms, email

**Index ajoutés :**
- idx_notifications_user ON notifications(user_phone)
- idx_notifications_read ON notifications(user_phone, is_read)
- idx_push_subscriptions_user ON push_subscriptions(user_phone)

**Migration exécutée :** ✅ Succès

---

### TÂCHE 2 — Service Notifications Push (FCM)

**Fichiers créés :**
- `src/services/push.service.js`

**Fichiers modifiés :**
- `package.json` (ajouté web-push)
- `.env.example` (ajouté VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
- `src/server.js` (ajouté configurePush au démarrage)

**Fonctionnalités implémentées :**
- configurePush() → web-push.setVapidDetails (appel au démarrage du serveur)
- subscribe(user_phone, { endpoint, p256dh, auth, device_type }) → Upsert dans push_subscriptions
- unsubscribe(user_phone, endpoint) → is_active = false (soft delete)
- sendToUser(user_phone, { titre, message, type, data }) → Envoi à toutes les subscriptions actives du user
- sendToAll(titre, message, type) → Envoi par batch de 100 (alertes système, maintenances)

**Dépendances installées :**
- web-push

**Variables d'environnement ajoutées :**
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- Commande génération : npx web-push generate-vapid-keys

---

### TÂCHE 3 — Service WhatsApp Business

**Fichiers créés :**
- `src/services/whatsapp.service.js`

**Fichiers modifiés :**
- `.env.example` (ajouté WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN)

**Fonctionnalités implémentées :**
- sendMessage(phone, templateName, parameters) → Appel API WhatsApp Business Cloud (Meta)
  - URL : https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_ID}/messages
  - Auth : Bearer WHATSAPP_ACCESS_TOKEN
  - Format message : template avec langue fr
  - En dev : logger sans envoyer
  - INSERT dans notifications avec canal='whatsapp'

- Templates WhatsApp implémentés :
  - rdv_confirmation : "Bonjour {nom}, votre RDV avec Dr {medecin} est confirmé pour le {date} à {heure}."
  - paiement_confirme : "Bolamu : Paiement de {montant} FCFA reçu. Abonnement {plan} actif jusqu'au {date}."
  - rappel_rdv : "Rappel Bolamu : RDV demain avec Dr {medecin} à {heure}. Code accès : {code}"
  - abonnement_expire : "Votre abonnement Bolamu expire dans 3 jours. Renouvelez sur l'application."

- handleWebhook(body) → Traiter les messages entrants WhatsApp
  - Logger dans notifications
  - Répondre avec statut 200 immédiatement

- verifyWebhook(mode, token, challenge) → Vérification webhook WhatsApp (GET)

**Variables d'environnement ajoutées :**
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_ID
- WHATSAPP_VERIFY_TOKEN

---

### TÂCHE 4 — Service Notification Unifié

**Fichiers créés :**
- `src/services/notification.service.js`

**Fichiers modifiés :**
- `src/jobs/abonnement.job.js` (ajouté notifications abonnement expirant J-3)

**Fonctionnalités implémentées :**
- notify(user_phone, type, data) → Fonction centrale unique
  - Déterminer les canaux selon les préférences user et disponibilité du service
  - Canal prioritaire : WhatsApp si WHATSAPP_ACCESS_TOKEN présent
  - Canal secondaire : Push si subscription active
  - Canal fallback : SMS (Africa's Talking — toujours disponible)
  - Toujours insérer dans table notifications
  - Jamais bloquer l'opération principale (try/catch global)

- Déclencheurs automatiques notify() :
  - Confirmation RDV → notify patient + notify médecin
  - Paiement reçu → notify patient
  - Abonnement expirant (J-3) → notify patient (depuis cron job)
  - Conflit mis à jour → notify patient concerné
  - Partenaire validé → notify partenaire
  - Compte suspendu → notify user concerné

- abonnement.job.js modifié :
  - Détection abonnements expirant dans 3 jours
  - notify() pour chaque patient concerné

---

### TÂCHE 5 — Routes Notifications

**Fichiers créés :**
- `src/routes/notification.routes.js`

**Fichiers modifiés :**
- `src/server.js` (ajouté notificationRoutes)

**Routes implémentées :**
- POST /api/v1/notifications/push/subscribe → Enregistrer subscription push du device
- POST /api/v1/notifications/push/unsubscribe → Désactiver subscription push
- GET /api/v1/notifications → Lister notifications du user connecté (paginé, 20/page)
- PATCH /api/v1/notifications/:id/read → Marquer comme lue (read_at = NOW())
- PATCH /api/v1/notifications/read-all → Marquer toutes comme lues
- GET /api/v1/notifications/unread-count → Nombre de notifications non lues (badge)
- POST /api/v1/webhooks/whatsapp → Webhook WhatsApp (GET pour vérification token + POST pour messages)
- GET /api/v1/vapid-public-key → Retourner VAPID_PUBLIC_KEY pour le frontend

---

### TÂCHE 6 — Skill Windsurf + Rapport

**Fichiers créés :**
- `.windsurf/rules/bolamu-notifications.md`
- `docs/SPRINT7-RAPPORT.md`

**Contenu skill Windsurf :**
- Schéma tables notifications + push_subscriptions
- Règle : notify() est non-bloquant — toujours dans try/catch
- Canaux par priorité : WhatsApp → Push → SMS
- Liste complète des types de notifications
- Variables d'environnement requises
- Commande génération clés VAPID : npx web-push generate-vapid-keys

---

## FICHIERS CRÉÉS/MODIFIÉS

**Fichiers créés :**
- database/migration_023_notifications.sql
- scripts/run_migration_023.js
- src/services/push.service.js
- src/services/whatsapp.service.js
- src/services/notification.service.js
- src/routes/notification.routes.js
- .windsurf/rules/bolamu-notifications.md
- docs/SPRINT7-RAPPORT.md

**Fichiers modifiés :**
- package.json (ajouté web-push)
- .env.example (ajouté VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN)
- src/server.js (ajouté configurePush, notificationRoutes)
- src/jobs/abonnement.job.js (ajouté notifications abonnement expirant J-3)

---

## DÉPENDANCES INSTALLÉES

**Dépendances de production :**
- web-push

**Dépendances de développement :**
- Aucune nouvelle

---

## VARIABLES D'ENVIRONNEMENT AJOUTÉES

**Web Push (VAPID) :**
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- Commande génération : npx web-push generate-vapid-keys

**WhatsApp Business API :**
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_ID
- WHATSAPP_VERIFY_TOKEN

---

## ACTIONS HUMAINES REQUISES

### 1. Créer compte WhatsApp Business Meta
- business.facebook.com → WhatsApp → Get Started
- Configurer WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN
- Ajouter dans Render (staging + production)

### 2. Générer clés VAPID
- `npx web-push generate-vapid-keys`
- Ajouter VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans Render

### 3. Configurer templates WhatsApp
- Créer templates dans WhatsApp Business Manager
- Templates requis : rdv_confirmation, paiement_confirme, rappel_rdv, abonnement_expire
- Langue : français

---

## VALIDATION

Avant déploiement en production :
1. ✅ Migration 023 exécutée (tables push_subscriptions + notifications)
2. ✅ Service push notifications (Web Push API avec VAPID)
3. ✅ Service WhatsApp Business (templates + webhook)
4. ✅ Service notification unifié (canal intelligent + fallback)
5. ✅ Routes notifications (subscribe, list, read, webhook)
6. ✅ Skill Windsurf notifications
7. ✅ Rapport Sprint 7 généré

---

## CONCLUSION

Le Sprint 7 a enrichi l'expérience utilisateur post-lancement avec un système de notifications unifié intégrant Web Push API (FCM) et WhatsApp Business API. Le système permet d'envoyer des notifications via trois canaux (WhatsApp → Push → SMS) avec une priorité automatique et une gestion non-bloquante pour ne jamais impacter l'UX principal.

**Fonctionnalités existantes :** Toutes intactes  
**Statut :** ✅ PRÊT POUR UTILISATION  
**Date de fin :** 20 mai 2026
