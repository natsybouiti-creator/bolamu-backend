# ARCHITECTURE COMMUNAUTÉ BOLAMU — DOCUMENT UNIQUE
## Événements · Clubs · Chat · Notifications · Frontend · Système de preuve

**Version 4.0 — Mise à jour post-chantier chat unifié (juillet 2026).**
**Supersède V3.0. Règle d'or : rien n'est « fait » tant que sa preuve réelle n'est pas visible (section 15).**

---

## 0. PHILOSOPHIE

Bolamu n'est pas une app de sport. C'est une plateforme de santé communautaire. La communauté est le mécanisme de rétention : chaque interaction (rejoindre un club, participer à un événement, envoyer un message) doit produire (1) un comportement de santé positif, (2) un gain Zora, (3) un lien social. Modèle de référence : **Sweatcoin**, pas les réseaux sociaux.

Le frontend suit une règle absolue : **un seul Hub, des panneaux qui se substituent, jamais de nouvelle page** (section 7).

---

## 1. ÉTAT DE LA BASE (audit post-chantier chat unifié, juillet 2026)

| Table | État | Notes |
|---|---|---|
| `elonga_events` | Existe | Pas de `status` — à migrer (section 2.2) |
| `elonga_registrations` | Existe | OK |
| `clubs` | Existe | `conversation_id` **présent** ✅ — clubs liés aux conversations |
| `club_members` | Existe | OK (`patient_phone`) |
| `conversations` | Existe | Types : `private`, `club`, `communaute`, `patient_medecin` ✅ |
| `conversation_participants` | Existe | `role` élargi à 11 valeurs réelles ✅ (migration_076) |
| `messages` | **Existe** ✅ | Créée et peuplée — moteur unique du chat |
| `chat_messages` | **SUPPRIMÉE** ✅ | Retirée en migration_078 (juillet 2026) |
| `chat_reactions` | **SUPPRIMÉE** ✅ | Retirée en migration_078 (juillet 2026) |
| `club_activities` | ABSENTE | À créer (section 3.2) |
| `follows` | ABSENTE | Ne pas implémenter |
| `users.last_seen_at` | **Existe** ✅ | Ajoutée en migration_079 — présence multi-instances |

Socket.io **opérationnel** sur tous les dashboards depuis le chantier chat unifié (juillet 2026).

---

## 2. ÉVÉNEMENTS ELONGA

### 2.1 Cycle de vie (6 états)

```
DRAFT → PENDING_VALIDATION → PUBLISHED → ACTIVE → COMPLETED → ARCHIVED
```

| État | Acteur | Déclencheur | Visible patient | Inscription | Check-in | Zora |
|---|---|---|---|---|---|---|
| `draft` | Animateur | crée | Non | Non | Non | Non |
| `pending_validation` | Système | après soumission | Non | Non | Non | Non |
| `published` | Admin | valide | Oui (liste) | Oui | Non | Non |
| `active` | CRON | à `starts_at` | Oui (LIVE) | Oui (si places) | Oui | Non |
| `completed` | CRON | à `ends_at` | Oui (historique) | Non | Non | **Oui (auto)** |
| `archived` | Admin | manuel | Non | Non | Non | Non |

Création : animateur → `pending_validation`. Jamais auto-généré.

### 2.2 Schéma cible (à migrer)

```sql
ALTER TABLE elonga_events
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft','pending_validation','published','active','completed','archived')),
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_elonga_events_status ON elonga_events(status);
CREATE INDEX IF NOT EXISTS idx_elonga_events_starts_at ON elonga_events(starts_at);
```

### 2.3 Routes événements

| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/events` | patient (published/active) |
| GET | `/api/v1/events/:id` | patient |
| GET | `/api/v1/events/:id/participants` | patient |
| POST | `/api/v1/events/:id/register` | patient |
| POST | `/api/v1/events/:id/checkin` | animateur (propriétaire) / admin |
| POST | `/api/v1/animateur/events` | animateur (→ pending_validation) |
| GET | `/api/v1/animateur/events` | animateur |
| GET | `/api/v1/animateur/events/:id/registrations` | animateur |
| GET | `/api/v1/animateur/checkins/today` | animateur |
| GET | `/api/v1/admin/events/pending` | admin |
| PATCH | `/api/v1/admin/events/:id/publish` | admin |
| PATCH | `/api/v1/admin/events/:id/cancel` | admin |
| PATCH | `/api/v1/admin/events/:id/activate` | admin |
| PATCH | `/api/v1/admin/events/:id/complete` | admin |
| GET | `/api/v1/admin/checkins/history` | admin |

### 2.4 CRON de transition (toutes les 15 min)

`published` → `active` quand `starts_at <= NOW() < ends_at`. `active` → `completed` quand `ends_at <= NOW()`, puis crédite Zora aux `checked_in` non encore crédités (INSERT `zora_ledger` + `zora_credited = 1`), en transaction.

---

## 3. CLUBS

### 3.1 Cycle : `DRAFT → ACTIVE → ARCHIVED`

### 3.2 Schéma cible (partiellement fait)

`clubs.conversation_id` **existe déjà en base** ✅ — chaque club est lié à une `conversation` de type `club`. Reste à créer `club_activities` :

```sql
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('draft','active','archived')),
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sport_type VARCHAR(50) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS club_activities (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('session','defi','sortie','webinaire')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  zora_reward INTEGER DEFAULT 0,
  created_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
CREATE INDEX IF NOT EXISTS idx_club_activities_club ON club_activities(club_id, scheduled_at);
```

### 3.3 Règles invariantes clubs
- **Création d'un club → crée automatiquement une `conversation` de type `club`** et y ajoute l'animateur comme participant. ✅ Implémenté.
- **Rejoindre un club → ajoute le patient à `conversation_participants`** de ce club. ✅ Implémenté.
- **Messages de club → moteur `messages`/Socket.io générique** (polling 5s retiré en Phase 9/12). ✅

### 3.4 Routes clubs

| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/clubs` | patient |
| GET | `/api/v1/clubs/:id` | patient |
| GET | `/api/v1/clubs/:id/members` | patient (classement Zora) |
| POST | `/api/v1/clubs` | patient (devient animateur) |
| POST | `/api/v1/clubs/:id/join` | patient (+ rejoint le chat) |
| POST | `/api/v1/clubs/:id/leave` | patient |
| POST | `/api/v1/clubs/:id/activities` | animateur du club |
| GET | `/api/v1/animateur/clubs` | animateur |
| POST | `/api/v1/animateur/clubs/:id/notify` | animateur du club |

---

## 4. CHAT — SYSTÈME UNIFIÉ ✅ LIVRÉ (juillet 2026)

> **Chantier chat unifié terminé** (12 phases, juillet 2026). Tout le chat de la plateforme est consolidé sur `conversations`/`messages`/`conversation_participants`. L'ANCIEN SYSTÈME (`chat_messages`, `chat_reactions`) a été supprimé.

### 4.1 Types de conversation

| Type | Participants | Usage |
|---|---|---|
| `private` | 2 | 1-to-1 entre n'importe quels rôles |
| `club` | N | Groupe de club (conversation auto-créée à la création du club) |
| `patient_medecin` | 2 | Canal médecin historique (migration vers `private` à terme) |
| `communaute` | N | Fil communautaire global (posts Zora, achievements) |

### 4.2 Schéma réel en base (post-migrations)

```sql
-- conversation_participants.role : valeurs réelles de users.role, VARCHAR(30) depuis migration_076
CHECK (role IN (
  'patient', 'doctor', 'secretaire', 'pharmacie', 'laboratoire',
  'animateur', 'partenaire_commercial', 'rh', 'admin',
  'content_admin', 'agent_bolamu'
))

-- messages : table principale du chat
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_phone VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text','image','system')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),   -- colonne réelle : sent_at (pas created_at)
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- users.last_seen_at : présence multi-instances (migration_079)
ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ;
```

### 4.3 Socket.io — événements implémentés

**Écoute (client → serveur) :**

| Événement | Payload | Comportement serveur |
|---|---|---|
| `authenticate` | `token` JWT | Valide, stocke `socket.data.phone`, émet `authenticated` |
| `join_conversation` | `{ conversation_id }` | Vérifie appartenance → `socket.join()` → émet `conversation_joined` ✅ |
| `leave_conversation` | `{ conversation_id }` | `socket.leave()` |
| `send_message` | `{ conversation_id, content }` | Vérifie appartenance → INSERT → émet `new_message` à la room |
| `mark_read` | `{ conversation_id, message_id }` | UPDATE `read_at` → émet `message_read` |
| `typing_start` | `{ conversation_id }` | Relay aux autres membres |
| `typing_stop` | `{ conversation_id }` | Relay aux autres membres |

**Émission (serveur → client) :**

| Événement | Payload | Déclencheur |
|---|---|---|
| `authenticated` | `{ phone }` | Connexion réussie |
| `conversation_joined` | `{ conversation_id, status: 'ok' }` | Après `join_conversation` ✅ |
| `new_message` | `{ id, conversation_id, sender_phone, content, created_at, sender_name, sender_avatar_url }` | Nouveau message |
| `message_read` | `{ conversation_id, message_id, read_at }` | Accusé de lecture |
| `typing_start/stop` | `{ conversation_id, user_phone }` | Relay |
| `user_online` | `{ user_phone }` | Connexion socket |
| `user_offline` | `{ user_phone }` | Déconnexion socket |

**Présence hybride Map+DB :**
- `onlineUsers` Map locale (rapide, même instance Render)
- `users.last_seen_at` mis à jour à chaque connexion/déconnexion (fallback multi-instances, TTL 30s)
- `isOnline(phone)` async : vérifie Map d'abord, fallback DB si absent

### 4.4 Routes chat — état réel

| Méthode | Route | Auth | État |
|---|---|---|---|
| GET | `/api/v1/chat/conversations` | tous rôles authentifiés | ✅ |
| POST | `/api/v1/chat/conversations` | tous rôles authentifiés | ✅ Anti-doublon inclus |
| GET | `/api/v1/chat/conversations/:id/messages` | participant (IDOR vérifié) | ✅ |
| POST | `/api/v1/chat/conversations/:id/messages` | participant | ✅ Fallback REST |
| PATCH | `/api/v1/chat/conversations/:id/read` | participant | ✅ |
| GET | `/api/v1/chat/users/search` | tous rôles authentifiés | ✅ Phase 6 |
| POST | `/api/v1/chat/medecin/:medecin_phone` | patient/doctor | ✅ Conservé |

Exclusions : `admin` (pas de chat 1-to-1 — accès support à prévoir séparément), `content_admin` (exclu du scope).

### 4.5 Frontend — composant mutualisé

**`public/js/bolamu-chat-window.js`** (394 lignes) — drawer latéral partagé.

```javascript
BolamuChatWindow.open({ conversationId, currentUserPhone, recipientName, recipientAvatar, socketInstance })
BolamuChatWindow.close()
BolamuChatWindow.isOpen() // → boolean
```

| Dashboard | Onglet Messages | Variable socket | Clé localStorage |
|---|---|---|---|
| patient | ✅ | `A._socket` | `bolamu_patient_token` |
| medecin | ✅ | `window.__bolamuSocket` | `bolamu_doctor_token` |
| pharmacie | ✅ | `window.__bolamuSocket` | `bolamu_pharmacie_token` |
| laboratoire | ✅ | `window.__bolamuSocket` | `bolamu_laboratoire_token` |
| secretaire | ✅ | `window.__bolamuSocket` | `bolamu_secretaire_token` |
| rh | ✅ | `window.__bolamuSocket` | `bolamu_rh_token` |
| animateur | ✅ | `window.__bolamuSocket` | `bolamu_animateur_token` |
| agent_bolamu | ✅ | `window.__bolamuSocket` | `bolamu_agent_bolamu_token` |
| admin | exclu | exclu | — |
| content_admin | exclu | exclu | — |

### 4.6 Performance

`sendConversationMessage()` utilise un **CTE PostgreSQL unique** (INSERT + LEFT JOIN users). Gain mesuré : ~481ms → ~241ms médiane (−50%).

---

## 5. NOTIFICATIONS (WAHA)

### 5.1 Infrastructure
- Canal : **WAHA** — `POST waha-bolamu.onrender.com/api/sendText`.
- Service : **`whatsapp-web.service.js`** → `sendAutoMessage(phone, templateName, params)`. Zéro Puppeteer.

### 5.2 Templates communauté (noms canoniques exclusifs)
`bolamu_admin_event_soumis`, `bolamu_animateur_event_valide`, `bolamu_animateur_event_refuse`, `bolamu_event_publication`, `bolamu_event_inscription`, `bolamu_event_rappel`, `bolamu_checkin_confirme`, `bolamu_event_zora_credite`, `bolamu_animateur_nouveau_membre`, `bolamu_club_activite`, `bolamu_message_offline`.

### 5.3 Règle offline/online (chat)
Si destinataire connecté en Socket.io → ne pas envoyer. Si offline → envoyer `bolamu_message_offline` après 2 min (re-vérifier via `isOnline()` hybride Map+DB avant l'envoi).

---

## 6. RÔLE ANIMATEUR

Rôle distinct, validé par token + middleware. **Peut** : créer événements, gérer inscrits, scanner QR (`html5-qrcode`), créer/gérer clubs, notifier son club, programmer des activités. **Ne peut pas** : publier directement, modifier Zora, accéder aux données médicales.

Dashboard animateur — 4 onglets : Accueil, Événements (scanner QR intégré), Clubs, Notifications.

---

## 7. FRONTEND — HUB COMMUNAUTÉ UNIQUE

### 7.1 Principe
Un seul écran racine. Les « pages » sont des **panneaux** qui se substituent. Jamais de nouvelle page, jamais de rechargement.

- **Interdit** : `window.location`, `location.href`, `event.html`, `club.html`.
- **Autorisé** : `setActiveSection()`, `setSelectedEvent()`, `setSelectedClub()`, `setCurrentConversation()`, `setActiveTab()`, `setQrModalOpen()`.
- Priorité **mobile 375 px** · Plus Jakarta Sans · Material Symbols · fond `#FAF8FF` · Zora = masque doré.

### 7.2 Arbre de navigation
```
CommunautéHub
├── Accueil
├── Événements → Fiche → [Participants · Discussion · Mon QR (modal)]
├── Clubs → Fiche → [Membres · Activités · Classement · Discussion]
├── Messages → Conversation  ← BolamuChatWindow
└── Profil
```

### 7.3 Machine d'état UI globale
```typescript
interface CommunityUIState {
  activeSection: "home"|"events"|"event-details"|"clubs"|"club-details"|"chat"|"profile";
  selectedEvent?: number; selectedClub?: number; selectedConversation?: number;
  activeTab?: "participants"|"discussion"|"ranking"|"activities";
  qrModalOpen: boolean;
}
```

### 7.4 Hiérarchie React
```
CommunityHub (état + bottom nav)
├── HomePanel
├── EventPanel → EventList · EventCard · EventParticipants · EventDiscussion · QRModal
├── ClubPanel → ClubList · ClubMembers · ClubRanking · ClubActivities · ClubDiscussion
├── ChatPanel → ConversationList · ConversationView  ← BolamuChatWindow
└── ProfilePanel
```

---

## 8. BOUTONS — CARTE DE CONNECTIVITÉ

### 8.0 RÈGLE ANTI-FRAUDE (prioritaire sur tout)
Tout gain Zora provient uniquement d'une preuve technologique (scan QR) ou d'une validation animateur. Jamais auto-déclaré.

**Boutons interdits** : « Démarrer », « Commencer », « J'ai participé », « Marquer comme fait ».

Distinction : **s'inscrire ≠ avoir participé.** Le crédit n'arrive qu'après présence prouvée.

### 8.1 Machine d'état du bouton événement

| Statut · inscription | Bouton | Déclenche |
|---|---|---|
| `published` · non inscrit | Participer (vert) | `POST /events/:id/register` |
| `published` · inscrit | Inscrit — En attente (bleu, désactivé) | — |
| `active` · inscrit | Afficher mon QR (orange) + LIVE | `setQrModalOpen(true)` |
| `completed` | Terminé (gris) | — |

### 8.2 Boutons clubs / groupes

| Bouton | Route / action |
|---|---|
| **Créer un groupe** | `POST /clubs` → club + conversation auto créés |
| **Rejoindre** | `POST /clubs/:id/join` → membre + ajouté au chat |
| **Voir les adhérents** | `GET /clubs/:id/members` → roster complet + Zora |
| Ouvrir conversation | `join_conversation` (ack `conversation_joined` attendu) |
| Envoyer message | `socket.emit('send_message')` |
| Clic notif | `PATCH …/read` → badge → 0 |

### 8.3 Ateliers
Un atelier = un événement Elonga avec catégorie. Cycle identique. Règle 8.0 s'applique.

---

## 9. PHOTOS

- ✅ Référence correcte : `/images/landing/<fichier>`
- ❌ Jamais un chemin disque `C:\Users\natsy\...`
- Colonne avatar réelle dans `users` : **`photo_url`** (pas `avatar_url` — colonne morte).

---

## 10. MATRICE RBAC

| Route | Patient | Animateur | Admin | Autres rôles |
|---|---|---|---|---|
| `GET /events` · `/:id` · `/:id/participants` | ✅ | ✅ | ✅ | — |
| `POST /events/:id/register` | ✅ | ✅ | ❌ | — |
| `POST /events/:id/checkin` | ❌ | propriétaire | ✅ | — |
| `GET/POST /animateur/*` | ❌ | ✅ | ❌ | — |
| `GET/PATCH /admin/*` | ❌ | ❌ | ✅ | — |
| `GET /clubs` · `/:id` · `/:id/members` | ✅ | ✅ | ✅ | — |
| `POST /clubs` · `/join` · `/leave` | ✅ | ✅ | ❌ | — |
| `GET/POST/PATCH /chat/*` | ✅ | ✅ | exclu | ✅ (sauf content_admin) |

---

## 11. CONTRATS JSON (extraits clés)

```jsonc
// GET /chat/conversations
{ "success":true, "data":[ {
    "id":40, "type":"private",
    "other_name":"Dr Frederic Bakala",       // champ réel (pas other_full_name)
    "other_photo_url":"https://…cloudinary…",
    "last_message":"Bonjour docteur",
    "last_message_at":"2026-07-12T…",
    "unread_count":2
} ] }

// GET /chat/users/search?q=ba
{ "success":true, "data":[ { "phone":"+242…", "full_name":"Dr Bakala", "role":"doctor", "photo_url":"…" } ] }

// POST /chat/conversations → 201 (nouveau) ou 200 (existant)
{ "success":true, "conversation_id":81, "created":true }

// Socket new_message payload
{ "id":47, "conversation_id":40, "sender_phone":"+242…", "content":"…",
  "created_at":"2026-07-12T…", "sender_name":"Antonio Test", "sender_avatar_url":"…" }

// POST /events/:id/register → 201
{ "registration_id":412, "event_id":8, "session_code":"EVT8-7K2P9", "registration_status":"registered" }

// POST /events/:id/checkin → 200
{ "event_id":8, "patient_phone":"+242…", "checked_in_at":"…", "registration_status":"checked_in" }

// GET /clubs/:id/members
{ "items":[ { "rank":1,"patient_phone":"+242…","display_name":"Marie","zora_in_club":3200 } ] }

// Erreur standard
{ "success":false, "error":"message lisible", "code":"EVENT_FULL" }
```

---

## 12. CONSTANTES FRONT-END

```typescript
EventStatus = { DRAFT:"draft", PENDING:"pending_validation", PUBLISHED:"published",
                ACTIVE:"active", COMPLETED:"completed", ARCHIVED:"archived" }
ClubStatus = { DRAFT:"draft", ACTIVE:"active", ARCHIVED:"archived" }
ConversationType = { PRIVATE:"private", CLUB:"club",
                     PATIENT_MEDECIN:"patient_medecin", COMMUNAUTE:"communaute" }
EventButtonColor = { PARTICIPATE:"#22C55E", REGISTERED:"#3B82F6",
                     CHECKIN:"#F97316", DONE:"#9CA3AF" }

// Rôles réels users.role (valeurs exactes en base)
UserRole = {
  PATIENT: "patient", DOCTOR: "doctor", SECRETAIRE: "secretaire",
  PHARMACIE: "pharmacie", LABORATOIRE: "laboratoire", ANIMATEUR: "animateur",
  PARTENAIRE: "partenaire_commercial", RH: "rh", ADMIN: "admin",
  CONTENT_ADMIN: "content_admin", AGENT: "agent_bolamu"
}
```

---

## 13. ANOMALIES VERROUILLÉES

1. Cycle 6 états événements → appliqué (section 2.1).
2. QR → **`html5-qrcode` partout**, supprimer `jsQR`.
3. Historique check-in admin → **`GET /api/v1/admin/checkins/history`**.
4. Templates → noms canoniques section 5.2 exclusivement.
5. Service WhatsApp → **`whatsapp-web.service.js`** → `sendAutoMessage()`, zéro Puppeteer.
6. `follows` → ne pas implémenter.
7. ~~`chat_messages`/`chat_reactions`~~ → **SUPPRIMÉES** (migration_078). Ne jamais référencer.
8. `avatar_url` → colonne morte. Utiliser **`photo_url`** partout.
9. `users.nom`/`users.prenom` → n'existent pas. Utiliser **`full_name`**.
10. `other_full_name` → n'existe pas dans le payload conversations. Utiliser **`other_name`**.

---

## 14. RÈGLES INVARIANTES (chaque prompt Cascade)

1. `phone` VARCHAR(20) identifiant universel · `normalizePhone()` avant tout INSERT/SELECT.
2. **Soft delete** (`is_active = false`), jamais DELETE physique.
3. `authMiddleware` sur toutes les routes (sauf publiques documentées).
4. `audit_log` sur toute action sensible.
5. Zora **uniquement par preuve système**, jamais auto-déclaré.
6. Toute écriture en **transaction avec ROLLBACK** en cas d'erreur.
7. Catch standard : `console.error('[context]', error.message); return res.status(500).json({ error: error.message });`
8. **Migrations destructives** (`DROP TABLE`, `DROP COLUMN`) : requièrent `ALLOW_DESTRUCTIVE_MIGRATIONS=true` — ne s'appliquent jamais automatiquement. ✅ Gate implémenté (juillet 2026).
9. `conversation_participants.role` = valeur réelle de `users.role` (pas de traduction anglaise).
10. Socket.io : toujours attendre `conversation_joined` avant d'émettre `send_message` (`BolamuChatWindow` gère avec timeout 5s de secours).

---

## 15. DETTE TECHNIQUE RÉSIDUELLE

| Item | Description | Impact | Priorité |
|---|---|---|---|
| Latence Neon | ~241ms médiane/message (CTE, 1 requête) | Cosmétique | Faible |
| Présence in-memory | Map JS + `last_seen_at` Neon (TTL 30s) — Redis pour très haute charge | Théorique (1 instance Render) | Faible |

---

## 16. SYSTÈME DE PREUVE & PLAN DE TEST

### 16.1 Principe
**Rien n'est « fait » tant que sa preuve réelle n'est pas collée ici et verte.**

### 16.2 Les 4 types de preuve

| Type | Comment | À quoi ça ressemble |
|---|---|---|
| **SQL** | requête réelle Neon ; écriture : BEGIN → écrire → SELECT → ROLLBACK/COMMIT | vraies lignes |
| **HTTP** | curl avec vrai token | 200/201 + corps JSON |
| **Socket** | émettre, observer console | payload `new_message` reçu |
| **Navigateur** | 375 px | capture du résultat réel |

### 16.3 Matrice de tests

| # | Test | Type | Critère | État |
|---|---|---|---|---|
| T1 | Migrations exécutées | SQL | toutes colonnes/tables existent | ☐ |
| T2 | Animateur crée un événement | HTTP+SQL | 201 + `status='pending_validation'` | ☐ |
| T3 | Admin valide | HTTP+SQL | 200 + `status='published'` | ☐ |
| T4 | Patient s'inscrit | HTTP+SQL | 201 + `session_code` | ☐ |
| T5 | CRON → `active` | SQL | `status='active'` à `starts_at` | ☐ |
| T6 | Animateur scanne QR | HTTP+SQL | 200 + `checked_in_at` | ☐ |
| T7 | CRON complète + Zora | SQL | ligne `zora_ledger` + `zora_credited=1` | ☐ |
| T8 | Historique check-in admin | HTTP | 200 `/admin/checkins/history` | ☐ |
| T9 | Création club → conversation auto | SQL | `clubs.conversation_id` non nul | ☐ |
| T10 | Rejoindre club → chat | SQL | ligne `conversation_participants` | ☐ |
| T11 | Classement membres Zora | HTTP | items triés décroissant | ☐ |
| T12 | Message temps réel 1-to-1 | Socket | `new_message` reçu | ✅ Prouvé Phase 3/12 |
| T12b | Message temps réel club | Socket | `new_message` sans polling | ✅ Prouvé Phase 9/12 |
| T13 | Badge non-lus → 0 | HTTP+SQL | `PATCH /read` + `read_at` mis à jour | ☐ |
| T14 | Message offline → WhatsApp | HTTP | `bolamu_message_offline` après 2 min | ☐ |
| T15 | Bouton événement change d'état | Navigateur | vert→bleu→orange | ☐ |
| T16 | Hub sans rechargement | Navigateur | navigation sans changement URL | ☐ |
| T17 | Photos affichées | Navigateur | src = `/images/landing/...` | ☐ |
| T18 | QR = `html5-qrcode` seul | Code | aucune trace `jsQR` | ☐ |
| T19 | Créer un groupe | HTTP+SQL | 201 + club + conversation | ☐ |
| T20 | Roster complet club | HTTP | tous membres listés | ☐ |
| T21 | S'inscrire à un atelier | HTTP | 201 + 0 Zora | ☐ |
| T22 | Anti-fraude | Code+Nav | aucun bouton auto-déclaratif | ☐ |
| T23 | Ack `join_conversation` | Socket | `conversation_joined` avant `send_message` | ✅ Prouvé dette item 2 |
| T24 | Présence multi-instances | SQL | `last_seen_at` mis à jour à connexion | ✅ Prouvé dette item 3 |
| T25 | Gate migrations destructives | Code | DROP ignoré sans variable | ✅ Prouvé dette item 1 |

---

## 17. ORDRE D'IMPLÉMENTATION (chantiers restants)

1. **Migrations événements** (section 2.2) — preuve SQL.
2. **Backend routes événements** (animateur, admin, CRON) — T2–T8.
3. **Backend routes clubs** (club_activities) — T9–T11.
4. **Frontend Hub communauté** (panneaux, boutons, photos) — T15–T22.
5. **Dashboard animateur** + harmonisation QR — T18.
6. **Notifications offline chat** — T14.

À chaque étape : preuve réelle visible avant push.

---

*Document unique de référence — Communauté Bolamu V4.0.*
*Mis à jour juillet 2026 post-chantier chat unifié (12 phases) + dette technique (3 items).*
*Une affirmation sans preuve n'est pas une réalisation.*
