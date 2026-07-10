// ============================================================
// BOLAMU — Stories controller (réseau social, contenu éphémère 24h)
// ============================================================
const pool = require('../config/db');
const cloudinaryService = require('../services/cloudinary.service');

// GET /api/v1/stories
// Stories actives des personnes suivies (non expirées)
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
                u.full_name AS author_name,
                u.photo_url AS author_avatar,
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
            GROUP BY p.id, u.full_name, u.photo_url
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

// POST /api/v1/stories
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
            const uploaded = await cloudinaryService.uploadBuffer(req.file.buffer, {
                folder: 'bolamu/stories',
                resource_type: resourceType,
                transformation: resourceType === 'video'
                    ? [{ duration: '60' }]
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

// POST /api/v1/stories/:storyId/view
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

// GET /api/v1/stories/:storyId/viewers
exports.getViewers = async (req, res) => {
    const phone = req.user.phone;
    const { storyId } = req.params;
    try {
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
            SELECT sv.viewed_at, u.full_name, u.photo_url, u.phone
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

// DELETE /api/v1/stories/:storyId
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
