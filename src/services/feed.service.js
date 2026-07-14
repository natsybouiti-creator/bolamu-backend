// ============================================================
// BOLAMU — Feed service : posts système automatiques
// Appelé par des controllers/services existants pour publier
// automatiquement un post dans le feed social (réseau social)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * Appelé par zora.service.js (awardZora) après earn réussi
 */
async function postZoraEarned(phone, amount, category) {
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
        logger.error('[feed.service] postZoraEarned:', err.message);
    }
}

/**
 * Appelé par clubs.controller.js (joinClub) après join réussi
 */
async function postClubJoined(phone, clubName) {
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
        logger.error('[feed.service] postClubJoined:', err.message);
    }
}

/**
 * Appelé par elonga-events.service.js (processCheckin) après checkin
 */
async function postEventCheckin(phone, eventName) {
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
        logger.error('[feed.service] postEventCheckin:', err.message);
    }
}

/**
 * isPostVisibleTo(postId, viewerPhone)
 * Reproduit la règle de confidentialité déjà appliquée dans feed.controller.js
 * (getFeed ?author=, getProfile) : un post est visible si —
 *   - il est actif et non expiré (stories)
 *   - ET c'est un post système (visible de tous, comme dans le feed)
 *   - OU c'est l'auteur lui-même
 *   - OU le compte auteur est public
 *   - OU le compte auteur est privé mais le viewer le suit
 * viewerPhone peut être null (visiteur non authentifié) : seuls les posts
 * système ou d'un compte public restent alors visibles.
 */
async function isPostVisibleTo(postId, viewerPhone) {
    const result = await pool.query(`
        SELECT p.is_active, p.expires_at, p.type, p.author_phone, u.is_private
        FROM posts p
        JOIN users u ON u.phone = p.author_phone
        WHERE p.id = $1
    `, [postId]);

    if (result.rows.length === 0) return false;
    const post = result.rows[0];

    if (!post.is_active) return false;
    if (post.expires_at && new Date(post.expires_at) <= new Date()) return false;
    if (post.type === 'system') return true;
    if (viewerPhone && post.author_phone === viewerPhone) return true;
    if (!post.is_private) return true;
    if (!viewerPhone) return false;

    const follow = await pool.query(
        'SELECT 1 FROM follows WHERE follower_phone = $1 AND following_phone = $2',
        [viewerPhone, post.author_phone]
    );
    return follow.rows.length > 0;
}

module.exports = { postZoraEarned, postClubJoined, postEventCheckin, isPostVisibleTo };
