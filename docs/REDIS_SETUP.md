# REDIS — Configuration externe sur Render

> Mis à jour : 18 juillet 2026
> Fichier concerné : `src/config/redis.js`

---

## 1. Pourquoi Redis est nécessaire

Redis est le backend de **BullMQ**, le système de files d'attente (queues) de Bolamu.
Sans Redis, les workers BullMQ ne démarrent pas. Les jobs concernés :

- **Jobs abonnements** : expiration MoMo annuel, rappels J-30, suspension cascade des bénéficiaires
- **Notifications** : envois en file d'attente (push, rappels RDV)
- **SMS** : workers d'envoi (canal désactivé pour le lancement — WhatsApp direct utilisé en prod)

Le code est conçu pour que Redis soit **optionnel** : son absence ne fait jamais
crasher les routes critiques (upload, inscription). La connexion n'est tentée
que si `REDIS_URL` est explicitement configurée (`src/config/redis.js`, ligne 15).

---

## 2. Créer un service Redis sur Render

Render propose Redis en service natif :

1. Aller sur **Render → New → Redis**
2. Nommer le service **`bolamu-redis`**
3. Choisir la même région que le backend (recommandé pour l'Internal URL)
4. Une fois le service créé, copier l'**Internal URL** générée
   (format : `redis://red-xxxxxxxxxxxx:6379`)
5. Aller dans **bolamu-backend → Environment**
6. Ajouter la variable : **`REDIS_URL`** = l'Internal URL copiée
7. Sauvegarder — Render redéploie automatiquement le backend

> Note : `render.yaml` (lignes 12-16 et 27-31) déclare déjà un service Redis
> `bolamu-redis` (plan starter, `maxmemoryPolicy: noeviction`) et lie `REDIS_URL`
> automatiquement via `fromService`. Si le déploiement utilise ce Blueprint,
> les étapes 1-6 sont automatiques — il suffit de vérifier dans le dashboard Render
> que le service `bolamu-redis` existe et que `REDIS_URL` apparaît dans
> bolamu-backend → Environment. Sinon, appliquer les étapes manuelles ci-dessus.

---

## 3. Vérifier que ça fonctionne

Après redéploiement, ouvrir les logs Render de `bolamu-backend` et chercher
le message exact de connexion réussie (défini dans `src/config/redis.js`, ligne 43) :

```
[Redis] Connecté
```

Messages possibles selon l'état :

| Message dans les logs | Signification |
|---|---|
| `[Redis] Connecté` | ✅ Connexion réussie — queues BullMQ actives |
| `[Redis] Indisponible - queues désactivées: <erreur>` | ❌ `REDIS_URL` définie mais connexion impossible (URL invalide, service down) |
| `[QUEUES] Désactivées (pas de REDIS_URL configuré) — SMS/notifications via queue inactifs` | ⚠️ `REDIS_URL` absente — Redis non configuré |

La stratégie de reconnexion abandonne après **5 tentatives** (retry max 2 s),
puis les queues restent désactivées jusqu'au prochain redémarrage.

---

## 4. Impact si Redis n'est pas configuré

- Les **workers BullMQ ne tournent pas**
- Les **jobs cron d'abonnements** (expiration, rappels J-30, suspension bénéficiaires) ne s'exécutent pas via les queues
- Les **rappels RDV** en file d'attente ne partent pas
- Le reste de la plateforme fonctionne normalement (routes API, WhatsApp direct, paiements) — Redis est non bloquant par conception
