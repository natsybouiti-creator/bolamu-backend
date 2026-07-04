// ============================================================
// BOLAMU — Cron nettoyage stories expirées (réseau social)
// Fréquence : toutes les heures
// ============================================================
const cron = require('node-cron');
const pool = require('../config/db');

const jobStoriesCleanup = cron.schedule('0 * * * *', async () => {
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
});

module.exports = { jobStoriesCleanup };
