// ============================================================
// BOLAMU — Follows controller (réseau social, abonnements)
// ============================================================
const pool = require('../config/db');
const notifService = require('../services/notification.service');

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

        await notifService.notifyLite({
            user_phone: following,
            type: 'new_follower',
            titre: 'Nouvel abonné',
            message: 'Quelqu\'un vous suit maintenant',
            link: `/patient/dashboard.html?panel=feed&profile=${follower}`
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
            SELECT u.phone, u.full_name, u.avatar_url, u.city, f.created_at
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
            SELECT u.phone, u.full_name, u.avatar_url, u.city, f.created_at
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
