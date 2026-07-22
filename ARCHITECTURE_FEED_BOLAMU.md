# ARCHITECTURE_FEED_BOLAMU.md
## Réseau social Bolamu — Feed · Stories · Reels · Follows (ÉTAT RÉEL)

> **Version 1.0 — 20 juillet 2026.**
> Ce document décrit **l'existant réel vérifié dans le code**, pas une vision.
> Sources lues ligne à ligne : `src/routes/{feed,stories,reels,follows}.routes.js`,
> `src/controllers/{feed,stories,reels,follows}.controller.js`, `src/services/feed.service.js`,
> `src/middleware/optionalAuth.middleware.js`, `src/server.js` (montage), `public/patient/dashboard.html`
> (appels réels), `database/migrations/{migration_067,migration_081,migration_090}.sql`.
> Toute affirmation ci-dessous est sourcée. Ce qui n'est pas confirmé par le code est signalé comme tel.

---

## 0. STATUT VIS-À-VIS DES DEUX DOCUMENTS SOCIAUX EXISTANTS

Deux documents antérieurs se contredisaient sur l'existence d'un feed :

| Document | Ce qu'il dit | Confirmé par le code ? |
|---|---|---|
| `docs/ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md` (V1.1) | Feed + Stories + Reels + Follows, accessibles à **tous les rôles** | ✅ **OUI — confirmé intégralement** |
| `docs/ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` (V4.0) | Communauté = Événements/Clubs/Chat, **pas de feed** ; anomalie 6 « `follows` → ne pas implémenter » | ❌ **Contredit par le code** (feed ET follows existent et sont montés) |

**Décision de conciliation (ce document fait foi avec `ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md`) :**
- `ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md` est **la version qui fait foi** pour le feed social, car le code applicatif réel confirme son contenu (routes montées, tables présentes, tous rôles autorisés).
- `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` reste **la référence pour Événements / Clubs / Chat** (non couverts ici), mais sa position « pas de feed » et son anomalie 6 (`follows` → ne pas implémenter) sont **dépréciées** — une note d'annotation a été ajoutée dans ce fichier (aucune ligne supprimée), renvoyant vers le présent document.

---

## 1. MONTAGE RÉEL DES ROUTES (`src/server.js`)

```js
app.use('/api/v1/feed',    require('./routes/feed.routes'));      // server.js:242
app.use('/api/v1/stories', require('./routes/stories.routes'));   // server.js:243
app.use('/api/v1/reels',   require('./routes/reels.routes'));     // server.js:244
app.use('/api/v1/follows', require('./routes/follows.routes'));   // server.js:245
```

Cron associé : `src/cron/stories-cleanup.js` (`jobStoriesCleanup`, toutes les heures) — nettoyage des stories expirées (`server.js:369-372`).

---

## 2. CONTRÔLE D'ACCÈS RÉEL (RBAC) — POINT CRITIQUE

**Aucune route du module social n'utilise de middleware de rôle.** Le contrôle est le suivant, vérifié dans les fichiers de routes :

| Middleware réel | Routes concernées | Effet |
|---|---|---|
| `optionalAuth` | `GET /feed`, `GET /reels` | **Public** : accessible sans token. Si token présent et valide → `req.user` peuplé, sinon `req.user = null` (`optionalAuth.middleware.js:8-25`). |
| `authMiddleware` | **toutes les autres** routes feed/stories/reels/follows | Tout utilisateur **authentifié**, quel que soit son rôle. |

**Conséquence vérifiée : le check n'est PAS un check RBAC par rôle — il est codé en dur au niveau "authentifié / non authentifié".** Tous les rôles (`patient`, `doctor`, `secretaire`, `pharmacie`, `laboratoire`, `animateur`, `rh`, `agent_bolamu`, `content_admin`, `admin`) ont donc un accès **identique** au feed, aux stories, aux reels et aux follows. Cela confirme mot pour mot `ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md` §5 (« Tous les rôles sans exception ont accès au feed »).

**La confidentialité n'est PAS gérée par rôle mais par compte** : `users.is_private` + table `follows`, via `isPostVisibleTo(postId, viewerPhone)` (`feed.service.js:81-104`). Un post est visible si : actif, non expiré, ET (`type='system'` OU auteur = viewer OU compte auteur public OU viewer suit l'auteur). Retour `404` (jamais `403`) si non visible.

---

## 3. SCHÉMA BASE DE DONNÉES RÉEL

### 3.1 Tables du module

```sql
-- posts (posts manuels, système, stories, reels)
posts (
  id              UUID PK DEFAULT gen_random_uuid(),
  author_phone    VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content         TEXT,
  photo_url       VARCHAR(500),        -- image (posts/stories) ou vidéo Cloudinary (stories/reels)
  photo_public_id VARCHAR(200),
  type            VARCHAR(20) NOT NULL DEFAULT 'manual',
                  -- valeurs réelles : 'manual' | 'system' | 'story' | 'reel'
                  -- ('reel' ajouté par migration_081 ; le CHECK d'origine ne listait que
                  --  manual/system/story — cf. §7 écart 3)
  city            VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete
  expires_at      TIMESTAMPTZ,          -- NULL = permanent ; renseigné pour stories (24h)
  metadata        JSONB DEFAULT '{}',   -- posts système : {zora_amount, category, club_name, event_name}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  phone   VARCHAR(20) REFERENCES users(phone) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, phone)
);

post_comments (
  id UUID PK DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  phone   VARCHAR(20) REFERENCES users(phone) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete
  created_at TIMESTAMPTZ DEFAULT NOW()
);

story_views (
  story_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  phone    VARCHAR(20) REFERENCES users(phone) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (story_id, phone)
);

-- migration_090_create_follows_table.sql
follows (
  follower_phone  VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  following_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_phone, following_phone),
  CHECK (follower_phone <> following_phone)
);

-- migration_067_private_accounts.sql
follow_requests (
  id SERIAL PK,
  requester_phone VARCHAR(20) NOT NULL,
  target_phone    VARCHAR(20) NOT NULL,
  status          -- 'pending' | 'accepted' | 'rejected'
  created_at, responded_at,
  UNIQUE (requester_phone, target_phone)
);
```

### 3.2 Colonnes `users` utilisées par le module

- `is_private` (BOOLEAN, migration_067) — compte privé → passe par `follow_requests`.
- `photo_url` — **colonne réelle de l'avatar** (utilisée par feed/stories/reels).
- `avatar_url` — colonne présente (ALTER TABLE du doc RESEAU_SOCIAL §3) mais **considérée morte** par `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §9 ; **encore lue par `follows.controller.js`** (cf. §7 écart 1).
- `bio`, `city`, `looking_for` — profil social (lues par `getProfile`/`getSuggestions`).

### 3.3 Provenance des migrations (constat)

- `follows` → `migration_090_create_follows_table.sql` ✅
- `follow_requests` + `users.is_private` → `migration_067_private_accounts.sql` ✅
- `posts.type='reel'` → `migration_081_add_reel_post_type.sql` ✅
- **`posts`, `post_likes`, `post_comments`, `story_views`, `notifications_inapp` : aucun fichier de migration trouvé dans `database/migrations/`** (grep exhaustif). Le schéma correspondant n'existe que dans `docs/ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md` §3, qui indique de l'exécuter « via script Node.js temporaire (supprimer après exécution) ». Ces tables ont donc été **créées en base directement, hors du dossier migrations** — dette de traçabilité à signaler (le code s'appuie dessus et fonctionne, mais aucune migration versionnée ne les recrée).

---

## 4. ENDPOINTS FEED — `/api/v1/feed` (`feed.routes.js`, `feed.controller.js`)

### 4.1 `GET /api/v1/feed` — `optionalAuth` — `getFeed`
- **Query** : `page=1`, `limit=20`, `city` (optionnel), `author` (optionnel = filtre par auteur avec verrouillage privé).
- **Logique** : sans `author`, retourne les posts dont l'auteur = moi, OU que je suis (`follows`), OU `type='system'` ; filtre `is_active`, non expiré, `type IN ('manual','system','reel')`, `city` optionnelle.
- **Réponse** `200` :
```jsonc
{ "success": true, "page": 1, "data": [ {
    "id":"<uuid>", "author_phone":"+242…", "content":"…", "photo_url":"…|null",
    "type":"manual|system|reel", "city":"…|null", "metadata":{…}, "created_at":"…",
    "author_name":"…", "author_avatar":"…|null", "author_role_label":"Médecin|Patient|…",
    "likes_count":"3", "comments_count":"1", "liked_by_me":true
} ] }
```
- **Variante compte privé non suivi** : `{ "success":true, "data":[], "locked":true, "page":1 }`.
- **Note** : `role`/`specialty` sont supprimés et remplacés par `author_role_label` (`withRoleLabel()`, `utils/roleLabels.js`). Compteurs renvoyés en **string** (agrégats SQL).

### 4.2 `POST /api/v1/feed` — `authMiddleware` + `upload.single('photo')` — `createPost`
- **Body** (multipart) : `content` (texte), `city` (optionnel), fichier `photo` (optionnel). Au moins un de `content`/`photo` requis, sinon `400 EMPTY_POST`.
- Upload Cloudinary (`folder: bolamu/posts`). INSERT `type='manual'`.
- **Réponse** `201` : `{ "success":true, "data": <ligne posts complète> }`.

### 4.3 `POST /api/v1/feed/:postId/like` — `authMiddleware` — `toggleLike`
- Toggle : supprime le like s'il existe, sinon l'insère + notifie l'auteur (`notifyLite`, type `new_like`).
- **Réponse** : `{ "success":true, "liked": true|false }`. `404 POST_NOT_FOUND` si non visible.

### 4.4 `GET /api/v1/feed/:postId/comments` — `authMiddleware` — `getComments`
- **Réponse** : `{ "success":true, "data":[ { "id","post_id","phone","content","is_active","created_at","author_name","author_avatar","author_role_label" } ] }` (actifs uniquement, ordre croissant). `404` si post non visible.

### 4.5 `POST /api/v1/feed/:postId/comments` — `authMiddleware` — `addComment`
- **Body** : `{ "content":"…" }` (non vide, sinon `400 EMPTY_COMMENT`). Notifie l'auteur (type `new_comment`).
- **Réponse** `201` : `{ "success":true, "data": <ligne post_comments> }`.

### 4.6 `DELETE /api/v1/feed/:postId/comments/:id` — `authMiddleware` — `deleteComment`
- Soft delete (`is_active=FALSE`) **de son propre commentaire uniquement** (`WHERE id=$1 AND phone=$2`). `{ "success":true }`.

### 4.7 `POST /api/v1/feed/:postId/report` — `authMiddleware` — `reportPost`
- **Body** : `{ "reason":"…" }` (requis, sinon `400 REASON_REQUIRED`). INSERT `audit_log(event_type='post_reported', target_id=NULL, payload::jsonb {post_id, reason})`. Ne masque rien. `201 { "success":true }`.

### 4.8 `POST /api/v1/feed/comments/:commentId/report` — `authMiddleware` — `reportComment`
- **Body** : `{ "reason":"…" }`. `audit_log(event_type='comment_reported')`. `201 { "success":true }`.

### 4.9 `DELETE /api/v1/feed/:postId` — `authMiddleware` — `deletePost`
- Soft delete de **son propre post** (`WHERE id=$1 AND author_phone=$2`). `{ "success":true }`.

### 4.10 `GET /api/v1/feed/profile/:phone` — `authMiddleware` — `getProfile`
- **Réponse** : `{ "success":true, "data": { "phone","full_name","bio","avatar_url","city","looking_for","is_private","following_count","followers_count","posts_count","is_following","is_self","posts":[…], "locked?":true } }`.
- **Note** : `avatar_url` ici = `photo_url` aliasé (`SELECT photo_url AS avatar_url`). `posts` (12 derniers, `type='manual'`) omis si `locked`.

### 4.11 `GET /api/v1/feed/suggestions` — `authMiddleware` — `getSuggestions`
- Membres non suivis, `is_active`, triés par `followers_count DESC, RANDOM()`, limite 8.
- **Réponse** : `{ "success":true, "data":[ { "phone","full_name","avatar_url","city","bio","author_role_label","followers_count" } ] }` (`avatar_url` = `photo_url` aliasé).

---

## 5. ENDPOINTS STORIES / REELS / FOLLOWS

### 5.1 Stories — `/api/v1/stories` (`stories.controller.js`) — éphémère 24h (`posts.type='story'`)
| Méthode | Route | Auth | Réponse |
|---|---|---|---|
| GET | `/` | `authMiddleware` | `{success,data:[{id,author_phone,photo_url,content,created_at,expires_at,author_name,author_avatar,views_count,viewed_by_me}]}` — stories des follows + siennes, non expirées, tri `viewed_by_me ASC, created_at DESC` |
| POST | `/` | `authMiddleware` + `upload.single('media')` | `201 {success,data:<post>}` — `content`/`media` (image ou vidéo ≤60s), `expires_at=+24h`, `type='story'` |
| POST | `/:storyId/view` | `authMiddleware` | `{success}` — INSERT `story_views` ON CONFLICT DO NOTHING |
| GET | `/:storyId/viewers` | `authMiddleware` (propriétaire, sinon `403 FORBIDDEN`) | `{success,data:[{viewed_at,full_name,photo_url,phone}]}` |
| DELETE | `/:storyId` | `authMiddleware` | `{success}` — soft delete de sa story |

### 5.2 Reels — `/api/v1/reels` (`reels.controller.js`) — vidéo courte permanente (`posts.type='reel'`)
| Méthode | Route | Auth | Réponse |
|---|---|---|---|
| GET | `/` | `optionalAuth` | `{success,data:[…],page}` — reels des follows + siens (même confidentialité que le feed) ; mêmes champs que `getFeed` |
| POST | `/` | `authMiddleware` + `upload.single('media')` | `201 {success,data:<post>}` — **fichier vidéo requis** (`400 MEDIA_REQUIRED`), `type='reel'`, pas d'`expires_at` |
| DELETE | `/:reelId` | `authMiddleware` | `{success}` — soft delete de son reel |

**Likes/commentaires des reels** : réutilisent tels quels `POST /api/v1/feed/:postId/like` et `/comments` (le contrôleur feed n'est pas restreint par type de post).

### 5.3 Follows — `/api/v1/follows` (`follows.controller.js`)
| Méthode | Route | Auth | Réponse |
|---|---|---|---|
| GET | `/following` | `authMiddleware` | `{success,data:[{phone,full_name,avatar_url,city,created_at}]}` |
| GET | `/followers` | `authMiddleware` | `{success,data:[{phone,full_name,avatar_url,city,created_at}]}` |
| GET | `/status/:phone` | `authMiddleware` | `{success,data:{i_follow:bool,follows_me:bool}}` |
| POST | `/:phone` | `authMiddleware` | compte public → `201 {success}` (follow direct + notif `new_follower`) ; compte privé → `201 {success,status:'pending_request',request_id}` (crée `follow_requests`, notif `follow_request`). Erreurs : `400 SELF_FOLLOW`, `404 USER_NOT_FOUND`, `400 REQUEST_ALREADY_PENDING`, `400 ALREADY_FOLLOWING` |
| DELETE | `/:phone` | `authMiddleware` | `{success}` — DELETE `follows` |
| GET | `/follow-requests` | `authMiddleware` | `{success,data:[{id,requester_phone,full_name,avatar_url,created_at}]}` (status `pending` reçues) |
| PATCH | `/follow-requests/:id` | `authMiddleware` | body `{action:'accept'|'reject'}` → crée le `follows` si accept, met à jour la demande, `audit_log`, notif. `{success}`. Erreurs : `400 INVALID_ACTION`, `404 REQUEST_NOT_FOUND`, `403 FORBIDDEN`, `400 REQUEST_ALREADY_PROCESSED` |

---

## 6. POSTS SYSTÈME AUTOMATIQUES (`feed.service.js`)

Insérés (`type='system'`, visibles de tous via `isPostVisibleTo`) par des services métier :
- `postZoraEarned(phone, amount, category)` — contenu `« vient de gagner {amount} Zora Points »`, `metadata={zora_amount,category}`.
- `postClubJoined(phone, clubName)` — `« vient de rejoindre le club {clubName} »`.
- `postEventCheckin(phone, eventName)` — `« a participé à l'événement {eventName} »`.

### 6.1 Double mécanisme de post automatique — CONSTAT FACTUEL (vérifié 20/07/2026, non corrigé)

Deux mécanismes de « post automatique » coexistent, mais **écrivent dans deux destinations différentes** — ce n'est donc **pas** un doublon dans le même feed :

| Mécanisme | Destination réelle | Table |
|---|---|---|
| `feed.service.js` (`postZoraEarned`/`postClubJoined`/`postEventCheckin`) | **Feed social** | `posts` (`type='system'`) |
| `chat.service.js` → `postAchievement()` | **Chat communauté** (conversation `type='communaute'`) | `messages` (`INSERT INTO messages`, `chat.service.js:38-43`) |

**Appels réels dans le code actif** (grep des appels, pas des définitions) :
- `feed.service.postZoraEarned` ← **`src/services/zora.service.js:250`** (dans `awardZora()`, **inconditionnel** pour tout earn réussi).
- `chat.service.postAchievement` ← **`src/services/zora.service.js:238`**, **conditionné** à `achievementActions = ['bilan_annuel','vaccination','event_checkin','streak_7','streak_30']` (`zora.service.js:235-236`).
- `feed.service.postClubJoined` ← **`src/controllers/clubs.controller.js:149`** (dans `joinClub`).
- `feed.service.postEventCheckin` ← **`src/services/elonga-events.service.js:318`** (dans `processCheckin`).

**Sont-ils actifs en même temps ? OUI, pour 5 `action_type`.** Dans `awardZora()`, pour `bilan_annuel`/`vaccination`/`event_checkin`/`streak_7`/`streak_30`, les **deux** appels se déclenchent (`zora.service.js:238` chat **ET** `:250` feed) → le même événement apparaît **une fois dans le chat communauté** et **une fois dans le feed**. Pour tous les autres `action_type`, seul le feed (`postZoraEarned`) est alimenté.

**Risque de doublon réel identifié pour `event_checkin`** : un check-in Elonga produit potentiellement **deux posts distincts dans le feed** — `postEventCheckin` (« a participé à l'événement {X} », `elonga-events.service.js:318`) **et** `postZoraEarned` (« vient de gagner {N} Zora Points », `zora.service.js:250` si l'earn `event_checkin` passe) — **plus** un message dans le chat communauté (`postAchievement`, `zora.service.js:238`). Constat factuel, **non corrigé** ici (à trancher par `/tech-lead`).

---

## 7. USAGE FRONTEND RÉEL — DASHBOARD PATIENT (source de vérité)

`public/patient/dashboard.html` (fonctions objet `A.*`) appelle via `apiFetch(...)` en URL absolue `https://api.bolamu.co/api/v1/...` :

| Fonction JS | Endpoint appelé |
|---|---|
| `A.loadFeed()` (`dashboard.html:5193`) | `GET /feed?page&limit&city` |
| `A.toggleLike()` (`:5259`) | `POST /feed/:postId/like` |
| `A.loadComments()` (`:5288`) | `GET /feed/:postId/comments` |
| envoi commentaire (`:5338`) | `POST /feed/:postId/comments` |
| `A.deleteComment()` (`:5360`) | `DELETE /feed/:postId/comments/:id` |
| signalement (`:5390-5391`) | `POST /feed/:postId/report` ou `/feed/comments/:id/report` |
| création post (`:5451`) | `POST /feed` (FormData, champ `photo`) |
| `A.loadStories()` (`:5467`) | `GET /stories` |
| vue story (`:5538`) | `POST /stories/:id/view` |
| création story/reel (`:5619`) | `POST /stories` ou `POST /reels` (FormData, champ `media`) |
| `A.loadReels()` (`:5644`) | `GET /reels?limit=10` |
| `A.toggleReelLike()` (`:5700`) | `POST /feed/:reelId/like` |
| `A.loadSuggestions()` (`:5731`) | `GET /feed/suggestions` |
| `A.followUser()` (`:5777`) | `POST /follows/:phone` |
| demandes de suivi (`:4674`,`:4719`,`:4743`) | `GET /follows/follow-requests`, `PATCH /follows/follow-requests/:id` |

---

## 8. ÉCARTS ET DETTE TECHNIQUE RÉELS (constatés dans le code, non corrigés ici)

1. **Incohérence colonne avatar** : `follows.controller.js` (`getFollowing`/`getFollowers`/`getFollowRequests`) fait `SELECT u.avatar_url`, colonne considérée **morte** par `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §9 → renvoie probablement `NULL` pour les avatars, alors que `feed.controller.js`/`stories`/`reels` lisent correctement `u.photo_url`. À trancher : migrer `follows.controller.js` sur `photo_url AS avatar_url`.
2. **Nommage `avatar_url` dans les réponses** : `getProfile`/`getSuggestions` renvoient la clé `avatar_url` mais alimentée par `photo_url` aliasé — nommage trompeur mais fonctionnel.
3. **`posts.type` CHECK** : le schéma du doc RESEAU_SOCIAL §3 ne listait que `('manual','system','story')` ; `migration_081` a ajouté `'reel'`. Ensemble réel autorisé = `manual|system|story|reel`.
4. **Tables sans migration versionnée** : `posts`, `post_likes`, `post_comments`, `story_views`, `notifications_inapp` ne sont recréées par aucun fichier de `database/migrations/` (§3.3) — dette de traçabilité.
5. **`GET /feed` public (`optionalAuth`)** : un visiteur non authentifié ne voit que les posts `type='system'` (avec `$1=null`, seule la branche `p.type='system'` est vraie). Comportement voulu mais non documenté jusqu'ici.

---

## 9. RÔLES — SYNTHÈSE POUR LE DASHBOARD MÉDECIN (préparation Phase 5)

Le rôle `doctor` a **exactement les mêmes droits** que tout autre rôle authentifié sur ce module (aucun check RBAC spécifique) :
- Il peut lire le feed, créer des posts/stories/reels, liker, commenter, signaler, suivre/être suivi, voir un profil, recevoir des suggestions.
- Le feed inclut d'ailleurs déjà un `LEFT JOIN doctors d ON d.phone = u.phone` pour exposer `d.specialty` → `author_role_label` (ex. « Médecin · Cardiologie ») — le rôle médecin est donc **déjà pris en compte côté données** dans les réponses feed.

Ce qui reste à établir en Phase 5 : ce que `public/medecin/dashboard-v2.html` implémente réellement vs ce contrat.

---

*Document d'état réel — Feed Bolamu V1.0 — 20 juillet 2026. Fait foi avec `ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md`.*
