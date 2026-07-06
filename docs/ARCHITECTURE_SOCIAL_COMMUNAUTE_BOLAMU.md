# ARCHITECTURE SOCIAL & COMMUNAUTÉ BOLAMU — DOCUMENT UNIQUE
## Identité · Feed · Follows · Clubs · Chat · Notifications · Frontend · Système de preuve

**Version 1.0 — Fusionne et remplace ARCHITECTURE_COMMUNAUTE_BOLAMU.md (V3.0) et ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md.**
**Elonga (événements santé/bien-être) fait l'objet d'un document séparé : ARCHITECTURE_ELONGA_BOLAMU.md, qui consomme les briques définies ici (profils, feed, notifications, pattern de popup).**
**Règle d'or : rien n'est « fait » tant que sa preuve réelle n'est pas visible (section 13).**

---

## 0. PHILOSOPHIE

Bolamu n'est pas une app de sport ni un réseau social générique. C'est une plateforme de santé communautaire où le lien social est un mécanisme de rétention et d'entraide, jamais une fin en soi. Chaque brique sociale (suivre quelqu'un, rejoindre un club, encourager un adhérent, commenter) doit soit renforcer un comportement de santé, soit créer un lien humain qui donne envie de revenir. Modèle de référence pour les mécaniques sociales : Instagram/LinkedIn pour le feed et les profils, Facebook Groups pour les clubs — mais **jamais** pour le gain Zora, qui reste régi exclusivement par la règle anti-fraude (section 7).

Le frontend suit une règle absolue héritée de l'ancien doc Communauté : **un seul Hub, des panneaux qui se substituent (bottom sheet), jamais de nouvelle page** (section 9).

---

## 1. ÉTAT DE LA BASE (audit — à confirmer par Claude Code avant toute écriture)

### 1.1 Déjà en production (sprint réseau social)
| Table / colonne | État |
|---|---|
| `posts`, `post_likes`, `post_comments`, `follows`, `story_views` | Créées, en prod sur Neon |
| `posts.is_active` (soft-delete), `posts.type` CHECK `('manual','system','story')`, `posts.metadata JSONB` | Convention réelle du schéma — ne pas introduire `is_deleted` ni une colonne `link` sur `posts`, elle n'existe pas |
| `users.bio`, `avatar_url`, `avatar_pid`, `city`, `looking_for` | Ajoutées |
| `notifications.link`, `notifications.metadata` | Ajoutées |
| `notifications_type_check` / `notifications_canal_check` | Étendues (`new_like`, `new_comment`, `new_follower`, `in_app`) |
| Table d'encouragement (pouce levé), backing `/patients/encouragements/received` | **Existe déjà mais nom exact de la table à confirmer par Claude Code** (`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%encourag%'`) avant d'écrire la moindre migration dessus |

### 1.2 Existant, incomplet (hérité de l'ancien doc Communauté)
| Table | État | Lacune |
|---|---|---|
| `clubs` | Existe | Pas de `status`, `conversation_id`, `image_url`, `description`, `sport_type`, `join_mode` |
| `club_members` | Existe (`patient_phone`) | Pas de `removed_at` (retrait par l'animateur) |
| `conversations` | Existe | Type manque `private` |
| `conversation_participants` | Existe | Manque `last_read_at` |
| `messages` | **ABSENTE** | À créer |
| `club_activities` | **ABSENTE** | À créer |

### 1.3 Vérification factuelle obligatoire avant rédaction du plan d'implémentation
Avant toute migration, Claude Code doit prouver par requête réelle :
1. Les groupes affichés sur la page d'accueil du dashboard patient proviennent-ils d'une vraie requête `SELECT * FROM clubs` ou sont-ils codés en dur dans le HTML ? Coller le code exact + le résultat de la requête.
2. Le classement d'un club affiche-t-il aujourd'hui le numéro de téléphone brut ou déjà un nom/prénom ? Coller le rendu réel (capture ou HTML généré).
3. Nom exact de la table d'encouragement existante + son schéma (`\d nom_table` sur Neon).

Tant que ces 3 réponses n'ont pas de preuve réelle collée, la section 5.4 (extension du classement) ne peut pas démarrer.

---

## 2. IDENTITÉ & PROFIL

### 2.1 Principe
Chaque adhérent a une seule identité visuelle cohérente partout dans l'app : **avatar + prénom/nom**, jamais un numéro de téléphone brut affiché à l'écran (le `phone` reste l'identifiant technique interne, jamais un identifiant visuel). Cette règle s'applique à : le feed, les commentaires, les notifications, le roster des clubs, la liste des participants Elonga, le chat.

### 2.2 Upload avatar
Réutilise le pattern déjà existant (upload photo de profil patient, Cloudinary). Un seul champ `users.avatar_url` consommé partout — jamais de duplication de la photo dans une autre table.

| Méthode | Route | Auth |
|---|---|---|
| POST | `/api/v1/profiles/me/avatar` | patient (multipart, Cloudinary) |
| GET | `/api/v1/profiles/:phone` | patient (profil public) |
| PATCH | `/api/v1/profiles/me` | patient (bio, city, looking_for, interests) |

### 2.3 Page profil public (« façon LinkedIn »)
Cliquer sur un avatar ou un nom n'importe où dans l'app (feed, commentaire, roster, participants) ouvre un panneau (bottom sheet, section 9) — jamais une nouvelle page — affichant :
- Photo, prénom/nom, bio, badges, ville
- Compteurs : abonnés / abonnements / clubs rejoints
- Bouton Suivre / Ne plus suivre (si ce n'est pas soi-même)
- Fil de ses posts publics (comme un mini-feed personnel, réutilise `GET /feed?author=:phone`)
- Section commentaires du profil (« mur », section 5.4)

```jsonc
// GET /api/v1/profiles/:phone
{
  "phone": "+242…", "full_name": "…", "avatar_url": "…", "bio": "…", "city": "…",
  "followers_count": 12, "following_count": 8, "clubs_count": 3,
  "is_following": false, "is_self": false
}
```

---

## 3. FEED (posts, likes, commentaires, suppression)

### 3.1 État
`posts`, `post_likes`, `post_comments` déjà en prod. Auto-publication déjà branchée sur `zora.service.js::awardZora()`, `clubs.controller.js::joinClub()`, `elonga-events.service.js::processCheckin()`.

### 3.2 Suppression d'un post — nouvelle règle
| Méthode | Route | Auth | Comportement |
|---|---|---|---|
| DELETE | `/api/v1/feed/posts/:id` | auteur du post uniquement | Soft delete (`posts.is_active = false` — colonne existante, ne pas créer `is_deleted`), jamais de DELETE physique (règle invariante section 8.2) |

Un post supprimé disparaît du feed de tout le monde mais reste en base (audit, anti-abus). Les likes/commentaires associés restent en base mais ne s'affichent plus (le post masqué les entraîne visuellement). Toute requête de lecture du feed doit filtrer `WHERE is_active = true` — **vérifier que c'est déjà le cas partout avant d'ajouter la route DELETE**, sinon un post désactivé continuerait à s'afficher.

Le bouton de suppression n'apparaît que sur ses propres posts (`post.author_phone === utilisateur connecté`), avec confirmation avant l'action (« Supprimer cette publication ? »).

### 3.3 Tri du feed
Chronologique décroissant (le plus récent en premier), sans filtre géographique — à ne pas confondre avec le tri « près de chez vous » de la page d'accueil, propre à Elonga (voir doc Elonga).

---

## 4. FOLLOWS

`follows` est déjà implémenté et en prod. **Correction officielle** : l'ancienne règle « follows → ne pas implémenter » (doc Communauté V3.0, section 13.6) est obsolète et annulée par ce document.

| Méthode | Route | Auth |
|---|---|---|
| POST | `/api/v1/follows/:phone` | patient |
| DELETE | `/api/v1/follows/:phone` | patient |
| GET | `/api/v1/follows/:phone/followers` | patient |
| GET | `/api/v1/follows/:phone/following` | patient |

---

## 4bis. CONFIDENTIALITÉ DES COMPTES (compte privé/public)
### STATUT : PRÉVU — NON IMPLÉMENTÉ (aucune preuve réelle à ce jour)

### 4bis.1 Principe
Par défaut, tout compte est public (`users.is_private = false`
prévu), comportement inchangé par rapport à l'existant. Un
adhérent pourra activer un statut privé depuis son profil.
Le modèle suit Instagram : compte public → suivi direct,
compte privé → suivi soumis à acceptation.

Ce mécanisme réutilisera le pattern déjà en place pour
`join_mode = 'approval'` sur les clubs (section 5) : une
table de demandes en attente, un statut
`pending/accepted/rejected`, une action explicite du
propriétaire pour débloquer l'accès.

### 4bis.2 Schéma prévu (non créé)
| Table / colonne | Rôle | État réel confirmé par audit du 6 juillet 2026 |
|---|---|---|
| `users.is_private` | BOOLEAN, défaut `false` | **N'existe pas** (grep + information_schema : 0 résultat) |
| `follow_requests` | Table dédiée : `requester_phone`, `target_phone`, `status`, `created_at`, `responded_at` | **N'existe pas** (grep : 0 résultat) |

### 4bis.3 Routes prévues (non créées)
| Méthode | Route | Auth | Comportement prévu |
|---|---|---|---|
| PATCH | `/api/v1/profiles/me` | patient | accepterait `is_private` en plus des champs existants |
| POST | `/api/v1/follows/:phone` | patient | si cible privée : créerait une ligne `follow_requests` pending au lieu d'un follow direct |
| GET | `/api/v1/follow-requests` | patient | listerait les demandes reçues en attente |
| PATCH | `/api/v1/follow-requests/:id` | patient | `{action:'accept'|'reject'}` |

État réel confirmé par audit : ces routes n'existent pas
dans `src/controllers/follows.controller.js` ni
`src/routes/follows.routes.js` à ce jour.

### 4bis.4 Effet prévu sur la visibilité
Si le compte visité est privé et que le visiteur n'est ni
l'auteur, ni un follower accepté, les routes suivantes
devraient retourner un contenu verrouillé (`locked:true`) :
`GET /profiles/:phone`, `GET /patients/profil-social/:phone`,
`GET /feed?author=:phone`. Non implémenté à ce jour.

### 4bis.5 Règle anti-fraude (rappel section 10)
Une fois implémentée, une demande de suivi acceptée/refusée
ne devra jamais créditer de Zora, comme toute interaction
sociale.

### 4bis.6 Mise à jour de ce statut
Ce bloc doit être corrigé ligne par ligne avec preuve
réelle (requête SQL, réponse HTTP, capture d'écran) UNE
FOIS l'implémentation terminée — jamais avant. Le statut
« PRÉVU — NON IMPLÉMENTÉ » en tête de section 4bis doit
être remplacé par la date de mise en production réelle
et les preuves T-priv1 à T-priv5 (à ajouter section 14.2)
au moment où le chantier sera codé.

---

## 5. CLUBS / GROUPES (fusion de l'ancienne section Communauté)

### 5.1 Cycle : `DRAFT → ACTIVE → ARCHIVED` (inchangé)

### 5.2 Schéma cible
```sql
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('draft','active','archived')),
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id),
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sport_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS join_mode VARCHAR(20) DEFAULT 'open'
    CHECK (join_mode IN ('open','approval'));

ALTER TABLE club_members
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS removed_by VARCHAR(20) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS club_join_requests (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by VARCHAR(20)
);

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

`join_mode = 'open'` par défaut (rejoindre en un clic) ; l'animateur peut passer son club en `'approval'` s'il veut valider chaque demande — ça évite d'imposer une friction à tous les clubs alors que le besoin de validation ne concerne pas forcément tous les groupes.

### 5.3 Modération animateur (4 pouvoirs confirmés)
| Pouvoir | Route | Effet |
|---|---|---|
| Retirer un membre | `DELETE /api/v1/animateur/clubs/:id/members/:phone` | `club_members.removed_at` renseigné (soft), retrait du chat associé |
| Supprimer un message du chat | `PATCH /api/v1/animateur/clubs/:id/messages/:messageId/moderate` | `messages.is_deleted = true` |
| Modifier la fiche du groupe | `PATCH /api/v1/clubs/:id` | animateur propriétaire uniquement |
| Valider une demande d'adhésion | `PATCH /api/v1/animateur/clubs/:id/requests/:requestId` | `{ decision: 'approved'\|'rejected' }` → si approuvé, insertion réelle dans `club_members` + ajout au chat |

L'animateur est le modérateur unique de son club — pas de rôle « co-modérateur » pour l'instant (à ouvrir plus tard si besoin).

### 5.4 Roster & classement — épuré et enrichi
Le classement (`GET /clubs/:id/members`) affiche désormais **prénom/nom + avatar**, jamais le téléphone brut :

```jsonc
// GET /api/v1/clubs/:id/members
{
  "items": [
    { "rank": 1, "phone_hidden": true, "display_name": "Marie K.", "avatar_url": "…",
      "zora_in_club": 3200, "encouragements_received": 4, "my_encouragement_sent": false }
  ]
}
```
`phone_hidden: true` signale explicitement au frontend qu'aucun numéro ne doit apparaître — le champ `phone` réel n'est même pas renvoyé dans cette réponse.

**Encouragement (pouce levé)** : réutilise la table existante (nom exact à confirmer, section 1.3), étendue avec un `club_id` optionnel pour tracer le contexte. Sert en priorité à motiver les membres avec peu de Zora — un membre en bas de classement encouragé plusieurs fois devrait recevoir une notification groupée (« 3 personnes t'ont encouragé cette semaine »).

**Commentaire de profil (« mur »)** — nouvelle table, séparée de `post_comments` pour ne pas toucher au schéma déjà en prod, mais alignée sur sa convention réelle (UUID, `phone` VARCHAR référencé, `is_active` — pas `is_deleted`) :
```sql
CREATE TABLE IF NOT EXISTS profile_comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_phone   VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  target_phone   VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  club_id        INTEGER REFERENCES clubs(id),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_comments_target ON profile_comments(target_phone, created_at DESC);
```
| Méthode | Route | Auth |
|---|---|---|
| POST | `/api/v1/profiles/:phone/comments` | patient |
| GET | `/api/v1/profiles/:phone/comments` | patient |
| DELETE | `/api/v1/profiles/comments/:id` | auteur du commentaire uniquement (soft delete) |

**Anti-fraude** (rappel section 7) : ni l'encouragement ni le commentaire de profil ne créditent de Zora. Ce sont des mécaniques purement sociales.

### 5.5 Popup club (même pattern qu'Elonga)
Clic sur la carte club (hors bouton) → panneau bottom sheet (section 9) affichant : photo, description, nombre de membres, date de création, animateur (avatar + nom, badge « Modérateur »), bouton contextuel (Rejoindre / Demande envoyée / Membre / Voir le classement).

### 5.6 Routes clubs (complètes)
| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/clubs` | patient |
| GET | `/api/v1/clubs/:id` | patient |
| GET | `/api/v1/clubs/:id/members` | patient (classement, roster épuré) |
| POST | `/api/v1/clubs` | patient (devient animateur) |
| POST | `/api/v1/clubs/:id/join` | patient (direct si `join_mode='open'`, sinon crée une demande) |
| POST | `/api/v1/clubs/:id/leave` | patient |
| POST | `/api/v1/clubs/:id/activities` | animateur du club |
| POST | `/api/v1/clubs/:id/members/:phone/encourage` | patient (pouce levé) |
| GET | `/api/v1/animateur/clubs` | animateur |
| GET | `/api/v1/animateur/clubs/:id/requests` | animateur (demandes en attente) |
| POST | `/api/v1/animateur/clubs/:id/notify` | animateur du club |

---

## 6. CHAT (inchangé, hérité tel quel du doc Communauté V3.0)

### 6.1 Types de conversation : `private` (2), `club` (N), `patient_medecin` (2)

### 6.2 Schéma cible
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

### 6.3 Socket.io (à brancher dans `chat.socket.js`)
Événements : `join_conversation` (vérifie JWT + participation), `send_message` (vérifie auth → INSERT `messages` → MAJ `last_message_at` → `io.to('conv_X').emit('new_message')`), `read_messages` (UPDATE `last_read_at`).

### 6.4 Routes chat
| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/chat/conversations` | participant |
| POST | `/api/v1/chat/conversations` | patient (créer privée) |
| GET | `/api/v1/chat/conversations/:id/messages` | participant |
| POST | `/api/v1/chat/conversations/:id/messages` | participant (fallback REST) |
| PATCH | `/api/v1/chat/conversations/:id/read` | participant |

**Règle invariante clubs** : créer un club → crée automatiquement une `conversation` de type `club` + ajoute l'animateur comme participant. Rejoindre un club (ou être approuvé) → ajoute le patient à `conversation_participants` de ce club.

---

## 7. NOTIFICATIONS — UN SEUL SYSTÈME (canal interne + WhatsApp)

### 7.1 Principe verrouillé
Un seul système de notifications (`notification.service.js` + table `notifications` existante, étendue), jamais de table ou service parallèle. Décision déjà actée pendant le sprint réseau social — ce document la confirme et l'étend aux clubs.

### 7.2 Canal interne (cloche header)
`GET /api/v1/notifications`, `/unread-count`, `PATCH /:id/read`, `/read-all` — déjà en place, types étendus avec ceux de la section 7.4.

### 7.3 Canal externe — WhatsApp (WAHA) — RÈGLE VERROUILLÉE
**Tout lien envoyé dans un message WhatsApp doit être un magic link, jamais une URL nue vers bolamu.co.** Le magic link réutilise le mécanisme déjà existant côté `login.html` (`checkMagicLink()`) : il connecte automatiquement l'adhérent et le dépose directement sur l'écran concerné (post, profil, club, événement), sans lui faire retaper son mot de passe. WhatsApp est le canal de redirection vers la plateforme, jamais une destination en soi.

Règle offline/online reprise du doc Communauté (5.3) : avant d'envoyer une notif WhatsApp pour une interaction sociale, si le destinataire est connecté en Socket.io → ne pas envoyer. S'il est offline → envoyer après 2 min (re-vérifier la connexion avant l'envoi).

### 7.4 Templates canoniques (noms exclusifs)
Hérités du doc Communauté : `bolamu_admin_event_soumis`, `bolamu_animateur_event_valide`, `bolamu_animateur_event_refuse`, `bolamu_event_publication`, `bolamu_event_inscription`, `bolamu_event_rappel`, `bolamu_checkin_confirme`, `bolamu_event_zora_credite`, `bolamu_animateur_nouveau_membre`, `bolamu_club_activite`, `bolamu_message_offline`.

Nouveaux (réseau social) : `bolamu_nouveau_like`, `bolamu_nouveau_commentaire`, `bolamu_nouveau_follower`, `bolamu_encouragement_recu`, `bolamu_commentaire_profil`, `bolamu_demande_adhesion_recue`, `bolamu_demande_adhesion_validee`, `bolamu_membre_retire`.

---

## 8. RÔLE ANIMATEUR (mis à jour)

Rôle distinct, validé par token + middleware. **Peut** : créer événements Elonga (→ validation admin, voir doc Elonga), gérer ses inscrits, scanner les QR, créer/gérer des clubs, modérer son club (section 5.3), notifier son club, programmer des activités. **Ne peut pas** : publier un événement directement sans validation admin, modifier les Zora d'un adhérent, accéder aux données médicales, modérer un club qui n'est pas le sien.

Dashboard animateur — 4 onglets inchangés : Accueil, Événements, Clubs (+ demandes d'adhésion en attente), Notifications.

---

## 9. FRONTEND — HUB UNIQUE

### 9.1 Principe (inchangé)
Un seul écran racine. Les « pages » sont des panneaux qui se substituent. **Popup = bottom sheet** (validé, section popup événement/club) — glisse depuis le bas, laisse le dashboard visible en transparence derrière, jamais un modal plein écran qui bloque tout.

- **Interdit** : `window.location`, `location.href`, nouvelle page HTML pour un profil/club/événement.
- **Autorisé** : `setActiveSection()`, `setSelectedClub()`, `setSelectedProfile()`, `setBottomSheetOpen()`.
- Priorité mobile 375 px · Plus Jakarta Sans · Material Symbols (zéro emoji) · fond `#FAF8FF`.

### 9.2 Arbre de navigation (fusionné)
```
Hub
├── Accueil (feed + événements près de chez vous, voir doc Elonga)
├── Feed → Post → [Likes · Commentaires · Suppression (auteur)]
├── Clubs → Fiche (bottom sheet) → [Membres/Classement · Activités · Discussion · Modération (animateur)]
├── Profil (le sien ou celui d'un autre) → [Posts · Mur/commentaires · Suivre]
├── Messages → Conversation
└── Notifications
```

**Audit préalable obligatoire** : la navigation actuelle du dashboard patient contient déjà des onglets (`Accueil`, `Feed`, `Gagner`, `Suivre`, `Récompenses` d'après une version antérieure du projet). Avant d'ajouter un nouvel onglet « Clubs » ou « Profil », vérifier l'état réel de la nav dans `dashboard.html` — un onglet existant peut déjà couvrir une partie du besoin (ex. `Suivre` pourrait déjà pointer vers les follows). Ne pas dupliquer un onglet qui existe sous un autre nom.

---

## 10. RÈGLE ANTI-FRAUDE (rappel, prioritaire sur tout)

Aucune interaction purement sociale (like, commentaire, follow, encouragement) ne crédite de Zora, directement ou indirectement. Le Zora reste exclusivement réservé aux preuves de présence/action définies dans le doc Elonga (scan QR) et dans les mécaniques déjà en place (`awardZora()`). Ce document n'ouvre aucune nouvelle voie de gain Zora.

---

## 11. MATRICE RBAC (mise à jour)

| Route | Patient | Animateur | Admin |
|---|---|---|---|
| `GET/POST/DELETE /follows/*` | ✅ | ✅ | ✅ |
| `GET /profiles/:phone`, `PATCH /profiles/me` | ✅ | ✅ | ✅ |
| `POST/GET/DELETE /profiles/:phone/comments` | ✅ | ✅ | ✅ |
| `GET/POST/DELETE /feed/posts/*` | auteur pour delete | auteur pour delete | ✅ |
| `GET /clubs` · `/:id` · `/:id/members` | ✅ | ✅ | ✅ |
| `POST /clubs` · `/join` · `/leave` · `/encourage` | ✅ | ✅ | ❌ |
| `DELETE /animateur/clubs/:id/members/:phone` | ❌ | animateur du club | ✅ |
| `PATCH /animateur/clubs/:id/messages/:id/moderate` | ❌ | animateur du club | ✅ |
| `PATCH /animateur/clubs/:id/requests/:id` | ❌ | animateur du club | ❌ |
| `GET/POST/PATCH /chat/*` | participant | participant | participant |

---

## 12. CONTRATS JSON (extraits clés)

```jsonc
// POST /clubs/:id/join  (join_mode = 'approval')
{ "status": "pending_request", "request_id": 12 }

// POST /clubs/:id/join  (join_mode = 'open')
{ "status": "joined", "conversation_id": 45 }

// GET /profiles/:phone/comments
{ "items": [ { "id":1, "author_phone_hidden":true, "author_display_name":"Junior", "author_avatar_url":"…", "content":"Bravo pour ta régularité !", "created_at":"…" } ] }

// Erreur standard (inchangée)
{ "error":"message lisible", "code":"CLUB_JOIN_PENDING_APPROVAL" }
```

---

## 13. RÈGLES INVARIANTES (reprises du doc Communauté, inchangées)
1. `phone` VARCHAR(20) identifiant universel · `normalizePhone()` avant tout INSERT/SELECT.
2. **Soft delete** (`is_active`/`is_deleted`), jamais DELETE physique.
3. `authMiddleware` sur toutes les routes (sauf publiques documentées).
4. `audit_log` sur toute action sensible (retrait de membre, suppression de message/post/commentaire).
5. Zora **uniquement par preuve système**, jamais auto-déclaré, jamais via une interaction sociale.
6. Toute écriture en **transaction avec ROLLBACK** en cas d'erreur.
7. Catch standard : `console.error('[context]', error.message); return res.status(500).json({ error: error.message });`
8. Jamais de numéro de téléphone brut affiché dans une UI patient — toujours prénom/nom + avatar.
9. Tout lien WhatsApp sortant est un magic link, jamais une URL nue.

---

## 14. SYSTÈME DE PREUVE & PLAN DE TEST

### 14.1 Principe
Rien n'est « fait » tant que sa preuve réelle n'est pas collée ici et verte. Aucune preuve simulée.

### 14.2 Matrice de tests à preuve

| # | Test | Type | Critère de réussite | Preuve réelle | ✅ |
|---|---|---|---|---|---|
| T1 | Groupes home = vraie requête DB, pas du HTML statique | Code+SQL | audit section 1.3 confirmé | | ☐ |
| T2 | Roster club sans numéro visible | HTTP | `phone` absent de la réponse, `display_name`+`avatar_url` présents | | ☐ |
| T3 | Encourager un membre | HTTP+SQL | ligne insérée, pas de Zora crédité | | ☐ |
| T4 | Commenter un profil | HTTP+SQL | ligne `profile_comments`, notif envoyée | | ☐ |
| T5 | Supprimer son propre post | HTTP+SQL | `posts.is_deleted=true`, disparaît du feed d'autrui | | ☐ |
| T6 | Impossible de supprimer le post d'un autre | HTTP | 403 | | ☐ |
| T7 | Club `join_mode=approval` : rejoindre crée une demande, pas un membre direct | HTTP+SQL | `club_join_requests` ligne `pending` | | ☐ |
| T8 | Animateur approuve une demande | HTTP+SQL | `club_members` + `conversation_participants` créés | | ☐ |
| T9 | Animateur retire un membre | HTTP+SQL | `removed_at` renseigné, retiré du chat | | ☐ |
| T10 | Animateur supprime un message du chat | HTTP+SQL | `messages.is_deleted=true` | | ☐ |
| T11 | Lien WhatsApp = magic link fonctionnel | HTTP | connexion auto sans re-saisie mot de passe | | ☐ |
| T12 | Popup club en bottom sheet | Navigateur | glisse depuis le bas, dashboard visible derrière | | ☐ |
| T13 | Profil ouvrable depuis n'importe quel avatar/nom | Navigateur | ouverture panneau, jamais nouvelle URL | | ☐ |
| T14 | Aucun gain Zora sur une interaction sociale | Code+SQL | grep confirmant l'absence de tout appel Zora dans les routes sociales | | ☐ |
| T15 | Tous les nouveaux appels clubs/Elonga utilisent `apiFetch()` | Code | grep confirmant l'absence de `fetch()` + token manuel hors FormData/Socket.io | | ☐ |
| T16 | Aucun onglet nav dupliqué | Code+Navigateur | audit de la nav existante collé, confirmant qu'aucun nouvel onglet ne fait doublon | | ☐ |
| T-priv1 | Colonne `users.is_private` existe en base | SQL | `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='is_private'` retourne 1 ligne | | ☐ |
| T-priv2 | Table `follow_requests` existe en base | SQL | `\d follow_requests` sur Neon affiche le schéma complet | | ☐ |
| T-priv3 | Activer compte privé via PATCH /profiles/me | HTTP+SQL | `is_private` passe à `true` en base, réponse API confirme | | ☐ |
| T-priv4 | Suivre un compte privé crée une demande | HTTP+SQL | ligne `follow_requests` avec `status='pending'` créée, pas de ligne dans `follows` | | ☐ |
| T-priv5 | Accepter une demande de suivi | HTTP+SQL | ligne `follow_requests` passe à `accepted`, ligne `follows` créée, pas de Zora crédité | | ☐ |

### 14.3 Règle de push
Aucun `git push` tant que les preuves des tests concernés ne sont pas collées et vertes. Validation manuelle à chaque fois.

---

## 15. PRÉCAUTIONS AVANT TOUTE IMPLÉMENTATION (retour d'expérience du sprint précédent)

Ces règles ne sont pas théoriques — chacune vient d'un incident réel rencontré pendant le sprint réseau social précédent. Claude Code doit les lire avant de toucher au moindre fichier.

### 15.1 Vérifier qu'aucune session concurrente ne tourne
Avant de commencer, confirmer explicitement qu'aucune autre session Claude Code, Cascade/Windsurf, ou extension VS Code n'est active sur ce même dépôt. Un incident réel a fait disparaître 10 fichiers nouvellement créés et annulé des éditions sur 7 fichiers existants (`server.js`, `notification.service.js`, `zora.service.js`, etc.) parce que deux sessions travaillaient en parallèle sur `bolamu-backend` sans le savoir. Si le moindre doute existe, s'arrêter et demander confirmation avant de continuer — ne jamais supposer que c'est réglé.

### 15.2 `dashboard.html` est un fichier partagé à haut risque
Ce fichier est modifié par au moins 4 chantiers différents (auth/session, feed, clubs, Elonga). Avant chaque commit touchant ce fichier :
- Faire un `git diff --cached` complet et le faire valider ligne par ligne avant `git commit` — jamais de staging par fichier entier (`git add public/patient/dashboard.html`) si d'autres chantiers ont aussi des changements non liés dans ce même fichier.
- Ne jamais présumer qu'un contenu affiché à l'écran (ex. les groupes sur la page d'accueil) reflète une vraie requête base de données — le vérifier par une requête SQL réelle avant d'écrire une ligne de doc ou de code dessus (cf. section 1.3).

### 15.3 Toujours utiliser `apiFetch()` pour les nouveaux appels API du feed/clubs/Elonga
Le helper `apiFetch()` (refresh silencieux + redirection session expirée) existe déjà dans `dashboard.html` et est déjà utilisé par les endpoints profil/zora/streaks/encouragements/score et par le feed. **Tout nouvel appel écrit pour les clubs ou pour Elonga doit utiliser `apiFetch()` dès l'écriture**, jamais un `fetch()` brut avec token manuel — sinon on réintroduit le bug de session zombie que ce helper a été créé pour éliminer. Seule exception légitime : les uploads `FormData` (le `Content-Type` forcé par `apiFetch()` casserait le multipart) et les échanges Socket.io (`authenticate` a besoin du token brut, pas d'un appel HTTP).

**Point de vigilance signalé mais non traité** : à ce jour, une trentaine d'appels API dans `dashboard.html` (rendez-vous, chat, clubs existants, paiements Momo) utilisent encore l'ancien pattern `fetch()` + token manuel et gardent donc le bug de session zombie sur ces écrans précis. Ce n'est pas dans le périmètre de ce document, mais toute nouvelle fonctionnalité clubs/Elonga qui touche à du code existant dans cette zone doit migrer l'appel touché vers `apiFetch()` au passage, sans élargir le chantier au-delà de ce qui est réellement modifié.

### 15.4 Discipline de commit
Jamais `git add -A`. Fichiers nommés individuellement, un commit par sujet fonctionnel (ex. : un commit pour la modération clubs, un commit séparé pour le popup bottom sheet, un commit séparé pour la suppression de post). Preuve réelle collée (section 14) avant chaque commit, `git diff --cached` revu avant chaque `git commit`, aucun `git push` sans validation explicite.

---

## 16. ORDRE D'IMPLÉMENTATION
1. Audit factuel (section 1.3) — bloquant, avant tout le reste.
2. Migrations clubs/messages/profile_comments/join_requests — preuve SQL (T1).
3. Backend : modération clubs, encouragement étendu, commentaires profil, suppression post, magic link WhatsApp — preuves HTTP/SQL (T2–T11).
4. Frontend : popup club en bottom sheet, profil ouvrable partout, roster épuré — preuves Navigateur (T12–T13).
5. Vérification anti-fraude finale (T14) avant tout push.

---

*Document unique de référence — Social & Communauté Bolamu. Une affirmation sans preuve n'est pas une réalisation.*
