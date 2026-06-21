# AUDIT_QUEUES_DESACTIVATION.md
**Date** : 21 juin 2026
**Rôles** : /devops-engineer + /tech-lead
**Contexte** : SMS abandonnés pour le lancement (raisons financières). WhatsApp direct utilisé en prod. BullMQ désactivé par défaut.

---

## 1. FICHIERS MODIFIÉS

### src/config/redis.js
**Modification** : Connexion Redis SEULEMENT si `REDIS_URL` explicitement configuré
- Avant : Tentait connexion localhost (127.0.0.1:6379) si REDIS_URL non défini
- Après : Connexion uniquement si `process.env.REDIS_URL` existe
- Log ajouté : `[QUEUES] Désactivées (pas de REDIS_URL configuré) — SMS/notifications via queue inactifs`
- Impact : Zéro tentative de connexion Redis si REDIS_URL non configuré → zéro log ECONNREFUSED répété

### src/server.js
**Modification** : Workers BullMQ commentés
- Avant : `require('./workers/sms-worker')` et `require('./workers/notification-worker')` exécutés au démarrage
- Après : Commentés avec instruction de réactivation
- Commentaire ajouté : `Pour réactiver : configurer REDIS_URL sur Render + décommenter ci-dessous`
- Impact : Workers ne démarrent pas → zéro tentative de connexion Redis

---

## 2. FICHIERS BULLMQ IDENTIFIÉS (6)

| Fichier | Rôle | État après modification |
|---------|------|------------------------|
| src/config/redis.js | Connexion Redis | Désactivé par défaut (sauf REDIS_URL) |
| src/queues/bolamu-queue.js | Queue BullMQ | Null si connection null (déjà protégé) |
| src/workers/sms-worker.js | Worker SMS batch | Non démarré (require commenté) |
| src/workers/notification-worker.js | Worker notifications | Non démarré (require commenté) |
| src/jobs/abonnement.job.js | Cron abonnements | Actif, mais appels BullMQ ignorés |
| src/server.js | Démarrage serveur | Workers commentés |

---

## 3. APPELS MÉTIER QUI UTILISAIENT CES QUEUES

### abonnement.job.js (1 appel BullMQ)

**Fichier** : `src/jobs/abonnement.job.js`
**Fonction** : `sendSmsBatch(phones, message)`
**Appel BullMQ** : `await addJob('send-sms-batch', { phones, message })`

**Utilisations dans le cron quotidien (02h00 Brazzaville) :**

1. **Rappels J-30 abonnement MoMo expirant**
   - Ligne 43 : `await sendSmsBatch(phones, message)`
   - Message : "Bonjour, votre abonnement Bolamu expire bientôt. Renouvelez pour 24 000 FCFA via MTN MoMo..."
   - **IMPACT MÉTIER** : ⚠️ **PERDU** - Ces rappels ne sont plus envoyés depuis désactivation BullMQ

2. **Notification expiration abonnement**
   - Ligne 117 : `await sendSmsBatch(phones, message)`
   - Message : "Bonjour, votre abonnement Bolamu a expiré. Renouvelez pour 24 000 FCFA via MTN MoMo..."
   - **IMPACT MÉTIER** : ⚠️ **PERDU** - Ces notifications ne sont plus envoyées depuis désactivation BullMQ

**Fallback existant** : Oui
- `addJob()` dans `bolamu-queue.js` retourne `null` si queue inactive
- Aucune erreur levée, log warning : `[BULLMQ Queue] Redis indisponible - job 'send-sms-batch' ignoré`
- Le cron continue de s'exécuter normalement

---

## 4. POINT D'ATTENTION MÉTIER CRITIQUE

### Rappels abonnement expirant (J-30 et expiration)

**État actuel** : Ces rappels sont **PERDUS** depuis la désactivation BullMQ
- Le cron `abonnement.job.js` s'exécute quotidiennement à 02h00 Brazzaville
- Il détecte les abonnements MoMo expirant dans 30 jours ou déjà expirés
- Il appelle `sendSmsBatch()` → BullMQ → sms-worker → WhatsApp
- Comme BullMQ est désactivé, les jobs sont ignorés → aucun envoi

**Autres notifications du même cron (non affectées) :**
- ✅ Notifications J-3 : utilisent `notify()` → WhatsApp direct (notification.service.js)
- ✅ Rappels événements Elonga : utilisent `sendWhatsAppTemplate()` direct
- ✅ Rappels vouchers expirant : utilisent `sendWhatsAppTemplate()` direct
- ✅ Rappels RDV 24h : utilisent `sendWhatsAppTemplate()` direct

**Recommandation métier pour Natsy :**
Les rappels J-30 et expiration d'abonnement sont un canal de rétention important. Deux options :

1. **Migrer vers WhatsApp direct** (recommandé) :
   - Remplacer `sendSmsBatch()` par des appels directs `sendWhatsAppTemplate()` dans `abonnement.job.js`
   - Créer ou utiliser un template WhatsApp existant pour ces rappels
   - Avantage : Fonctionne immédiatement sans BullMQ/Redis

2. **Réactiver BullMQ avec Redis** (option future) :
   - Configurer REDIS_URL sur Render (instance Redis externe)
   - Décommenter les workers dans `server.js`
   - Coût supplémentaire : instance Redis (~$15/mois sur Render)

---

## 5. VÉRIFICATION CODE ACTIF

### Aucun contrôleur/route ne dépend des queues

**Recherche** : `addJob`, `addNotificationJob`, `bolamuQueue` dans src/
**Résultat** : Uniquement utilisé dans `abonnement.job.js` (déjà analysé)

**Conclusion** : Aucun contrôleur ou route ne dépend de BullMQ pour fonctionner
- Les routes critiques (inscription, upload, paiement) ne sont pas impactées
- WhatsApp direct (`sendWhatsAppTemplate`) fonctionne indépendamment
- Le système notifications (`notify()`) utilise WhatsApp direct + Push, pas BullMQ

---

## 6. CONFIRMATION WHATASAPP NON AFFECTÉ

**Fichier** : `src/services/whatsapp.service.js`
**Fonction** : `sendWhatsAppTemplate()`
**Dépendance** : Aucune dépendance BullMQ/Redis
**État** : ✅ **INTACT** - Fonctionne indépendamment via appel direct API Meta

**Fichier** : `src/services/notification.service.js`
**Fonction** : `notify()`
**Dépendance** : WhatsApp direct + Push service
**État** : ✅ **INTACT** - N'utilise pas BullMQ

---

## 7. RÉSUMÉ DES MODIFICATIONS

| Action | Fichier | Modification |
|--------|---------|--------------|
| 1 | src/config/redis.js | Connexion Redis SEULEMENT si REDIS_URL configuré |
| 2 | src/server.js | Workers BullMQ commentés (sms-worker, notification-worker) |
| 3 | docs/AUDIT_QUEUES_DESACTIVATION.md | Ce rapport créé |

---

## 8. RÉSUMÉ IMPACT

**Technique** : ✅ **RÉSOLU**
- Zéro tentative de connexion Redis si REDIS_URL non configuré
- Zéro log ECONNREFUSED répété en production
- Workers BullMQ désactivés proprement

**Métier** : ⚠️ **POINT D'ATTENTION**
- Rappels J-30 et expiration abonnement MoMo perdus
- Autres notifications (J-3, événements, RDV, vouchers) intactes
- WhatsApp direct fonctionne normalement

**Recommandation** : Migrer les rappels abonnement vers WhatsApp direct dans `abonnement.job.js` pour rétablir ce canal de rétention sans coût Redis supplémentaire.
