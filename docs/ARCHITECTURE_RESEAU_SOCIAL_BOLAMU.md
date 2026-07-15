# ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md
> Version 1.1 — Juillet 2026  
> Auteur : King (NBA Gestion SARLU)  
> Agent d'exécution : Claude Code (Windsurf)

---

## 0. RÈGLES ABSOLUES À RESPECTER

```
1. Zéro émoji dans tout le code HTML/CSS/JS — Material Symbols Outlined uniquement
2. Design system Bolamu strict : Plus Jakarta Sans, #FAF8FF, navy #0A2463,
   turquoise #00C9A7, orange #FF6B35, gold #F5A623, border-radius 2rem
3. Toutes les notifications passent par whatsapp.service.js → sendAutoMessage()
   (whatsapp.service.META.DEPRECATED.js est l'ancienne version Meta, ne plus l'utiliser)
   jamais d'appel WAHA direct
4. Tests contre bolamu.co uniquement — jamais localhost
5. Pas de git push sans validation King explicite
6. Pas de git add -A — uniquement les fichiers nommés
7. DCLogic est le moteur de template — rendu server-side uniquement
```

---

## 1. VUE D'ENSEMBLE

On ajoute un **réseau social santé** au dashboard patient de Bolamu.  
Inspiré de Strava + Sweatcoin, ancré santé, filtré par ville (essentiel Congo-Brazzaville).

### Fonctionnalités principales
- **Feed** — fil social chronologique avec posts manuels et posts système automatiques
- **Stories** — contenu éphémère 24h (photo ou vidéo courte)
- **Reels** — vidéos courtes verticales (`posts.type = 'reel'`), pas d'expiration (contrairement aux stories qui expirent à 24h). Viewer plein écran, scroll vertical (`scroll-snap-type: y mandatory`)
- **Lives** — streaming temps réel (Phase 2 — roadmap documentée ici, non implémentée)

### Philosophie
- Feed = mode découverte et engagement social
- Stories = moment de vie, spontané, éphémère
- Posts système automatiques = engagement passif (comme Strava Kudos)
- WhatsApp = pont offline quand l'utilisateur n'est pas sur la plateforme

---

## 2. NAVIGATION — STRUCTURE FINALE

### Desktop (top nav — centré, proportionnel)
```
[ Accueil ]  [ Feed ]  [ Gagner ]  [ Suivre ]  [ Récompenses ]
```

### Mobile (bottom nav)
```
Accueil | Feed | Gagner | Suivre | Récompenses
```
Icônes Material Symbols : `home` | `dynamic_feed` | `add_circle` | `trending_up` | `card_giftcard`

### Fix CSS centrage nav — PRIORITAIRE
Le header actuel a la nav décalée. Correction à appliquer dans `dashboard.html` :

```css
/* AVANT */
.nav-desktop { /* alignement incorrect */ }

/* APRÈS */
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
}

.nav-desktop {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-desktop .nav-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 2rem;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--brand-navy);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.nav-desktop .nav-btn:hover,
.nav-desktop .nav-btn.active {
  background: rgba(10, 36, 99, 0.08);
}
```

---

## 3. BASE DE DONNÉES — NOUVELLES TABLES SQL

Exécuter dans Neon PostgreSQL via script Node.js temporaire (supprimer après exécution).

```sql
-- ============================================================
-- TABLE : posts
-- Posts manuels ET posts système automatiques
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_phone    VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content         TEXT,
  photo_url       VARCHAR(500),
  photo_public_id VARCHAR(200),
  type            VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (type IN ('manual', 'system', 'story')),
  city            VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,            -- NULL = permanent, renseigné pour stories (24h)
  metadata        JSONB DEFAULT '{}',     -- données système : zora_amount, club_name, event_name…
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_author    ON posts(author_phone);
CREATE INDEX idx_posts_type      ON posts(type);
CREATE INDEX idx_posts_city      ON posts(city);
CREATE INDEX idx_posts_created   ON posts(created_at DESC);
CREATE INDEX idx_posts_expires   ON posts(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- TABLE : post_likes
-- Un seul like par utilisateur par post
-- ============================================================
CREATE TABLE IF NOT EXISTS post_likes (
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  phone       VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, phone)
);

CREATE INDEX idx_post_likes_post ON post_likes(post_id);

-- ============================================================
-- TABLE : post_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  phone       VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);

-- ============================================================
-- TABLE : follows
-- Système d'abonnements entre patients
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  follower_phone  VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  following_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_phone, following_phone),
  CHECK (follower_phone <> following_phone)
);

CREATE INDEX idx_follows_follower  ON follows(follower_phone);
CREATE INDEX idx_follows_following ON follows(following_phone);

-- ============================================================
-- TABLE : stories_views
-- Traçabilité des vues de stories
-- ============================================================
CREATE TABLE IF NOT EXISTS story_views (
  story_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  phone       VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, phone)
);

-- ============================================================
-- TABLE : notifications_inapp
-- Centre de notifications in-app (cloche header)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications_inapp (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
              -- 'new_like' | 'new_comment' | 'new_follower' |
              -- 'story_view' | 'system_zora' | 'system_club' | 'system_event'
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  link        VARCHAR(300),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_phone     ON notifications_inapp(phone);
CREATE INDEX idx_notif_unread    ON notifications_inapp(phone, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notif_created   ON notifications_inapp(created_at DESC);

-- ============================================================
-- AJOUT COLONNES users (si absentes)
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio          VARCHAR(300),
  ADD COLUMN IF NOT EXISTS avatar_url   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS avatar_pid   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS city         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS looking_for  VARCHAR(200);  -- "Partenaire de marche", etc.
```

---

## 4. ROUTES BACKEND — FICHIERS À CRÉER

### 4.1 Structure fichiers

```
src/
  controllers/
    feed.controller.js          ← NOUVEAU
    stories.controller.js       ← NOUVEAU
    follows.controller.js       ← NOUVEAU
    notifications.controller.js ← NOUVEAU
  routes/
    feed.routes.js              ← NOUVEAU
    stories.routes.js           ← NOUVEAU
    follows.routes.js           ← NOUVEAU
    notifications.routes.js     ← NOUVEAU
  services/
    feed.service.js             ← NOUVEAU (posts système automatiques)
    cloudinary.service.js       ← MODIFIER (ajouter upload posts/stories)
  middleware/
    upload.middleware.js        ← VÉRIFIER (multer déjà présent ?)
```

---

### 4.2 Routes Feed — `src/routes/feed.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const feedCtrl = require('../controllers/feed.controller');

// Feed principal — posts des follows + clubs + système
router.get('/',                         auth, feedCtrl.getFeed);

// Créer un post manuel (texte ou texte + photo)
router.post('/',                        auth, upload.single('photo'), feedCtrl.createPost);

// Like / unlike
router.post('/:postId/like',            auth, feedCtrl.toggleLike);

// Commentaires
router.get('/:postId/comments',         auth, feedCtrl.getComments);
router.post('/:postId/comments',        auth, feedCtrl.addComment);
router.delete('/:postId/comments/:id',  auth, feedCtrl.deleteComment);

// Supprimer son propre post
router.delete('/:postId',               auth, feedCtrl.deletePost);

// Profil social d'un patient
router.get('/profile/:phone',           auth, feedCtrl.getProfile);

// Suggestions de membres à suivre (par ville)
router.get('/suggestions',              auth, feedCtrl.getSuggestions);

// Signaler un post
router.post('/:postId/report',              auth, feedCtrl.reportPost);

// Signaler un commentaire
router.post('/comments/:commentId/report',  auth, feedCtrl.reportComment);

module.exports = router;
```

---

### 4.3 Routes Stories — `src/routes/stories.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const storiesCtrl = require('../controllers/stories.controller');

// Stories actives des follows (non expirées)
router.get('/',                     auth, storiesCtrl.getActiveStories);

// Créer une story (photo ou vidéo courte — max 60s)
router.post('/',                    auth, upload.single('media'), storiesCtrl.createStory);

// Marquer une story comme vue
router.post('/:storyId/view',       auth, storiesCtrl.markViewed);

// Voir qui a vu ma story
router.get('/:storyId/viewers',     auth, storiesCtrl.getViewers);

// Supprimer sa story
router.delete('/:storyId',          auth, storiesCtrl.deleteStory);

module.exports = router;
```

---

### 4.4 Routes Follows — `src/routes/follows.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const followsCtrl = require('../controllers/follows.controller');

// Suivre un utilisateur
router.post('/:phone',          auth, followsCtrl.follow);

// Ne plus suivre
router.delete('/:phone',        auth, followsCtrl.unfollow);

// Liste de mes abonnements
router.get('/following',        auth, followsCtrl.getFollowing);

// Liste de mes abonnés
router.get('/followers',        auth, followsCtrl.getFollowers);

// Statut follow entre deux utilisateurs
router.get('/status/:phone',    auth, followsCtrl.getStatus);

module.exports = router;
```

---

### 4.5 Routes Notifications — `src/routes/notifications.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notifCtrl = require('../controllers/notifications.controller');

// Mes notifications (paginées)
router.get('/',                 auth, notifCtrl.getNotifications);

// Nombre de non lues (pour la cloche header)
router.get('/unread-count',     auth, notifCtrl.getUnreadCount);

// Marquer une notif comme lue
router.put('/:id/read',         auth, notifCtrl.markRead);

// Tout marquer comme lu
router.put('/read-all',         auth, notifCtrl.markAllRead);

module.exports = router;
```

---

### 4.6 Routes Reels — `src/routes/reels.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const reelsCtrl = require('../controllers/reels.controller');

// GET /api/v1/reels — reels paginés, même filtre de confidentialité que getFeed
router.get('/',   authMiddleware, reelsCtrl.getReels);

// POST /api/v1/reels — publier un reel (upload vidéo via multer/Cloudinary)
router.post('/',  authMiddleware, upload.single('video'), reelsCtrl.createReel);

module.exports = router;
```

---

### 4.7 Routes Admin Modération Feed — `src/routes/admin-feed.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminFeedCtrl = require('../controllers/admin-feed.controller');

// GET /api/v1/admin/feed/reports — liste des signalements
// (croise audit_log sur post_reported / comment_reported)
// ?include_resolved=true pour voir aussi les signalements déjà traités
router.get('/reports',        authMiddleware, adminFeedCtrl.getReports);

// PATCH /api/v1/admin/feed/posts/:id — masquer ou supprimer un post
// body: { action: 'hide'|'delete', reason }
router.patch('/posts/:id',    authMiddleware, adminFeedCtrl.moderatePost);

// PATCH /api/v1/admin/feed/comments/:id — même chose sur un commentaire
router.patch('/comments/:id', authMiddleware, adminFeedCtrl.moderateComment);

module.exports = router;
```

---

### 4.8 Enregistrer les routes dans `app.js` ou `index.js`

```javascript
// Ajouter après les routes existantes
app.use('/api/feed',          require('./routes/feed.routes'));
app.use('/api/stories',       require('./routes/stories.routes'));
app.use('/api/follows',       require('./routes/follows.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/v1/reels',      require('./routes/reels.routes'));
app.use('/api/v1/admin/feed', require('./routes/admin-feed.routes'));
```

---

## 5. CONTRÔLE D'ACCÈS ET SÉCURITÉ

- Tous les rôles sans exception ont accès au feed (patient, médecin, secrétaire, pharmacie, laboratoire, animateur, partenaire, rh) — même logique que Facebook/LinkedIn, le feed est le cœur du réseau pour tous les membres.
- Fonction `isPostVisibleTo(postId, viewerPhone)` dans `feed.service.js` — vérifiée en tête de `toggleLike`, `addComment`, `getComments`, `deleteComment`. Retourne `404` (pas `403`) si le post n'est pas visible (inactif, expiré, profil privé non suivi).
- `content_admin` peut masquer et supprimer posts et commentaires (pas seulement lecture). Accès : `/admin/stats`, `/admin/users` (lecture) + `/admin/feed/reports`, `/admin/feed/posts/:id`, `/admin/feed/comments/:id` (modération). Toujours sans accès financier ni configuration plateforme.

---

## 6. MODÉRATION

- **Signalement** : ne masque rien automatiquement, alimente uniquement la file de modération dans `audit_log` (`event_type: 'post_reported'` / `'comment_reported'`, `actor_phone`, `target_table`, `target_id`, `payload: { reason }`).
- **Action de modération** : soft delete uniquement (`is_active = false`), jamais `DELETE` physique. Tracée dans `audit_log` (`event_type: 'post_moderated'` / `'comment_moderated'`, `actor_phone`, `payload: { action, reason, author_phone }`).
- **Panneau de modération** : `public/admin/dashboard.html` et `public/admin/content.html` (point d'entrée réel de `content_admin`).

---

## 7. CONTROLLERS — LOGIQUE MÉTIER

### 7.1 `src/controllers/feed.controller.js`

```javascript
const { pool } = require('../config/db');
const cloudinary = require('../services/cloudinary.service');
const feedService = require('../services/feed.service');
const notifService = require('../services/notifications.service');

// GET /api/feed
// Feed : posts des follows + clubs rejoints + posts système
exports.getFeed = async (req, res) => {
  const phone = req.user.phone;
  const { page = 1, limit = 20, city } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.author_phone,
        p.content,
        p.photo_url,
        p.type,
        p.city,
        p.metadata,
        p.created_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(DISTINCT pl.phone) AS likes_count,
        COUNT(DISTINCT pc.id)   AS comments_count,
        BOOL_OR(pl.phone = $1)  AS liked_by_me
      FROM posts p
      JOIN users u ON u.phone = p.author_phone
      LEFT JOIN post_likes    pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id AND pc.is_active = TRUE
      WHERE p.is_active = TRUE
        AND p.type IN ('manual', 'system')
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (
          p.author_phone = $1
          OR p.author_phone IN (
            SELECT following_phone FROM follows WHERE follower_phone = $1
          )
          OR p.type = 'system'
        )
        AND ($3::text IS NULL OR p.city = $3)
      GROUP BY p.id, u.name, u.avatar_url
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $4
    `, [phone, limit, city || null, offset]);

    return res.json({ success: true, data: result.rows, page: +page });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FEED_ERROR', message: err.message }
    });
  }
};

// POST /api/feed
exports.createPost = async (req, res) => {
  const phone = req.user.phone;
  const { content, city } = req.body;
  let photo_url = null;
  let photo_public_id = null;

  if (!content && !req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'EMPTY_POST', message: 'Contenu ou photo requis' }
    });
  }

  try {
    if (req.file) {
      const uploaded = await cloudinary.uploadBuffer(req.file.buffer, {
        folder: 'bolamu/posts',
        resource_type: 'image'
      });
      photo_url = uploaded.secure_url;
      photo_public_id = uploaded.public_id;
    }

    const result = await pool.query(`
      INSERT INTO posts (author_phone, content, photo_url, photo_public_id, type, city)
      VALUES ($1, $2, $3, $4, 'manual', $5)
      RETURNING *
    `, [phone, content || null, photo_url, photo_public_id, city || null]);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'POST_CREATE_ERROR', message: err.message }
    });
  }
};

// POST /api/feed/:postId/like
exports.toggleLike = async (req, res) => {
  const phone = req.user.phone;
  const { postId } = req.params;

  try {
    // Vérifier si déjà liké
    const existing = await pool.query(
      'SELECT 1 FROM post_likes WHERE post_id = $1 AND phone = $2',
      [postId, phone]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM post_likes WHERE post_id = $1 AND phone = $2',
        [postId, phone]
      );
      return res.json({ success: true, liked: false });
    } else {
      await pool.query(
        'INSERT INTO post_likes (post_id, phone) VALUES ($1, $2)',
        [postId, phone]
      );

      // Notifier l'auteur du post
      const post = await pool.query(
        'SELECT author_phone FROM posts WHERE id = $1',
        [postId]
      );
      if (post.rows[0] && post.rows[0].author_phone !== phone) {
        await notifService.create({
          phone: post.rows[0].author_phone,
          type: 'new_like',
          title: 'Nouveau like',
          body: 'Quelqu\'un a aimé votre post',
          link: `/feed?post=${postId}`
        });
      }

      return res.json({ success: true, liked: true });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LIKE_ERROR', message: err.message }
    });
  }
};

// GET /api/feed/:postId/comments
exports.getComments = async (req, res) => {
  const { postId } = req.params;
  try {
    const result = await pool.query(`
      SELECT pc.*, u.name AS author_name, u.avatar_url AS author_avatar
      FROM post_comments pc
      JOIN users u ON u.phone = pc.phone
      WHERE pc.post_id = $1 AND pc.is_active = TRUE
      ORDER BY pc.created_at ASC
    `, [postId]);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'COMMENTS_ERROR', message: err.message }
    });
  }
};

// POST /api/feed/:postId/comments
exports.addComment = async (req, res) => {
  const phone = req.user.phone;
  const { postId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'EMPTY_COMMENT', message: 'Commentaire vide' }
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO post_comments (post_id, phone, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [postId, phone, content.trim()]);

    // Notifier l'auteur
    const post = await pool.query(
      'SELECT author_phone FROM posts WHERE id = $1', [postId]
    );
    if (post.rows[0] && post.rows[0].author_phone !== phone) {
      await notifService.create({
        phone: post.rows[0].author_phone,
        type: 'new_comment',
        title: 'Nouveau commentaire',
        body: content.trim().substring(0, 80),
        link: `/feed?post=${postId}`
      });
    }

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'COMMENT_CREATE_ERROR', message: err.message }
    });
  }
};

// DELETE /api/feed/:postId
exports.deletePost = async (req, res) => {
  const phone = req.user.phone;
  const { postId } = req.params;
  try {
    await pool.query(
      'UPDATE posts SET is_active = FALSE WHERE id = $1 AND author_phone = $2',
      [postId, phone]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: err.message }
    });
  }
};

// DELETE /api/feed/:postId/comments/:id
exports.deleteComment = async (req, res) => {
  const phone = req.user.phone;
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE post_comments SET is_active = FALSE WHERE id = $1 AND phone = $2',
      [id, phone]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_COMMENT_ERROR', message: err.message }
    });
  }
};

// GET /api/feed/profile/:phone
exports.getProfile = async (req, res) => {
  const { phone } = req.params;
  const me = req.user.phone;
  try {
    const user = await pool.query(`
      SELECT phone, name, bio, avatar_url, city, looking_for,
        (SELECT COUNT(*) FROM follows WHERE follower_phone = u.phone)  AS following_count,
        (SELECT COUNT(*) FROM follows WHERE following_phone = u.phone) AS followers_count,
        (SELECT COUNT(*) FROM posts WHERE author_phone = u.phone AND is_active = TRUE AND type = 'manual') AS posts_count
      FROM users u WHERE phone = $1
    `, [phone]);

    const isFollowing = await pool.query(
      'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
      [me, phone]
    );

    const posts = await pool.query(`
      SELECT p.*, COUNT(pl.phone) AS likes_count
      FROM posts p
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      WHERE p.author_phone = $1 AND p.is_active = TRUE AND p.type = 'manual'
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 12
    `, [phone]);

    return res.json({
      success: true,
      data: {
        ...user.rows[0],
        is_following: isFollowing.rows.length > 0,
        posts: posts.rows
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'PROFILE_ERROR', message: err.message }
    });
  }
};

// GET /api/feed/suggestions
exports.getSuggestions = async (req, res) => {
  const phone = req.user.phone;
  try {
    const result = await pool.query(`
      SELECT u.phone, u.name, u.avatar_url, u.city, u.bio,
        (SELECT COUNT(*) FROM follows WHERE following_phone = u.phone) AS followers_count
      FROM users u
      WHERE u.phone <> $1
        AND u.is_active = TRUE
        AND u.phone NOT IN (
          SELECT following_phone FROM follows WHERE follower_phone = $1
        )
      ORDER BY followers_count DESC, RANDOM()
      LIMIT 8
    `, [phone]);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SUGGESTIONS_ERROR', message: err.message }
    });
  }
};
```

---

### 7.2 `src/controllers/stories.controller.js`

```javascript
const { pool } = require('../config/db');
const cloudinary = require('../services/cloudinary.service');

// GET /api/stories
// Stories actives des personnes suivies (non expirées, non vues en premier)
exports.getActiveStories = async (req, res) => {
  const phone = req.user.phone;
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.author_phone,
        p.photo_url,
        p.content,
        p.created_at,
        p.expires_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(sv.phone) AS views_count,
        BOOL_OR(sv.phone = $1) AS viewed_by_me
      FROM posts p
      JOIN users u ON u.phone = p.author_phone
      LEFT JOIN story_views sv ON sv.story_id = p.id
      WHERE p.type = 'story'
        AND p.is_active = TRUE
        AND p.expires_at > NOW()
        AND (
          p.author_phone = $1
          OR p.author_phone IN (
            SELECT following_phone FROM follows WHERE follower_phone = $1
          )
        )
      GROUP BY p.id, u.name, u.avatar_url
      ORDER BY viewed_by_me ASC, p.created_at DESC
    `, [phone]);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'STORIES_ERROR', message: err.message }
    });
  }
};

// POST /api/stories
exports.createStory = async (req, res) => {
  const phone = req.user.phone;
  const { content, city } = req.body;
  const STORY_TTL_HOURS = 24;

  if (!req.file && !content) {
    return res.status(400).json({
      success: false,
      error: { code: 'EMPTY_STORY', message: 'Media ou texte requis' }
    });
  }

  try {
    let photo_url = null;
    let photo_public_id = null;

    if (req.file) {
      const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      const uploaded = await cloudinary.uploadBuffer(req.file.buffer, {
        folder: 'bolamu/stories',
        resource_type: resourceType,
        transformation: resourceType === 'video'
          ? [{ duration: '60' }]  // max 60 secondes
          : []
      });
      photo_url = uploaded.secure_url;
      photo_public_id = uploaded.public_id;
    }

    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);

    const result = await pool.query(`
      INSERT INTO posts
        (author_phone, content, photo_url, photo_public_id, type, city, expires_at)
      VALUES ($1, $2, $3, $4, 'story', $5, $6)
      RETURNING *
    `, [phone, content || null, photo_url, photo_public_id, city || null, expiresAt]);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'STORY_CREATE_ERROR', message: err.message }
    });
  }
};

// POST /api/stories/:storyId/view
exports.markViewed = async (req, res) => {
  const phone = req.user.phone;
  const { storyId } = req.params;
  try {
    await pool.query(`
      INSERT INTO story_views (story_id, phone)
      VALUES ($1, $2)
      ON CONFLICT (story_id, phone) DO NOTHING
    `, [storyId, phone]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'VIEW_ERROR', message: err.message }
    });
  }
};

// GET /api/stories/:storyId/viewers
exports.getViewers = async (req, res) => {
  const phone = req.user.phone;
  const { storyId } = req.params;
  try {
    // Vérifier que c'est bien sa story
    const ownership = await pool.query(
      'SELECT 1 FROM posts WHERE id = $1 AND author_phone = $2',
      [storyId, phone]
    );
    if (!ownership.rows.length) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Accès refusé' }
      });
    }

    const result = await pool.query(`
      SELECT sv.viewed_at, u.name, u.avatar_url, u.phone
      FROM story_views sv
      JOIN users u ON u.phone = sv.phone
      WHERE sv.story_id = $1
      ORDER BY sv.viewed_at DESC
    `, [storyId]);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'VIEWERS_ERROR', message: err.message }
    });
  }
};

// DELETE /api/stories/:storyId
exports.deleteStory = async (req, res) => {
  const phone = req.user.phone;
  const { storyId } = req.params;
  try {
    await pool.query(
      'UPDATE posts SET is_active = FALSE WHERE id = $1 AND author_phone = $2 AND type = $3',
      [storyId, phone, 'story']
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_STORY_ERROR', message: err.message }
    });
  }
};
```

---

### 7.3 `src/controllers/follows.controller.js`

```javascript
const { pool } = require('../config/db');
const notifService = require('../services/notifications.service');

exports.follow = async (req, res) => {
  const follower = req.user.phone;
  const { phone: following } = req.params;

  if (follower === following) {
    return res.status(400).json({
      success: false,
      error: { code: 'SELF_FOLLOW', message: 'Impossible de se suivre soi-même' }
    });
  }

  try {
    await pool.query(
      'INSERT INTO follows (follower_phone, following_phone) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [follower, following]
    );

    await notifService.create({
      phone: following,
      type: 'new_follower',
      title: 'Nouvel abonné',
      body: 'Quelqu\'un vous suit maintenant',
      link: `/feed/profile/${follower}`
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FOLLOW_ERROR', message: err.message }
    });
  }
};

exports.unfollow = async (req, res) => {
  const follower = req.user.phone;
  const { phone: following } = req.params;
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_phone = $1 AND following_phone = $2',
      [follower, following]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'UNFOLLOW_ERROR', message: err.message }
    });
  }
};

exports.getFollowing = async (req, res) => {
  const phone = req.user.phone;
  try {
    const result = await pool.query(`
      SELECT u.phone, u.name, u.avatar_url, u.city, f.created_at
      FROM follows f
      JOIN users u ON u.phone = f.following_phone
      WHERE f.follower_phone = $1
      ORDER BY f.created_at DESC
    `, [phone]);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FOLLOWING_ERROR', message: err.message }
    });
  }
};

exports.getFollowers = async (req, res) => {
  const phone = req.user.phone;
  try {
    const result = await pool.query(`
      SELECT u.phone, u.name, u.avatar_url, u.city, f.created_at
      FROM follows f
      JOIN users u ON u.phone = f.follower_phone
      WHERE f.following_phone = $1
      ORDER BY f.created_at DESC
    `, [phone]);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FOLLOWERS_ERROR', message: err.message }
    });
  }
};

exports.getStatus = async (req, res) => {
  const me = req.user.phone;
  const { phone } = req.params;
  try {
    const iFollow = await pool.query(
      'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
      [me, phone]
    );
    const followsMe = await pool.query(
      'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
      [phone, me]
    );
    return res.json({
      success: true,
      data: {
        i_follow: iFollow.rows.length > 0,
        follows_me: followsMe.rows.length > 0
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'STATUS_ERROR', message: err.message }
    });
  }
};
```

---

### 7.4 `src/services/notifications.service.js`

```javascript
// Service centralisé pour créer des notifs in-app
// Socket.io pousse en temps réel si l'utilisateur est connecté

const { pool } = require('../config/db');

exports.create = async ({ phone, type, title, body, link, metadata = {} }) => {
  try {
    const result = await pool.query(`
      INSERT INTO notifications_inapp (phone, type, title, body, link, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [phone, type, title, body || null, link || null, JSON.stringify(metadata)]);

    // Push Socket.io si disponible (io doit être accessible globalement)
    if (global.io) {
      global.io.to(`user:${phone}`).emit('notification', result.rows[0]);
    }

    return result.rows[0];
  } catch (err) {
    console.error('[notifications.service] Erreur création notif:', err.message);
    return null;
  }
};
```

---

### 7.5 `src/services/feed.service.js` — Posts système automatiques

```javascript
// Ce service est appelé par les controllers existants
// pour créer automatiquement des posts système dans le feed

const { pool } = require('../config/db');

/**
 * Appelé par zora.controller.js après earn réussi
 * Ajouter : await feedService.postZoraEarned(phone, amount, category);
 */
exports.postZoraEarned = async (phone, amount, category) => {
  try {
    const user = await pool.query('SELECT city FROM users WHERE phone = $1', [phone]);
    await pool.query(`
      INSERT INTO posts (author_phone, content, type, city, metadata)
      VALUES ($1, $2, 'system', $3, $4)
    `, [
      phone,
      `vient de gagner ${amount} Zora Points`,
      user.rows[0]?.city || null,
      JSON.stringify({ zora_amount: amount, category })
    ]);
  } catch (err) {
    console.error('[feed.service] postZoraEarned:', err.message);
  }
};

/**
 * Appelé par clubs.controller.js après join réussi
 * Ajouter : await feedService.postClubJoined(phone, clubName);
 */
exports.postClubJoined = async (phone, clubName) => {
  try {
    const user = await pool.query('SELECT city FROM users WHERE phone = $1', [phone]);
    await pool.query(`
      INSERT INTO posts (author_phone, content, type, city, metadata)
      VALUES ($1, $2, 'system', $3, $4)
    `, [
      phone,
      `vient de rejoindre le club ${clubName}`,
      user.rows[0]?.city || null,
      JSON.stringify({ club_name: clubName })
    ]);
  } catch (err) {
    console.error('[feed.service] postClubJoined:', err.message);
  }
};

/**
 * Appelé par elonga.controller.js après checkin événement
 * Ajouter : await feedService.postEventCheckin(phone, eventName);
 */
exports.postEventCheckin = async (phone, eventName) => {
  try {
    const user = await pool.query('SELECT city FROM users WHERE phone = $1', [phone]);
    await pool.query(`
      INSERT INTO posts (author_phone, content, type, city, metadata)
      VALUES ($1, $2, 'system', $3, $4)
    `, [
      phone,
      `a participé à l'événement ${eventName}`,
      user.rows[0]?.city || null,
      JSON.stringify({ event_name: eventName })
    ]);
  } catch (err) {
    console.error('[feed.service] postEventCheckin:', err.message);
  }
};
```

---

## 8. SOCKET.IO — NOTIFICATIONS TEMPS RÉEL

### 8.1 Configuration dans `app.js` ou `server.js`

```javascript
const { Server } = require('socket.io');

// Après création du serveur HTTP
const io = new Server(server, {
  cors: {
    origin: ['https://bolamu.co', 'https://www.bolamu.co'],
    methods: ['GET', 'POST']
  }
});

// Rendre io accessible globalement pour notifications.service.js
global.io = io;

io.on('connection', (socket) => {
  // Rejoindre une room personnelle via le token JWT
  socket.on('authenticate', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.join(`user:${decoded.phone}`);
      socket.emit('authenticated', { status: 'ok' });
    } catch (err) {
      socket.emit('auth_error', { message: 'Token invalide' });
    }
  });

  socket.on('disconnect', () => {
    // Nettoyage automatique des rooms
  });
});
```

---

## 9. CLOUDINARY — CONFIGURATION UPLOAD

### 9.1 `src/middleware/upload.middleware.js`

```javascript
// Vérifier si multer est déjà installé : npm list multer
// Sinon : npm install multer

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. JPEG, PNG, WebP, MP4 uniquement.'), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024  // 50 MB max (vidéos stories)
  }
});
```

### 9.2 Méthode à ajouter dans `src/services/cloudinary.service.js`

```javascript
// Ajouter cette méthode si uploadBuffer n'existe pas encore

const cloudinary = require('cloudinary').v2;

exports.uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }).end(buffer);
  });
};
```

---

## 10. CRON — NETTOYAGE STORIES EXPIRÉES

### 10.1 `src/cron/stories-cleanup.js`

```javascript
// Ajouter dans le cron existant ou créer un nouveau job
// Fréquence recommandée : toutes les heures

const { pool } = require('../config/db');

exports.cleanExpiredStories = async () => {
  try {
    const result = await pool.query(`
      UPDATE posts
      SET is_active = FALSE
      WHERE type = 'story'
        AND expires_at < NOW()
        AND is_active = TRUE
      RETURNING id
    `);
    if (result.rows.length > 0) {
      console.log(`[stories-cleanup] ${result.rows.length} stories expirées désactivées`);
    }
  } catch (err) {
    console.error('[stories-cleanup] Erreur:', err.message);
  }
};
```

---

## 11. FRONTEND — ONGLET FEED DANS `dashboard.html`

### 11.1 Section HTML à ajouter

```html
<!-- ===== SECTION FEED ===== -->
<section id="sec-feed" class="tab-section" style="display:none">

  <!-- Stories bar -->
  <div class="stories-bar">
    <div class="story-add-btn" onclick="openCreateStory()">
      <div class="story-avatar story-avatar--add">
        <span class="material-symbols-outlined">add_circle</span>
      </div>
      <span class="story-label">Ma story</span>
    </div>
    <div id="stories-list" class="stories-list">
      <!-- Injecté par JS -->
    </div>
  </div>

  <!-- Feed layout -->
  <div class="feed-layout">

    <!-- Colonne principale -->
    <div class="feed-main">

      <!-- Créer un post -->
      <div class="post-composer card">
        <div class="composer-row">
          <div class="composer-avatar" id="composer-avatar"></div>
          <button class="composer-trigger" onclick="openCreatePost()">
            Partager quelque chose...
          </button>
        </div>
        <div class="composer-actions">
          <button class="composer-action-btn" onclick="openCreatePost('photo')">
            <span class="material-symbols-outlined">photo_camera</span>
            Photo
          </button>
          <button class="composer-action-btn" onclick="openCreateStory()">
            <span class="material-symbols-outlined">add_circle</span>
            Story
          </button>
        </div>
      </div>

      <!-- Filtre ville -->
      <div class="feed-filters">
        <button class="filter-chip active" data-city="">Tout</button>
        <button class="filter-chip" data-city="Brazzaville">Brazzaville</button>
        <button class="filter-chip" data-city="Pointe-Noire">Pointe-Noire</button>
        <button class="filter-chip" data-city="Dolisie">Dolisie</button>
      </div>

      <!-- Posts -->
      <div id="feed-posts-list">
        <div class="feed-loading">
          <span class="material-symbols-outlined rotating">autorenew</span>
        </div>
      </div>

      <button id="feed-load-more" class="btn-secondary" onclick="loadMorePosts()" style="display:none">
        Voir plus
      </button>
    </div>

    <!-- Sidebar desktop -->
    <aside class="feed-sidebar">
      <div class="card sidebar-suggestions">
        <h3 class="sidebar-title">Membres suggérés</h3>
        <div id="suggestions-list">
          <!-- Injecté par JS -->
        </div>
      </div>
    </aside>

  </div>

  <!-- Modal créer post -->
  <div id="modal-create-post" class="modal-overlay" style="display:none">
    <div class="modal-panel">
      <div class="modal-header">
        <h2>Nouveau post</h2>
        <button class="modal-close" onclick="closeModal('modal-create-post')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <textarea id="post-content" placeholder="Quoi de neuf ?" rows="4"></textarea>
        <div id="post-photo-preview" style="display:none">
          <img id="post-photo-img" src="" alt="Aperçu">
          <button onclick="removePostPhoto()">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
        <div class="modal-actions-row">
          <label class="btn-icon" for="post-photo-input">
            <span class="material-symbols-outlined">photo_camera</span>
          </label>
          <input type="file" id="post-photo-input" accept="image/*" style="display:none" onchange="previewPostPhoto(this)">
          <select id="post-city">
            <option value="">Ville (optionnel)</option>
            <option value="Brazzaville">Brazzaville</option>
            <option value="Pointe-Noire">Pointe-Noire</option>
            <option value="Dolisie">Dolisie</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="submitPost()">Publier</button>
      </div>
    </div>
  </div>

  <!-- Modal créer story -->
  <div id="modal-create-story" class="modal-overlay" style="display:none">
    <div class="modal-panel modal-panel--story">
      <div class="modal-header">
        <h2>Nouvelle story</h2>
        <button class="modal-close" onclick="closeModal('modal-create-story')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <label class="story-upload-zone" for="story-media-input">
          <span class="material-symbols-outlined">add_photo_alternate</span>
          <span>Photo ou vidéo (max 60s)</span>
          <input type="file" id="story-media-input" accept="image/*,video/mp4" style="display:none" onchange="previewStoryMedia(this)">
        </label>
        <div id="story-preview" style="display:none"></div>
        <textarea id="story-text" placeholder="Texte (optionnel)" rows="2"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="submitStory()">
          Publier (24h)
        </button>
      </div>
    </div>
  </div>

  <!-- Visionneuse story plein écran -->
  <div id="story-viewer" class="story-viewer-overlay" style="display:none">
    <div class="story-progress-bar">
      <div id="story-progress" class="story-progress-fill"></div>
    </div>
    <button class="story-close" onclick="closeStoryViewer()">
      <span class="material-symbols-outlined">close</span>
    </button>
    <div class="story-author-info">
      <div id="sv-avatar" class="story-avatar"></div>
      <span id="sv-name"></span>
      <span id="sv-time" class="story-time"></span>
    </div>
    <div id="sv-media" class="story-media-container"></div>
    <button class="story-nav story-nav--prev" onclick="prevStory()">
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    <button class="story-nav story-nav--next" onclick="nextStory()">
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
  </div>

</section>
```

---

### 11.2 CSS à ajouter dans `dashboard.html` (section `<style>`)

```css
/* ===== FEED ===== */
.feed-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.5rem;
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

@media (max-width: 768px) {
  .feed-layout { grid-template-columns: 1fr; }
  .feed-sidebar { display: none; }
}

/* Stories bar */
.stories-bar {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 1rem;
  scrollbar-width: none;
  background: var(--surface, #FAF8FF);
  border-bottom: 1px solid rgba(10,36,99,0.08);
}

.stories-list {
  display: flex;
  gap: 1rem;
}

.story-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  flex-shrink: 0;
}

.story-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--brand-navy);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2.5px solid var(--brand-turquoise, #00C9A7);
  overflow: hidden;
}

.story-avatar--add {
  border-color: var(--brand-navy);
  background: rgba(10,36,99,0.06);
  color: var(--brand-navy);
}

.story-avatar--unseen { border-color: var(--brand-turquoise, #00C9A7); }
.story-avatar--seen   { border-color: rgba(10,36,99,0.2); }

.story-label {
  font-size: 0.7rem;
  color: var(--brand-navy);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* Post composer */
.post-composer {
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.composer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--brand-navy);
  flex-shrink: 0;
}

.composer-trigger {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 1.5px solid rgba(10,36,99,0.15);
  border-radius: 2rem;
  background: rgba(10,36,99,0.03);
  color: rgba(10,36,99,0.45);
  cursor: pointer;
  text-align: left;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.composer-trigger:hover { border-color: var(--brand-turquoise, #00C9A7); }

.composer-actions {
  display: flex;
  gap: 0.5rem;
}

.composer-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid rgba(10,36,99,0.12);
  border-radius: 2rem;
  background: transparent;
  color: var(--brand-navy);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s;
}

.composer-action-btn:hover { background: rgba(10,36,99,0.05); }
.composer-action-btn .material-symbols-outlined { font-size: 1.1rem; }

/* Feed filters */
.feed-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 0.375rem 1rem;
  border-radius: 2rem;
  border: 1.5px solid rgba(10,36,99,0.15);
  background: transparent;
  color: var(--brand-navy);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active,
.filter-chip:hover {
  background: var(--brand-navy);
  color: white;
  border-color: var(--brand-navy);
}

/* Post card */
.post-card {
  background: white;
  border-radius: 1.25rem;
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 12px rgba(10,36,99,0.06);
}

.post-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.post-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--brand-navy);
  flex-shrink: 0;
  overflow: hidden;
}

.post-author-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--brand-navy);
}

.post-time {
  font-size: 0.75rem;
  color: rgba(10,36,99,0.45);
}

.post-type-badge {
  margin-left: auto;
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  background: rgba(0,201,167,0.12);
  color: var(--brand-turquoise, #00C9A7);
  font-weight: 600;
}

.post-content {
  font-size: 0.9rem;
  color: var(--brand-navy);
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.post-photo {
  width: 100%;
  border-radius: 0.875rem;
  margin-bottom: 0.75rem;
  object-fit: cover;
  max-height: 400px;
}

.post-actions {
  display: flex;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(10,36,99,0.06);
}

.post-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: rgba(10,36,99,0.55);
  font-size: 0.85rem;
  cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.post-action-btn:hover { background: rgba(10,36,99,0.05); color: var(--brand-navy); }
.post-action-btn.liked  { color: #E03A3A; }
.post-action-btn .material-symbols-outlined { font-size: 1.15rem; }

/* Sidebar suggestions */
.sidebar-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--brand-navy);
  margin-bottom: 0.875rem;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.875rem;
}

.suggestion-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--brand-navy);
  flex-shrink: 0;
}

.suggestion-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--brand-navy);
}

.suggestion-city {
  font-size: 0.75rem;
  color: rgba(10,36,99,0.45);
}

.btn-follow {
  margin-left: auto;
  padding: 0.3rem 0.875rem;
  border: 1.5px solid var(--brand-navy);
  border-radius: 2rem;
  background: transparent;
  color: var(--brand-navy);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-follow:hover,
.btn-follow.following {
  background: var(--brand-navy);
  color: white;
}

/* Story viewer plein écran */
.story-viewer-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.story-progress-bar {
  position: absolute;
  top: 0.75rem;
  left: 1rem;
  right: 1rem;
  height: 3px;
  background: rgba(255,255,255,0.3);
  border-radius: 2px;
}

.story-progress-fill {
  height: 100%;
  background: white;
  border-radius: 2px;
  transition: width 0.1s linear;
  width: 0%;
}

.story-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  z-index: 2;
}

.story-author-info {
  position: absolute;
  top: 1.5rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  z-index: 2;
}

.story-media-container {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.story-media-container img,
.story-media-container video {
  width: 100%;
  border-radius: 0.5rem;
  object-fit: contain;
}

.story-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.15);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.story-nav--prev { left: 1rem; }
.story-nav--next { right: 1rem; }

/* Cloche notifications header */
.notif-bell-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--brand-navy);
  display: flex;
  align-items: center;
}

.notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  background: var(--brand-orange, #FF6B35);
  color: white;
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 320px;
  background: white;
  border-radius: 1.25rem;
  box-shadow: 0 8px 32px rgba(10,36,99,0.15);
  z-index: 1000;
  overflow: hidden;
}

.notif-item {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(10,36,99,0.05);
  cursor: pointer;
  transition: background 0.15s;
}

.notif-item:hover { background: rgba(10,36,99,0.03); }
.notif-item.unread { background: rgba(0,201,167,0.06); }

.notif-item-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--brand-navy);
  margin-bottom: 0.2rem;
}

.notif-item-body {
  font-size: 0.78rem;
  color: rgba(10,36,99,0.6);
}

/* Loading spinner */
.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.feed-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: rgba(10,36,99,0.35);
}
```

---

### 11.3 JavaScript à ajouter dans `dashboard.html`

```javascript
// ===== FEED — Variables d'état =====
let feedPage = 1;
let feedCity = '';
let feedLoading = false;
let currentStories = [];
let currentStoryIndex = 0;
let storyTimer = null;
const STORY_DURATION = 5000; // 5 secondes par story

// ===== INITIALISATION =====
function initFeed() {
  loadFeed(true);
  loadStories();
  loadSuggestions();
  loadUnreadCount();
  initSocket();

  // Filtres ville
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      feedCity = btn.dataset.city;
      loadFeed(true);
    });
  });
}

// ===== FEED =====
async function loadFeed(reset = false) {
  if (feedLoading) return;
  feedLoading = true;

  if (reset) {
    feedPage = 1;
    document.getElementById('feed-posts-list').innerHTML =
      '<div class="feed-loading"><span class="material-symbols-outlined rotating">autorenew</span></div>';
  }

  try {
    const params = new URLSearchParams({ page: feedPage, limit: 10 });
    if (feedCity) params.append('city', feedCity);

    const res = await fetch(`/api/feed?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();

    if (reset) document.getElementById('feed-posts-list').innerHTML = '';

    if (data.data.length === 0 && reset) {
      document.getElementById('feed-posts-list').innerHTML =
        '<p style="text-align:center;color:rgba(10,36,99,0.4);padding:2rem">Aucun post pour l\'instant. Suivez des membres !</p>';
    } else {
      data.data.forEach(post => renderPost(post));
      document.getElementById('feed-load-more').style.display =
        data.data.length === 10 ? 'block' : 'none';
      feedPage++;
    }
  } catch (err) {
    console.error('[feed] loadFeed:', err);
  } finally {
    feedLoading = false;
  }
}

function loadMorePosts() { loadFeed(false); }

function renderPost(post) {
  const container = document.getElementById('feed-posts-list');
  const isSystem = post.type === 'system';
  const timeAgo = formatTimeAgo(post.created_at);

  const div = document.createElement('div');
  div.className = 'post-card';
  div.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">
        ${post.author_avatar
          ? `<img src="${post.author_avatar}" alt="" style="width:100%;height:100%;object-fit:cover">`
          : `<span class="material-symbols-outlined" style="color:white;font-size:1.2rem">person</span>`}
      </div>
      <div>
        <div class="post-author-name">${escapeHtml(post.author_name)}</div>
        <div class="post-time">${timeAgo}${post.city ? ' · ' + escapeHtml(post.city) : ''}</div>
      </div>
      ${isSystem ? '<span class="post-type-badge">Activité</span>' : ''}
    </div>
    ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
    ${post.photo_url ? `<img class="post-photo" src="${post.photo_url}" alt="Photo du post" loading="lazy">` : ''}
    <div class="post-actions">
      <button class="post-action-btn ${post.liked_by_me ? 'liked' : ''}"
        onclick="toggleLike('${post.id}', this)">
        <span class="material-symbols-outlined">${post.liked_by_me ? 'favorite' : 'favorite_border'}</span>
        ${post.likes_count || 0}
      </button>
      <button class="post-action-btn" onclick="openComments('${post.id}')">
        <span class="material-symbols-outlined">chat_bubble_outline</span>
        ${post.comments_count || 0}
      </button>
    </div>
  `;
  container.appendChild(div);
}

// ===== LIKE =====
async function toggleLike(postId, btn) {
  try {
    const res = await fetch(`/api/feed/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    const icon = btn.querySelector('.material-symbols-outlined');
    const countText = btn.childNodes[btn.childNodes.length - 1];
    const currentCount = parseInt(countText.textContent.trim()) || 0;

    if (data.liked) {
      btn.classList.add('liked');
      icon.textContent = 'favorite';
      countText.textContent = ' ' + (currentCount + 1);
    } else {
      btn.classList.remove('liked');
      icon.textContent = 'favorite_border';
      countText.textContent = ' ' + Math.max(0, currentCount - 1);
    }
  } catch (err) {
    console.error('[feed] toggleLike:', err);
  }
}

// ===== CRÉER POST =====
function openCreatePost(mode = 'text') {
  document.getElementById('modal-create-post').style.display = 'flex';
  if (mode === 'photo') document.getElementById('post-photo-input').click();
}

function previewPostPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('post-photo-img').src = e.target.result;
    document.getElementById('post-photo-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removePostPhoto() {
  document.getElementById('post-photo-input').value = '';
  document.getElementById('post-photo-preview').style.display = 'none';
}

async function submitPost() {
  const content = document.getElementById('post-content').value.trim();
  const photoInput = document.getElementById('post-photo-input');
  const city = document.getElementById('post-city').value;

  if (!content && !photoInput.files[0]) {
    alert('Ajoutez un texte ou une photo');
    return;
  }

  const formData = new FormData();
  if (content) formData.append('content', content);
  if (city) formData.append('city', city);
  if (photoInput.files[0]) formData.append('photo', photoInput.files[0]);

  try {
    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-create-post');
      document.getElementById('post-content').value = '';
      removePostPhoto();
      loadFeed(true);
    }
  } catch (err) {
    console.error('[feed] submitPost:', err);
  }
}

// ===== STORIES =====
async function loadStories() {
  try {
    const res = await fetch('/api/stories', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    currentStories = data.data || [];
    renderStoriesBar(currentStories);
  } catch (err) {
    console.error('[stories] loadStories:', err);
  }
}

function renderStoriesBar(stories) {
  const list = document.getElementById('stories-list');
  list.innerHTML = '';
  stories.forEach((story, i) => {
    const div = document.createElement('div');
    div.className = 'story-item';
    div.onclick = () => openStoryViewer(i);
    const seenClass = story.viewed_by_me ? 'story-avatar--seen' : 'story-avatar--unseen';
    div.innerHTML = `
      <div class="story-avatar ${seenClass}">
        ${story.author_avatar
          ? `<img src="${story.author_avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : `<span class="material-symbols-outlined" style="color:white">person</span>`}
      </div>
      <span class="story-label">${escapeHtml(story.author_name?.split(' ')[0] || '')}</span>
    `;
    list.appendChild(div);
  });
}

function openStoryViewer(index) {
  currentStoryIndex = index;
  document.getElementById('story-viewer').style.display = 'flex';
  showStory(currentStoryIndex);
}

function showStory(index) {
  if (index < 0 || index >= currentStories.length) {
    closeStoryViewer();
    return;
  }
  const story = currentStories[index];
  document.getElementById('sv-name').textContent = story.author_name;
  document.getElementById('sv-time').textContent = formatTimeAgo(story.created_at);

  const mediaContainer = document.getElementById('sv-media');
  mediaContainer.innerHTML = '';

  if (story.photo_url) {
    const isVideo = story.photo_url.includes('/video/');
    if (isVideo) {
      const video = document.createElement('video');
      video.src = story.photo_url;
      video.autoplay = true;
      video.muted = false;
      video.style.width = '100%';
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = story.photo_url;
      img.alt = '';
      mediaContainer.appendChild(img);
    }
  }

  // Marquer comme vue
  fetch(`/api/stories/${story.id}/view`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` }
  }).catch(() => {});

  // Progress bar
  document.getElementById('story-progress').style.width = '0%';
  if (storyTimer) clearInterval(storyTimer);
  let elapsed = 0;
  storyTimer = setInterval(() => {
    elapsed += 100;
    const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
    document.getElementById('story-progress').style.width = pct + '%';
    if (elapsed >= STORY_DURATION) {
      clearInterval(storyTimer);
      nextStory();
    }
  }, 100);
}

function nextStory() {
  if (currentStoryIndex < currentStories.length - 1) {
    currentStoryIndex++;
    showStory(currentStoryIndex);
  } else {
    closeStoryViewer();
  }
}

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    showStory(currentStoryIndex);
  }
}

function closeStoryViewer() {
  if (storyTimer) clearInterval(storyTimer);
  document.getElementById('story-viewer').style.display = 'none';
}

// ===== CRÉER STORY =====
function openCreateStory() {
  document.getElementById('modal-create-story').style.display = 'flex';
}

function previewStoryMedia(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('story-preview');
  preview.innerHTML = '';
  preview.style.display = 'block';

  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.style.maxWidth = '100%';
    video.style.borderRadius = '0.875rem';
    preview.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '100%';
    img.style.borderRadius = '0.875rem';
    preview.appendChild(img);
  }
}

async function submitStory() {
  const mediaInput = document.getElementById('story-media-input');
  const text = document.getElementById('story-text').value.trim();

  if (!mediaInput.files[0] && !text) {
    alert('Ajoutez un média ou un texte');
    return;
  }

  const formData = new FormData();
  if (text) formData.append('content', text);
  if (mediaInput.files[0]) formData.append('media', mediaInput.files[0]);

  try {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-create-story');
      loadStories();
    }
  } catch (err) {
    console.error('[stories] submitStory:', err);
  }
}

// ===== SUGGESTIONS =====
async function loadSuggestions() {
  try {
    const res = await fetch('/api/feed/suggestions', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    const list = document.getElementById('suggestions-list');
    list.innerHTML = '';
    data.data.forEach(u => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <div class="suggestion-avatar">
          ${u.avatar_url
            ? `<img src="${u.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span class="material-symbols-outlined" style="color:white;font-size:1.1rem">person</span>`}
        </div>
        <div>
          <div class="suggestion-name">${escapeHtml(u.name)}</div>
          ${u.city ? `<div class="suggestion-city">${escapeHtml(u.city)}</div>` : ''}
        </div>
        <button class="btn-follow" onclick="followUser('${u.phone}', this)">Suivre</button>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('[feed] loadSuggestions:', err);
  }
}

async function followUser(phone, btn) {
  try {
    const res = await fetch(`/api/follows/${phone}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = 'Suivi';
      btn.classList.add('following');
      btn.disabled = true;
    }
  } catch (err) {
    console.error('[follows] followUser:', err);
  }
}

// ===== NOTIFICATIONS =====
async function loadUnreadCount() {
  try {
    const res = await fetch('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = data.count || 0;
      badge.style.display = data.count > 0 ? 'flex' : 'none';
    }
  } catch (err) {
    console.error('[notif] loadUnreadCount:', err);
  }
}

// ===== SOCKET.IO =====
function initSocket() {
  // Vérifier si socket.io est chargé
  if (typeof io === 'undefined') return;

  const socket = io('https://api.bolamu.co');
  socket.emit('authenticate', getToken());

  socket.on('notification', (notif) => {
    loadUnreadCount();
    showToastNotif(notif);
  });
}

function showToastNotif(notif) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem;
    background:white; border-radius:1rem;
    padding:0.875rem 1.25rem;
    box-shadow: 0 8px 24px rgba(10,36,99,0.15);
    z-index:9999; max-width:300px;
    border-left:3px solid var(--brand-turquoise,#00C9A7);
    animation: slideIn 0.3s ease;
  `;
  toast.innerHTML = `
    <div style="font-weight:600;font-size:0.85rem;color:var(--brand-navy)">${escapeHtml(notif.title)}</div>
    ${notif.body ? `<div style="font-size:0.78rem;color:rgba(10,36,99,0.6);margin-top:0.2rem">${escapeHtml(notif.body)}</div>` : ''}
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== UTILITAIRES =====
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function getToken() {
  return localStorage.getItem('bolamu_token') || sessionStorage.getItem('bolamu_token') || '';
}

// Ajouter dans le switch des onglets existant
// case 'feed': initFeed(); break;
```

---

## 12. INTÉGRATION DANS LE SWITCH D'ONGLETS EXISTANT

Trouver dans `dashboard.html` la fonction de changement d'onglet (probablement `switchTab()` ou `showSection()`).

Ajouter le cas Feed :

```javascript
// Dans la fonction switchTab / showSection existante :
case 'feed':
  initFeed();
  break;
```

Ajouter la cloche dans le header HTML existant (après le logo ou avant le menu utilisateur) :

```html
<button class="notif-bell-btn" onclick="toggleNotifDropdown()">
  <span class="material-symbols-outlined">notifications</span>
  <span id="notif-badge" class="notif-badge" style="display:none">0</span>
</button>
<div id="notif-dropdown" class="notif-dropdown" style="display:none">
  <div id="notif-list" style="max-height:400px;overflow-y:auto">
    <!-- Injecté par JS -->
  </div>
</div>
```

Ajouter dans le JS :

```javascript
function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  const isOpen = dropdown.style.display !== 'none';
  dropdown.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadNotifications();
}

async function loadNotifications() {
  try {
    const res = await fetch('/api/notifications?limit=15', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    const list = document.getElementById('notif-list');
    list.innerHTML = '';
    data.data.forEach(n => {
      const div = document.createElement('div');
      div.className = `notif-item ${n.is_read ? '' : 'unread'}`;
      div.innerHTML = `
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        ${n.body ? `<div class="notif-item-body">${escapeHtml(n.body)}</div>` : ''}
      `;
      div.onclick = () => {
        fetch(`/api/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        div.classList.remove('unread');
        if (n.link) window.location = n.link;
      };
      list.appendChild(div);
    });
    // Marquer tout comme lu
    fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    document.getElementById('notif-badge').style.display = 'none';
  } catch (err) {
    console.error('[notif] loadNotifications:', err);
  }
}
```

---

## 13. DÉPENDANCES À INSTALLER

```bash
# Si pas encore installés
npm install multer socket.io

# Vérifier socket.io-client côté frontend
# Ajouter dans le <head> de dashboard.html si absent :
# <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

---

## 14. POINTS D'INTÉGRATION DANS LE CODE EXISTANT

| Fichier existant | Action |
|---|---|
| `src/controllers/zora.controller.js` | Après earn réussi : `await feedService.postZoraEarned(phone, amount, category)` |
| `src/controllers/clubs.controller.js` | Après join réussi : `await feedService.postClubJoined(phone, clubName)` |
| `src/controllers/elonga.controller.js` | Après checkin : `await feedService.postEventCheckin(phone, eventName)` |
| `app.js` / `server.js` | Ajouter Socket.io + routes feed/stories/follows/notifications |
| `public/patient/dashboard.html` | Ajouter section Feed, nav item, CSS, JS |

---

## 15. ROADMAP LIVES (PHASE 2)

> Non implémenté en Phase 1. Architecture documentée pour référence.

### Option recommandée : MediaMTX (open source, self-hosted)

**Pourquoi MediaMTX et pas WebRTC pur**
- WebRTC peer-to-peer est limité à ~5-10 spectateurs simultanés sans serveur TURN
- MediaMTX reçoit un flux RTMP du broadcaster et le redistribue en HLS
- HLS = compatible avec tous les navigateurs, fonctionne même sur connexion dégradée (Brazzaville)
- Latence : 3-5 secondes (acceptable pour un live santé/fitness)

**Architecture Phase 2**

```
Broadcaster (mobile) → RTMP → MediaMTX (VPS séparé)
                                    ↓
                               HLS stream
                                    ↓
              Spectateurs → dashboard.html → lecteur HLS (hls.js)
```

**Tables supplémentaires Phase 2**

```sql
CREATE TABLE lives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_phone    VARCHAR(20) NOT NULL REFERENCES users(phone),
  title         VARCHAR(200),
  stream_key    VARCHAR(100) UNIQUE NOT NULL,
  hls_url       VARCHAR(500),
  status        VARCHAR(20) DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'live', 'ended')),
  viewers_peak  INT DEFAULT 0,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE live_viewers (
  live_id     UUID REFERENCES lives(id) ON DELETE CASCADE,
  phone       VARCHAR(20) REFERENCES users(phone),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  PRIMARY KEY (live_id, phone)
);
```

**Alternative SaaS si VPS contraignant** : Agora.io (SDK africain-friendly, pay-per-minute, plan gratuit 10 000 min/mois).

---

## 16. CHECKLIST D'EXÉCUTION POUR CLAUDE CODE

```
[x] 1. Exécuter les migrations SQL (script Node.js temporaire → supprimer après)
[x] 2. Créer src/services/notifications.service.js
[x] 3. Créer src/services/feed.service.js
[x] 4. Créer src/controllers/feed.controller.js
[x] 5. Créer src/controllers/stories.controller.js
[x] 6. Créer src/controllers/follows.controller.js
[x] 7. Créer src/controllers/notifications.controller.js
[x] 8. Créer src/routes/feed.routes.js
[x] 9. Créer src/routes/stories.routes.js
[x] 10. Créer src/routes/follows.routes.js
[x] 11. Créer src/routes/notifications.routes.js
[x] 12. Ajouter les 4 routes dans app.js
[x] 13. Ajouter uploadBuffer dans cloudinary.service.js
[x] 14. Créer/vérifier upload.middleware.js (multer)
[x] 15. Configurer Socket.io dans server.js
[x] 16. Modifier dashboard.html : nav + section Feed + CSS + JS
[x] 17. Ajouter appels feedService dans zora/clubs/elonga controllers
[x] 18. npm install multer socket.io (si absents)
[x] 19. Ajouter socket.io CDN dans dashboard.html
[x] 20. Créer cron stories-cleanup.js
[x] 21. node --check sur tous les nouveaux fichiers JS
[x] 22. git add [fichiers nommés] — PAS de git add -A
[x] 23. git commit -m "feat: réseau social feed + stories + follows + notifications in-app"
[ ] 24. Attendre validation King avant git push
```

Chantier feed FIX 1 à 9 terminé et pushé.

### Dette technique connue

- Signalements ignorés (`report_dismissed`) réapparaissent au rechargement — le filtre `GET /admin/feed/reports` ne croise pas encore l'historique des dismiss dans `audit_log`.
- Dashboard partenaire non testé en conditions réelles (pas d'identifiants de test disponibles au moment du déploiement).

---

## 17. VARIABLES D'ENVIRONNEMENT REQUISES

Toutes déjà présentes dans `.env` — aucune nouvelle variable requise.

```
DATABASE_URL       ← Neon PostgreSQL (déjà configuré)
CLOUDINARY_URL     ← Cloudinary (déjà configuré)
JWT_SECRET         ← Auth (déjà configuré)
WAHA_URL           ← WhatsApp (déjà configuré)
```

---

*Fin du document — ARCHITECTURE_RESEAU_SOCIAL_BOLAMU.md v1.1*
