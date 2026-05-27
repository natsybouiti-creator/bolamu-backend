// ============================================================
// BOLAMU — Middleware Idempotence (Sprint 4)
// ============================================================
const pool = require('../config/db');
const crypto = require('crypto');

function idempotencyMiddleware(endpoint) {
    return async (req, res, next) => {
        const idempotencyKey = req.headers['idempotency-key'];
        const userPhone = req.user?.phone;

        // Si pas de clé idempotence, continuer normalement
        if (!idempotencyKey) {
            return next();
        }

        // Générer le hash de la requête
        const requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(req.body) + req.url)
            .digest('hex');

        try {
            // Vérifier si la clé existe déjà
            const existingResult = await pool.query(
                `SELECT * FROM idempotency_keys 
                 WHERE idempotency_key = $1 AND endpoint = $2 AND user_phone = $3`,
                [idempotencyKey, endpoint, userPhone]
            );

            if (existingResult.rows.length > 0) {
                const existing = existingResult.rows[0];

                // Si la clé existe ET response_status IS NOT NULL : retourner la réponse cachée
                if (existing.response_status !== null) {
                    console.log(`[Idempotence] Replay détecté pour clé ${idempotencyKey}`);
                    return res
                        .status(existing.response_status)
                        .set('X-Idempotent-Replayed', 'true')
                        .json(existing.response_body);
                }

                // Si la clé existe SANS réponse (requête en cours) : HTTP 409
                console.log(`[Idempotence] Requête en cours pour clé ${idempotencyKey}`);
                return res.status(409).json({
                    success: false,
                    message: 'Requête en cours de traitement'
                });
            }

            // Si la clé n'existe pas : INSERT dans idempotency_keys (sans response encore)
            await pool.query(
                `INSERT INTO idempotency_keys (idempotency_key, endpoint, user_phone, request_hash)
                 VALUES ($1, $2, $3, $4)`,
                [idempotencyKey, endpoint, userPhone, requestHash]
            );

            // Intercepter la réponse pour la stocker
            const originalJson = res.json.bind(res);
            res.json = function (data) {
                // Stocker la réponse dans idempotency_keys
                pool.query(
                    `UPDATE idempotency_keys 
                     SET response_status = $1, response_body = $2 
                     WHERE idempotency_key = $3 AND endpoint = $4 AND user_phone = $5`,
                    [res.statusCode, JSON.stringify(data), idempotencyKey, endpoint, userPhone]
                ).catch((err) => {
                    console.error('[Idempotence] Erreur lors du stockage de la réponse:', err.message);
                });

                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('[Idempotence]', error.message);
            // En cas d'erreur, continuer normalement
            next();
        }
    };
}

module.exports = idempotencyMiddleware;
