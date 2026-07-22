// ============================================================
// BOLAMU — Follows controller (réseau social, abonnements)
// ============================================================
const pool = require('../config/db');
const notifService = require('../services/notification.service');
const { getRoleLabel } = require('../utils/roleLabels');

function withRoleLabel(row) {
    row.author_role_label = getRoleLabel(row.role, row.specialty) || 'Utilisateur';
    delete row.role;
    delete row.specialty;
    return row;
}

exports.follow = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const follower = req.user.phone;
        const { phone: following } = req.params;

        if (follower === following) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'SELF_FOLLOW', message: 'Impossible de se suivre soi-même' }
            });
        }

        // Vérifier si le compte cible est privé
        const targetResult = await client.query(
            'SELECT is_private FROM users WHERE phone = $1',
            [following]
        );

        if (targetResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' }
            });
        }

        const isPrivate = targetResult.rows[0].is_private;

        if (isPrivate) {
            // Compte privé : créer une demande de suivi
            // Vérifier si une demande existe déjà
            const existingRequest = await client.query(
                'SELECT id, status FROM follow_requests WHERE requester_phone = $1 AND target_phone = $2',
                [follower, following]
            );

            if (existingRequest.rows.length > 0) {
                const existing = existingRequest.rows[0];
                if (existing.status === 'pending') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        error: { code: 'REQUEST_ALREADY_PENDING', message: 'Demande de suivi déjà en attente' }
                    });
                }
                if (existing.status === 'accepted') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        error: { code: 'ALREADY_FOLLOWING', message: 'Vous suivez déjà cet utilisateur' }
                    });
                }
                // Si rejected, on peut recréer une demande
            }

            // Insérer la demande
            const requestResult = await client.query(
                `INSERT INTO follow_requests (requester_phone, target_phone, status)
                 VALUES ($1, $2, 'pending')
                 ON CONFLICT (requester_phone, target_phone) 
                 DO UPDATE SET status = 'pending', created_at = NOW(), responded_at = NULL
                 RETURNING id`,
                [follower, following]
            );

            await client.query('COMMIT');

            // Notifier le propriétaire (hors transaction pour éviter les blocs)
            await notifService.notifyLite({
                user_phone: following,
                type: 'follow_request',
                titre: 'Demande de suivi',
                message: 'Quelqu\'un souhaite vous suivre',
                link: `/patient/dashboard.html?panel=follow-requests`
            });

            return res.status(201).json({
                success: true,
                status: 'pending_request',
                request_id: requestResult.rows[0].id
            });
        } else {
            // Compte public : suivi direct (comportement existant)
            await client.query(
                'INSERT INTO follows (follower_phone, following_phone) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [follower, following]
            );

            await client.query('COMMIT');

            // Notifier le propriétaire (hors transaction)
            await notifService.notifyLite({
                user_phone: following,
                type: 'new_follower',
                titre: 'Nouvel abonné',
                message: 'Quelqu\'un vous suit maintenant',
                link: `/patient/dashboard.html?panel=feed&profile=${follower}`
            });

            return res.status(201).json({ success: true });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({
            success: false,
            error: { code: 'FOLLOW_ERROR', message: err.message }
        });
    } finally {
        client.release();
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
            SELECT u.phone, u.full_name, u.avatar_url, u.city, u.role, d.specialty, f.created_at
            FROM follows f
            JOIN users u ON u.phone = f.following_phone
            LEFT JOIN doctors d ON d.phone = u.phone
            WHERE f.follower_phone = $1
            ORDER BY f.created_at DESC
        `, [phone]);
        return res.json({ success: true, data: result.rows.map(withRoleLabel) });
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
            SELECT u.phone, u.full_name, u.avatar_url, u.city, u.role, d.specialty, f.created_at
            FROM follows f
            JOIN users u ON u.phone = f.follower_phone
            LEFT JOIN doctors d ON d.phone = u.phone
            WHERE f.following_phone = $1
            ORDER BY f.created_at DESC
        `, [phone]);
        return res.json({ success: true, data: result.rows.map(withRoleLabel) });
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

exports.getFollowRequests = async (req, res) => {
    const phone = req.user.phone;
    try {
        const result = await pool.query(`
            SELECT fr.id, fr.requester_phone, fr.created_at,
                   u.full_name, u.avatar_url, u.role, d.specialty
            FROM follow_requests fr
            JOIN users u ON u.phone = fr.requester_phone
            LEFT JOIN doctors d ON d.phone = u.phone
            WHERE fr.target_phone = $1 AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        `, [phone]);
        return res.json({
            success: true,
            data: result.rows.map(row => withRoleLabel({
                id: row.id,
                requester_phone: row.requester_phone,
                full_name: row.full_name,
                avatar_url: row.avatar_url,
                created_at: row.created_at,
                role: row.role,
                specialty: row.specialty
            }))
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: 'FOLLOW_REQUESTS_ERROR', message: err.message }
        });
    }
};

exports.respondFollowRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const phone = req.user.phone;
        const { id } = req.params;
        const { action } = req.body;

        if (action !== 'accept' && action !== 'reject') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_ACTION', message: 'Action doit être "accept" ou "reject"' }
            });
        }

        // Vérifier que la demande appartient à l'utilisateur
        const requestResult = await client.query(
            'SELECT requester_phone, target_phone, status FROM follow_requests WHERE id = $1',
            [id]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: { code: 'REQUEST_NOT_FOUND', message: 'Demande introuvable' }
            });
        }

        const request = requestResult.rows[0];

        if (request.target_phone !== phone) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Cette demande ne vous appartient pas' }
            });
        }

        if (request.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'REQUEST_ALREADY_PROCESSED', message: 'Cette demande a déjà été traitée' }
            });
        }

        if (action === 'accept') {
            // Créer le follow réel
            await client.query(
                'INSERT INTO follows (follower_phone, following_phone) VALUES ($1, $2)',
                [request.requester_phone, request.target_phone]
            );
        }

        // Mettre à jour la demande
        await client.query(
            'UPDATE follow_requests SET status = $1, responded_at = NOW() WHERE id = $2',
            [action === 'accept' ? 'accepted' : 'rejected', id]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [action === 'accept' ? 'follow_request_accepted' : 'follow_request_rejected', phone, 'follow_requests', id, JSON.stringify({ requester_phone: request.requester_phone })]
        );

        await client.query('COMMIT');

        // Notifier le demandeur (hors transaction)
        if (action === 'accept') {
            await notifService.notifyLite({
                user_phone: request.requester_phone,
                type: 'follow_request_accepted',
                titre: 'Demande acceptée',
                message: 'Votre demande de suivi a été acceptée',
                link: `/patient/dashboard.html?panel=feed&profile=${request.target_phone}`
            });
        }

        return res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({
            success: false,
            error: { code: 'RESPOND_REQUEST_ERROR', message: err.message }
        });
    } finally {
        client.release();
    }
};
