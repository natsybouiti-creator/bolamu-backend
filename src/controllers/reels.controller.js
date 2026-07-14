// ============================================================
// BOLAMU — Reels controller (réseau social, vidéo courte permanente)
// Réutilise la table posts (type='reel') et l'upload Cloudinary des stories,
// mais sans expires_at : un reel ne disparaît jamais après 24h.
// ============================================================
const pool = require('../config/db');
const cloudinaryService = require('../services/cloudinary.service');

// GET /api/v1/reels
// Reels des follows + les siens, plus récents d'abord. Même logique de
// confidentialité que le feed principal (follow requis, y compris pour un
// compte public) — pas de découverte de reels d'inconnus dans cette V1.
exports.getReels = async (req, res) => {
    const phone = req.user ? req.user.phone : null;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.author_phone,
                p.content,
                p.photo_url,
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
                AND p.type = 'reel'
                AND (
                    p.author_phone = $1
                    OR p.author_phone IN (
                        SELECT following_phone FROM follows WHERE follower_phone = $1
                    )
                )
            GROUP BY p.id, u.full_name, u.photo_url
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `, [phone, limit, offset]);

        return res.json({ success: true, data: result.rows, page: +page });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: 'REELS_ERROR', message: err.message }
        });
    }
};

// POST /api/v1/reels
exports.createReel = async (req, res) => {
    const phone = req.user.phone;
    const { content } = req.body;

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: { code: 'MEDIA_REQUIRED', message: 'Vidéo requise' }
        });
    }

    try {
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        const uploaded = await cloudinaryService.uploadBuffer(req.file.buffer, {
            folder: 'bolamu/reels',
            resource_type: resourceType,
            transformation: resourceType === 'video'
                ? [{ duration: '60' }]
                : []
        });

        const result = await pool.query(`
            INSERT INTO posts (author_phone, content, photo_url, photo_public_id, type)
            VALUES ($1, $2, $3, $4, 'reel')
            RETURNING *
        `, [phone, content || null, uploaded.secure_url, uploaded.public_id]);

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: 'REEL_CREATE_ERROR', message: err.message }
        });
    }
};

// DELETE /api/v1/reels/:reelId
exports.deleteReel = async (req, res) => {
    const phone = req.user.phone;
    const { reelId } = req.params;
    try {
        await pool.query(
            "UPDATE posts SET is_active = FALSE WHERE id = $1 AND author_phone = $2 AND type = 'reel'",
            [reelId, phone]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: 'DELETE_REEL_ERROR', message: err.message }
        });
    }
};
