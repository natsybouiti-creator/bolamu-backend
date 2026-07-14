// ============================================================
// BOLAMU — Feed controller (réseau social)
// ============================================================
const pool = require('../config/db');
const cloudinaryService = require('../services/cloudinary.service');
const notifService = require('../services/notification.service');
const { isPostVisibleTo } = require('../services/feed.service');
const { normalizePhone } = require('../utils/phone');

// GET /api/v1/feed
// Feed : posts des follows + posts système
// Supporte ?author=:phone pour filtrer par auteur (avec verrouillage si compte privé)
exports.getFeed = async (req, res) => {
    const phone = req.user ? req.user.phone : null;
    const { page = 1, limit = 20, city, author } = req.query;
    const offset = (page - 1) * limit;

    try {
        // Si paramètre author présent, filtrer par cet auteur avec verrouillage
        if (author) {
            const targetPhone = normalizePhone(author);
            const visitorPhone = phone ? normalizePhone(phone) : null;
            const isSelf = visitorPhone === targetPhone;

            // Vérifier si le compte cible est privé
            const userResult = await pool.query(
                'SELECT is_private FROM users WHERE phone = $1',
                [targetPhone]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' }
                });
            }

            const isPrivate = userResult.rows[0].is_private;

            // Vérifier si le visiteur suit déjà ce compte
            let isFollowing = false;
            if (visitorPhone && !isSelf) {
                const followResult = await pool.query(
                    'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
                    [visitorPhone, targetPhone]
                );
                isFollowing = followResult.rows.length > 0;
            }

            const isLocked = isPrivate && !isSelf && !isFollowing;

            if (isLocked) {
                return res.json({
                    success: true,
                    data: [],
                    locked: true,
                    page: +page
                });
            }

            // Compte public ou déjà suivi : retourner les posts
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
                    u.full_name AS author_name,
                    u.photo_url AS author_avatar,
                    COUNT(DISTINCT pl.phone) AS likes_count,
                    COUNT(DISTINCT pc.id)   AS comments_count,
                    BOOL_OR(pl.phone = $1)  AS liked_by_me
                FROM posts p
                JOIN users u ON u.phone = p.author_phone
                LEFT JOIN post_likes    pl ON pl.post_id = p.id
                LEFT JOIN post_comments pc ON pc.post_id = p.id AND pc.is_active = TRUE
                WHERE p.is_active = TRUE
                    AND p.type IN ('manual', 'system')
                    AND p.author_phone = $2
                    AND (p.expires_at IS NULL OR p.expires_at > NOW())
                    AND ($3::text IS NULL OR p.city = $3)
                GROUP BY p.id, u.full_name, u.photo_url
                ORDER BY p.created_at DESC
                LIMIT $4 OFFSET $5
            `, [visitorPhone || null, targetPhone, city || null, limit, offset]);

            return res.json({ success: true, data: result.rows, page: +page });
        }

        // Feed normal (sans paramètre author)
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
                u.full_name AS author_name,
                u.photo_url AS author_avatar,
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
            GROUP BY p.id, u.full_name, u.photo_url
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

// POST /api/v1/feed
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
            const uploaded = await cloudinaryService.uploadBuffer(req.file.buffer, {
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

// POST /api/v1/feed/:postId/like
exports.toggleLike = async (req, res) => {
    const phone = req.user.phone;
    const { postId } = req.params;

    try {
        if (!(await isPostVisibleTo(postId, phone))) {
            return res.status(404).json({
                success: false,
                error: { code: 'POST_NOT_FOUND', message: 'Post introuvable' }
            });
        }

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

            const post = await pool.query(
                'SELECT author_phone FROM posts WHERE id = $1',
                [postId]
            );
            if (post.rows[0] && post.rows[0].author_phone !== phone) {
                await notifService.notifyLite({
                    user_phone: post.rows[0].author_phone,
                    type: 'new_like',
                    titre: 'Nouveau like',
                    message: 'Quelqu\'un a aimé votre post',
                    link: `/patient/dashboard.html?panel=feed&post=${postId}`
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

// GET /api/v1/feed/:postId/comments
exports.getComments = async (req, res) => {
    const phone = req.user.phone;
    const { postId } = req.params;
    try {
        if (!(await isPostVisibleTo(postId, phone))) {
            return res.status(404).json({
                success: false,
                error: { code: 'POST_NOT_FOUND', message: 'Post introuvable' }
            });
        }

        const result = await pool.query(`
            SELECT pc.*, u.full_name AS author_name, u.photo_url AS author_avatar
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

// POST /api/v1/feed/:postId/comments
exports.addComment = async (req, res) => {
    const phone = req.user.phone;
    const { postId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({
            success: false,
            error: { code: 'EMPTY_COMMENT', message: 'Commentaire vide' }
        });
    }

    try {
        if (!(await isPostVisibleTo(postId, phone))) {
            return res.status(404).json({
                success: false,
                error: { code: 'POST_NOT_FOUND', message: 'Post introuvable' }
            });
        }

        const result = await pool.query(`
            INSERT INTO post_comments (post_id, phone, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [postId, phone, content.trim()]);

        const post = await pool.query(
            'SELECT author_phone FROM posts WHERE id = $1', [postId]
        );
        if (post.rows[0] && post.rows[0].author_phone !== phone) {
            await notifService.notifyLite({
                user_phone: post.rows[0].author_phone,
                type: 'new_comment',
                titre: 'Nouveau commentaire',
                message: content.trim().substring(0, 80),
                link: `/patient/dashboard.html?panel=feed&post=${postId}`
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

// DELETE /api/v1/feed/:postId
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

// DELETE /api/v1/feed/:postId/comments/:id
exports.deleteComment = async (req, res) => {
    const phone = req.user.phone;
    const { postId, id } = req.params;
    try {
        if (!(await isPostVisibleTo(postId, phone))) {
            return res.status(404).json({
                success: false,
                error: { code: 'POST_NOT_FOUND', message: 'Post introuvable' }
            });
        }

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

// GET /api/v1/feed/profile/:phone
exports.getProfile = async (req, res) => {
    const { phone } = req.params;
    const me = req.user.phone;
    try {
        const user = await pool.query(`
            SELECT phone, full_name, bio, photo_url AS avatar_url, city, looking_for, is_private,
                (SELECT COUNT(*) FROM follows WHERE follower_phone = u.phone)  AS following_count,
                (SELECT COUNT(*) FROM follows WHERE following_phone = u.phone) AS followers_count,
                (SELECT COUNT(*) FROM posts WHERE author_phone = u.phone AND is_active = TRUE AND type = 'manual') AS posts_count
            FROM users u WHERE phone = $1
        `, [phone]);

        if (!user.rows.length) {
            return res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' }
            });
        }

        const userData = user.rows[0];
        const isSelf = me === phone;

        const isFollowing = await pool.query(
            'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
            [me, phone]
        );

        const isLocked = userData.is_private && !isSelf && isFollowing.rows.length === 0;

        let posts = [];
        if (!isLocked) {
            posts = await pool.query(`
                SELECT p.*, COUNT(pl.phone) AS likes_count
                FROM posts p
                LEFT JOIN post_likes pl ON pl.post_id = p.id
                WHERE p.author_phone = $1 AND p.is_active = TRUE AND p.type = 'manual'
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT 12
            `, [phone]);
        }

        const responseData = {
            ...userData,
            is_following: isFollowing.rows.length > 0,
            is_self: isSelf,
            posts: posts.rows
        };

        if (isLocked) {
            responseData.locked = true;
        }

        return res.json({
            success: true,
            data: responseData
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: 'PROFILE_ERROR', message: err.message }
        });
    }
};

// GET /api/v1/feed/suggestions
exports.getSuggestions = async (req, res) => {
    const phone = req.user.phone;
    try {
        const result = await pool.query(`
            SELECT u.phone, u.full_name, u.photo_url AS avatar_url, u.city, u.bio,
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
