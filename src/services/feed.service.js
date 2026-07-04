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

module.exports = { postZoraEarned, postClubJoined, postEventCheckin };
