# ARCHITECTURE COMMUNAUTÉ BOLAMU — DOCUMENT UNIQUE
## Événements · Clubs · Chat · Notifications · Frontend · Système de preuve

**Version 3.0 — Document de référence unique. Supersède V2.0, le complément frontend et la spec frontend.**
**Règle d'or : rien n'est « fait » tant que sa preuve réelle n'est pas visible (section 15).**

---

## 0. PHILOSOPHIE

Bolamu n'est pas une app de sport. C'est une plateforme de santé communautaire. La communauté est le mécanisme de rétention : chaque interaction (rejoindre un club, participer à un événement, envoyer un message) doit produire (1) un comportement de santé positif, (2) un gain Zora, (3) un lien social. Modèle de référence : **Sweatcoin**, pas les réseaux sociaux.

Le frontend suit une règle absolue : **un seul Hub, des panneaux qui se substituent, jamais de nouvelle page** (section 7).

---

## 1. ÉTAT DE LA BASE (audit)

| Table | État | Lacune |
|---|---|---|
| `elonga_events` | Existe | Pas de `status` |
| `elonga_registrations` | Existe | OK |
| `clubs` | Existe | Pas de `status`, pas de `conversation_id` |
| `club_members` | Existe | OK (`patient_phone`) |
| `conversations` | Existe | Type manque `private` |
| `conversation_participants` | Existe | Manque `last_read_at` |
| `messages` | **ABSENTE** | À créer |
| `club_activities` | **ABSENTE** | À créer |
| `follows` | **ABSENTE** | Usage non défini → ne pas implémenter |

Socket.io présent sur le serveur mais **non branché sur le chat**.

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

### 2.2 Schéma cible

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

### 3.2 Schéma cible

```sql
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('draft','active','archived')),
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id),
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
- **Création d'un club → crée automatiquement une `conversation` de type `club`** et y ajoute l'animateur comme participant.
- **Rejoindre un club → ajoute le patient à `conversation_participants`** de ce club.

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

## 4. CHAT

### 4.1 Types de conversation : `private` (2), `club` (N), `patient_medecin` (2)

### 4.2 Schéma cible

```sql
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('private','club','patient_medecin','communaute'));
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_phone VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text','image','system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

### 4.3 Socket.io (à brancher dans `chat.socket.js`)
Événements : `join_conversation` (vérifie JWT + participation, `socket.join`), `send_message` (vérifie auth → INSERT messages → MAJ `last_message_at` → `io.to('conv_X').emit('new_message')`), `read_messages` (UPDATE `last_read_at`).

### 4.4 Routes chat

| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/chat/conversations` | participant |
| POST | `/api/v1/chat/conversations` | patient (créer privée) |
| GET | `/api/v1/chat/conversations/:id/messages` | participant |
| POST | `/api/v1/chat/conversations/:id/messages` | participant (fallback REST) |
| PATCH | `/api/v1/chat/conversations/:id/read` | participant |

---

## 5. NOTIFICATIONS (WAHA)

### 5.1 Infrastructure — **corrigée**
- Canal : **WAHA** — `POST waha-bolamu.onrender.com/api/sendText`.
- Service : **`waha.service.js`** (renommage recommandé). Le service ne contient **aucun** code `whatsapp-web.js`/Puppeteer. Toute référence à `wame.service.js` ou à l'ancienne couche Puppeteer est supprimée. *(À vérifier contre le code réel.)*
- Sous WAHA/GOWS (texte libre), les « templates » sont des **fonctions de message internes**, pas des templates Meta à faire approuver.

### 5.2 Templates communauté (noms canoniques exclusifs)
`bolamu_admin_event_soumis`, `bolamu_animateur_event_valide`, `bolamu_animateur_event_refuse`, `bolamu_event_publication`, `bolamu_event_inscription` (avec `session_code`), `bolamu_event_rappel` (24 h avant), `bolamu_checkin_confirme`, `bolamu_event_zora_credite`, `bolamu_animateur_nouveau_membre`, `bolamu_club_activite`, `bolamu_message_offline`.

### 5.3 Règle offline/online (chat)
Avant d'envoyer une notif WhatsApp pour un message : si le destinataire est connecté en Socket.io → **ne pas envoyer**. S'il est offline → envoyer `bolamu_message_offline` après 2 min (re-vérifier la connexion avant l'envoi).

---

## 6. RÔLE ANIMATEUR

Rôle distinct, validé par token + middleware. **Peut** : créer événements (→ validation admin), gérer ses inscrits, scanner les QR (`html5-qrcode`), créer/gérer des clubs, notifier son club, programmer des activités. **Ne peut pas** : publier directement, modifier les Zora, accéder aux données médicales.

Dashboard animateur — 4 onglets : Accueil (`GET /animateur/stats`), Événements (`GET /animateur/events`, registrations, **scanner QR intégré**), Clubs (`GET /animateur/clubs`, notify), Notifications (local).

---

## 7. FRONTEND — HUB COMMUNAUTÉ UNIQUE

### 7.1 Principe
Un seul écran racine. Les « pages » sont des **panneaux** qui se substituent. Jamais de nouvelle page, jamais de rechargement. Modèle Sweatcoin/Strava/WhatsApp Communities.

- **Interdit** : `window.location`, `location.href`, `event.html`, `club.html`.
- **Autorisé** : `setActiveSection()`, `setSelectedEvent()`, `setSelectedClub()`, `setCurrentConversation()`, `setActiveTab()`, `setQrModalOpen()`.
- Priorité **mobile 375 px** · référence qualité = dashboard **Pharmacie** · Plus Jakarta Sans · Material Symbols (zéro emoji) · fond `#FAF8FF` · Zora = masque doré.

### 7.2 Arbre de navigation
```
CommunautéHub
├── Accueil
├── Événements → Fiche → [Participants · Discussion · Mon QR (modal)]
├── Clubs → Fiche → [Membres · Activités · Classement · Discussion]
├── Messages → Conversation
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
├── ChatPanel → ConversationList · ConversationView
└── ProfilePanel
```
Panneaux **affichés/masqués** selon `activeSection`, jamais sur des pages distinctes.

---

## 8. BOUTONS — CARTE DE CONNECTIVITÉ

### 8.0 RÈGLE ANTI-FRAUDE (prioritaire sur tout)
Aucun bouton ne permet à un adhérent de **se déclarer** quelque chose. Toute présence, participation ou gain Zora provient **uniquement** de :
1. une **preuve technologique** — scan QR le jour de l'événement, ou
2. une **validation animateur**.

**Boutons interdits** (actionnés par le patient) : « Démarrer », « Commencer », « J'ai participé », « Marquer comme fait », ou tout champ libre que l'adhérent remplit pour prouver une action. S'ils existent dans les écrans HTML actuels, ils sont **supprimés ou convertis** en check-in QR / validation animateur. *(Cohérent avec la règle Zora : earn déclenché par un validateur, jamais auto-déclaré.)*

Distinction clé : **s'inscrire ≠ avoir participé.** S'inscrire (bouton « Participer ») n'est qu'une intention et ne crédite rien. Le crédit n'arrive qu'après présence prouvée par QR/animateur.

### 8.1 Machine d'état du bouton événement
| Statut · inscription | Bouton (couleur) | Déclenche | Résultat attendu |
|---|---|---|---|
| `published` · non inscrit | Participer (vert) | `POST /events/:id/register` | `session_code` reçu, bouton → bleu (aucun Zora à ce stade) |
| `published` · inscrit | Inscrit — En attente (bleu, désactivé) | — | aucune |
| `active` · inscrit | Afficher mon QR (orange) + LIVE | `setQrModalOpen(true)` | modal QR avec `session_code` |
| `completed` | Terminé (gris) | — | historique Zora (crédité car présence prouvée) |

Le check-in n'est **jamais** déclenché par le patient : il affiche son QR ; l'animateur/admin scanne → `POST /events/:id/checkin`. C'est l'unique preuve de présence.

### 8.2 Boutons clubs / groupes
| Bouton | Route / action | Résultat attendu | Preuve |
|---|---|---|---|
| Carte événement / club | `setSelected…` + `setActiveSection` | panneau remplacé (pas de page) | — |
| **Créer un groupe** | `POST /clubs` | club créé + conversation auto créée | HTTP + SQL |
| **Rejoindre** | `POST /clubs/:id/join` | membre + ajouté au chat du club | HTTP + SQL |
| **Voir les adhérents (tous)** | `GET /clubs/:id/members` | **roster complet** des membres + leur Zora → confirme que le club est vivant et peuplé | HTTP |
| Classement | mêmes données, tri Zora décroissant | top membres | HTTP |
| Ouvrir conversation | `GET …/messages` + `join_conversation` | historique + salon rejoint | Socket |
| Envoyer message | `socket.emit('send_message')` | `new_message` en temps réel | Socket |
| Clic notif / ouverture | `PATCH …/read` | badge non-lus → 0 | HTTP |

L'onglet **Membres** affiche **tous** les adhérents (roster), pas seulement le top — c'est ce qui te permet de vérifier d'un coup d'œil qu'un club est réellement actif.

### 8.3 Ateliers (ex. atelier cuisine / nutrition / dépistage)
Un atelier est un **événement à catégorie** (ex. pilier Nutrition pour la cuisine). Le bouton **« S'inscrire »** ouvre la **fiche de l'atelier** (date, lieu, animateur, +Zora) — un panneau, jamais une nouvelle page.

Cycle identique à un événement, et **soumis à la règle 8.0** :
```
S'inscrire (intention, 0 Zora) → jour J : scan QR par l'animateur (preuve) → Zora crédités
```
> **Statut dans le document** : le mécanisme d'inscription à un atelier réutilise les routes événement (`/events/:id/register` + `/checkin`). Si tu veux que les ateliers soient portés par un **club** plutôt que par le catalogue Elonga, il faut ajouter l'inscription aux `club_activities` (non prévu dans le schéma initial — à décider). Par défaut : un atelier = un événement Elonga avec catégorie.

---

## 9. PHOTOS

Fichiers dans `public/images/landing/`, servis sur le web par Express.
- ✅ Référence correcte : `/images/landing/<fichier>`
- ❌ **Jamais** un chemin disque `C:\Users\natsy\...` (ne s'affichera pas dans le navigateur).

| Emplacement | Source | Valeur |
|---|---|---|
| Carte/fiche événement | `elonga_events.image_url` | `/images/landing/<fichier>` |
| Carte/fiche club | `clubs.image_url` | `/images/landing/<fichier>` |
| Avatars membres | avatar patient ou initiales | image ou fallback |
| Pièce Zora | `zora-coin-gold.png` | chemin web fixe |

**À faire par Claude Code** : inventorier `public/images/landing/`, et vérifier que chaque `image_url` et chaque `<img src>` pointe vers `/images/landing/...` (fichier existant).

---

## 10. MATRICE RBAC

| Route | Patient | Animateur | Admin |
|---|---|---|---|
| `GET /events` · `/:id` · `/:id/participants` | ✅ | ✅ | ✅ |
| `POST /events/:id/register` | ✅ | ✅ | ❌ |
| `POST /events/:id/checkin` | ❌ | propriétaire | ✅ |
| `POST /animateur/events`, `GET /animateur/*` | ❌ | ✅ (les siens) | ❌ |
| `GET /admin/events/pending`, `PATCH /admin/events/:id/*`, `GET /admin/checkins/history` | ❌ | ❌ | ✅ |
| `GET /clubs` · `/:id` · `/:id/members` | ✅ | ✅ | ✅ |
| `POST /clubs` · `/join` · `/leave` | ✅ | ✅ | ❌ |
| `POST /clubs/:id/activities`, `/animateur/clubs/:id/notify` | ❌ | animateur du club | ❌ |
| `GET/POST/PATCH /chat/*` | participant | participant | participant |

« participant » = entrée dans `conversation_participants`. « propriétaire » = `created_by`/`animateur_phone`.

---

## 11. CONTRATS JSON (extraits clés)

```jsonc
// GET /animateur/stats
{ "activeMembers": 52, "monthlyEvents": 4, "checkinRate": 87 }

// GET /events/:id  (inclut l'état d'inscription de l'appelant)
{ "id":8, "title":"…", "status":"active", "zora_reward":150, "current_participants":23,
  "my_registration": { "registered":true, "registration_status":"registered", "session_code":"EVT8-7K2P9" } }

// POST /events/:id/register → 201
{ "registration_id":412, "event_id":8, "session_code":"EVT8-7K2P9", "registration_status":"registered" }

// POST /events/:id/checkin → 200   (corps: { "token":"EVT8-7K2P9" })
{ "event_id":8, "patient_phone":"+242…", "checked_in_at":"…", "registration_status":"checked_in" }

// GET /admin/checkins/history
{ "items":[ { "patient_phone":"+242…","event_id":8,"checked_in_at":"…","city":"Brazzaville" } ], "total":1 }

// GET /clubs/:id/members  (classement)
{ "items":[ { "rank":1,"patient_phone":"+242…","display_name":"Marie","zora_in_club":3200 } ] }

// Socket: send_message { conversation_id, content, token } → new_message { id, conversation_id, sender_phone, content, created_at }

// Erreur standard
{ "error":"message lisible", "code":"EVENT_FULL" }
```

---

## 12. CONSTANTES FRONT-END
```typescript
EventStatus = { DRAFT:"draft", PENDING:"pending_validation", PUBLISHED:"published", ACTIVE:"active", COMPLETED:"completed", ARCHIVED:"archived" }
ClubStatus = { DRAFT:"draft", ACTIVE:"active", ARCHIVED:"archived" }
ConversationType = { PRIVATE:"private", CLUB:"club", PATIENT_MEDECIN:"patient_medecin", COMMUNAUTE:"communaute" }
EventButtonColor = { PARTICIPATE:"#22C55E", REGISTERED:"#3B82F6", CHECKIN:"#F97316", DONE:"#9CA3AF" }
```

---

## 13. ANOMALIES VERROUILLÉES
1. Cycle 6 états → appliqué (section 2.1).
2. QR → **`html5-qrcode` partout**, supprimer `jsQR`.
3. Historique check-in admin → **`GET /api/v1/admin/checkins/history`** (supprimer l'appel à `/events/my/registrations`).
4. Templates → noms canoniques section 5.2 exclusivement.
5. Service WhatsApp → **`waha.service.js`**, zéro Puppeteer (section 5.1).
6. `follows` → ne pas implémenter.

---

## 14. RÈGLES INVARIANTES (chaque prompt Cascade)
1. `phone` VARCHAR(20) identifiant universel · `normalizePhone()` avant tout INSERT/SELECT.
2. **Soft delete** (`is_active = false`), jamais DELETE physique.
3. `authMiddleware` sur toutes les routes (sauf publiques documentées).
4. `audit_log` sur toute action sensible.
5. Zora **uniquement par preuve système**, jamais auto-déclaré par le patient.
6. Toute écriture en **transaction avec ROLLBACK** en cas d'erreur.
7. Catch standard : `console.error('[context]', error.message); return res.status(500).json({ error: error.message });`

---

## 15. SYSTÈME DE PREUVE & PLAN DE TEST

### 15.1 Principe
**Rien n'est « fait » tant que sa preuve réelle n'est pas collée ici et verte.** Aucune preuve simulée, aucune documentation fictive. Une affirmation sans preuve = non fait.

### 15.2 Les 4 types de preuve
| Type | Comment l'obtenir | À quoi ça ressemble |
|---|---|---|
| **SQL** (Neon) | exécuter la requête réelle ; pour une écriture : `BEGIN` → écrire → `SELECT` de contrôle → `ROLLBACK` (test) ou `COMMIT` (réel) | les vraies lignes retournées |
| **HTTP** | requête réelle (curl/Postman) avec vrai token | code 200/201 + vrai corps JSON |
| **Socket** | émettre l'événement, observer la console client | payload `new_message` reçu |
| **Navigateur** | ouvrir l'écran en 375 px | capture montrant le résultat réel (bouton, photo, message) |

### 15.3 Matrice de tests à preuve

Remplir la colonne **Preuve réelle** avec la sortie réelle, puis cocher. Tant qu'une case n'a pas sa preuve, la fonctionnalité est **rouge**.

| # | Test | Type | Critère de réussite | Preuve réelle (à coller) | ✅ |
|---|---|---|---|---|---|
| T1 | Migrations exécutées sur Neon | SQL | toutes les colonnes/tables existent (`information_schema`) | | ☐ |
| T2 | Animateur crée un événement | HTTP+SQL | 201 + ligne `status='pending_validation'` | | ☐ |
| T3 | Admin valide | HTTP+SQL | 200 + `status='published'` | | ☐ |
| T4 | Patient s'inscrit | HTTP+SQL | 201 + `session_code` + ligne registration | | ☐ |
| T5 | CRON passe en `active` à `starts_at` | SQL | `status='active'` | | ☐ |
| T6 | Animateur scanne le QR | HTTP+SQL | 200 + `checked_in_at` renseigné | | ☐ |
| T7 | CRON complète + crédite Zora | SQL | ligne `zora_ledger` + `zora_credited=1` | | ☐ |
| T8 | Historique check-in admin | HTTP | 200 sur `/admin/checkins/history` (pas la route patient) | | ☐ |
| T9 | Création club → conversation auto | SQL | `clubs.conversation_id` non nul + animateur participant | | ☐ |
| T10 | Rejoindre club → ajouté au chat | SQL | ligne `conversation_participants` | | ☐ |
| T11 | Classement membres par Zora | HTTP | items triés décroissant | | ☐ |
| T12 | Envoi message temps réel | Socket | `new_message` reçu par l'autre participant | | ☐ |
| T13 | Badge non-lus → 0 après lecture | HTTP+SQL | `PATCH /read` 200 + `last_read_at` mis à jour | | ☐ |
| T14 | Message offline → WhatsApp | HTTP | `bolamu_message_offline` envoyé après 2 min si offline | | ☐ |
| T15 | Bouton événement change d'état | Navigateur | capture : vert→bleu→orange selon statut | | ☐ |
| T16 | Hub : aucun rechargement de page | Navigateur | navigation entre panneaux sans changement d'URL | | ☐ |
| T17 | Photos affichées | Navigateur | images visibles (src = `/images/landing/...`, pas chemin disque) | | ☐ |
| T18 | QR seul `html5-qrcode` | Code | aucune trace de `jsQR` dans le dépôt | | ☐ |
| T19 | Créer un groupe fonctionne | HTTP+SQL | 201 + club + conversation auto créés | | ☐ |
| T20 | Roster complet d'un club | HTTP | tous les membres listés (club vivant) | | ☐ |
| T21 | S'inscrire à un atelier | HTTP | 201 + fiche atelier ouverte, 0 Zora à l'inscription | | ☐ |
| T22 | **Anti-fraude** | Code+Navigateur | aucun bouton patient « Démarrer/Commencer/J'ai participé » ; tout gain passe par QR ou animateur | | ☐ |

### 15.4 Règle de push
Aucun `git push` tant que les preuves des tests concernés ne sont pas collées et vertes. Tu valides chaque push toi-même.

---

## 16. ORDRE D'IMPLÉMENTATION
1. **Migrations** (T1) — preuve SQL avant de continuer.
2. **Backend routes** (événements, animateur, admin, clubs, chat) + CRON + Socket — preuves HTTP/SQL (T2–T14).
3. **Frontend Hub** (panneaux, boutons, photos) — preuves Navigateur (T15–T17).
4. **Dashboard animateur** + harmonisation QR (T18).

À chaque étape : preuve réelle visible (section 15) avant push.

---

*Document unique de référence — Communauté Bolamu. Une affirmation sans preuve n'est pas une réalisation.*
