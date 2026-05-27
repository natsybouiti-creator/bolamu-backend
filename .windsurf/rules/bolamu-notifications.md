# BOLAMU — Notifications Push Web (FCM) + WhatsApp Business API
**Sprint :** 7  
**Date :** 20 mai 2026

---

## SCHÉMA TABLES

### push_subscriptions
Abonnements Web Push API pour notifications push.

```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_phone, endpoint)
);
```

### notifications
Historique des notifications envoyées (push, WhatsApp, SMS, email).

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'rdv_confirme','rdv_rappel','rdv_annule',
    'paiement_recu','abonnement_expire','abonnement_renouvele',
    'conflit_update','message_recu','alerte_systeme',
    'whatsapp_message'
  )),
  titre VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  canal VARCHAR(20) DEFAULT 'push' CHECK (canal IN 
    ('push','whatsapp','sms','email')),
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## RÈGLE : notify() EST NON-BLOQUANT

Toute fonction de notification doit être non-bloquante pour l'opération principale. Toujours utiliser try/catch global.

```javascript
try {
  await notify(user_phone, type, data);
} catch (error) {
  logger.error('[Notification] Erreur:', error.message);
  // Ne jamais bloquer l'opération principale
}
```

---

## CANAUX PAR PRIORITÉ

1. **WhatsApp** (si WHATSAPP_ACCESS_TOKEN présent)
2. **Push** (si subscription active)
3. **SMS** (Africa's Talking — toujours disponible)

Le service notification unifié (`notification.service.js`) détermine automatiquement le canal optimal selon les préférences user et disponibilité du service.

---

## TYPES DE NOTIFICATIONS

- `rdv_confirme` : Confirmation de rendez-vous
- `rdv_rappel` : Rappel de rendez-vous
- `rdv_annule` : Annulation de rendez-vous
- `paiement_recu` : Paiement reçu
- `abonnement_expire` : Abonnement expire (J-3)
- `abonnement_renouvele` : Abonnement renouvelé
- `conflit_update` : Conflit mis à jour
- `message_recu` : Message reçu
- `alerte_systeme` : Alerte système
- `whatsapp_message` : Message WhatsApp

---

## VARIABLES D'ENVIRONNEMENT REQUISES

### Web Push (VAPID)
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

Générer avec : `npx web-push generate-vapid-keys`

### WhatsApp Business API
```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=
```

---

## COMMANDES UTILES

### Générer clés VAPID
```bash
npx web-push generate-vapid-keys
```

### Exécuter migration 023
```bash
node scripts/run_migration_023.js
```

### Tester notification push
```bash
# Via API
POST /api/v1/notifications/push/subscribe
{
  "endpoint": "...",
  "p256dh": "...",
  "auth": "...",
  "device_type": "web"
}
```

---

## DÉCLENCHEURS AUTOMATIQUES

Le système envoie automatiquement des notifications dans ces cas :

- **Confirmation RDV** → notify patient + notify médecin
- **Paiement reçu** → notify patient
- **Abonnement expirant (J-3)** → notify patient (depuis cron job)
- **Conflit mis à jour** → notify patient concerné
- **Partenaire validé** → notify partenaire
- **Compte suspendu** → notify user concerné

---

## ROUTES API

### Push Subscriptions
- `POST /api/v1/notifications/push/subscribe` — Enregistrer subscription
- `POST /api/v1/notifications/push/unsubscribe` — Désactiver subscription

### Notifications
- `GET /api/v1/notifications` — Lister notifications (paginé, 20/page)
- `PATCH /api/v1/notifications/:id/read` — Marquer comme lue
- `PATCH /api/v1/notifications/read-all` — Marquer toutes comme lues
- `GET /api/v1/notifications/unread-count` — Nombre non lues (badge)

### Webhooks
- `GET /api/v1/webhooks/whatsapp` — Vérification webhook WhatsApp
- `POST /api/v1/webhooks/whatsapp` — Messages WhatsApp

### Configuration
- `GET /api/v1/vapid-public-key` — Clé publique VAPID pour frontend

---

## SÉCURITÉ

- Toutes les routes notifications nécessitent authMiddleware (sauf webhooks)
- Webhook WhatsApp vérifié avec WHATSAPP_VERIFY_TOKEN
- VAPID keys stockées dans environment variables (jamais dans le code)
- Notifications non bloquantes : try/catch systématique

---

## PERFORMANCE

- Index sur `notifications(user_phone)` pour listage rapide
- Index sur `notifications(user_phone, is_read)` pour badge unread count
- Index sur `push_subscriptions(user_phone)` pour lookup rapide
- Batch processing pour notifications globales (100 par batch)

---

## MONITORING

- Logs Winston pour toutes les notifications envoyées
- Table notifications avec sent_at pour traçabilité
- Error handling non-bloquant pour éviter impact sur UX
- Audit log pour notifications sensibles (suspension compte, etc.)

---

## ACTION HUMAINE REQUISE

1. **Créer compte WhatsApp Business Meta**
   - business.facebook.com → WhatsApp → Get Started
   - Configurer WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN
   - Ajouter dans Render (staging + production)

2. **Générer clés VAPID**
   - `npx web-push generate-vapid-keys`
   - Ajouter VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans Render

3. **Configurer templates WhatsApp**
   - Créer templates dans WhatsApp Business Manager
   - Templates requis : rdv_confirmation, paiement_confirme, rappel_rdv, abonnement_expire
   - Langue : français

---

**Statut :** ✅ PRÊT POUR UTILISATION  
**Dernière mise à jour :** 20 mai 2026
