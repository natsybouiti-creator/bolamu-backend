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
            // Réclamation atomique de la clé : la contrainte UNIQUE(idempotency_key) garantit
            // qu'un seul appelant concurrent peut réussir cet INSERT. Avant, un SELECT (0 ligne)
            // suivi d'un INSERT séparé laissait une fenêtre où deux requêtes parallèles passaient
            // toutes les deux le SELECT avant qu'aucune n'ait inséré -> double paiement possible.
            const insertResult = await pool.query(
                `INSERT INTO idempotency_keys (idempotency_key, endpoint, user_phone, request_hash)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (idempotency_key) DO NOTHING
                 RETURNING id`,
                [idempotencyKey, endpoint, userPhone, requestHash]
            );

            if (insertResult.rows.length === 0) {
                // Clé déjà réclamée (par cette requête ou une requête concurrente qui a gagné
                // la course) : consulter son état pour rejouer la réponse ou signaler "en cours".
                const existingResult = await pool.query(
                    `SELECT * FROM idempotency_keys WHERE idempotency_key = $1`,
                    [idempotencyKey]
                );

                const existing = existingResult.rows[0];

                if (existing && existing.response_status !== null) {
                    console.log(`[Idempotence] Replay détecté pour clé ${idempotencyKey}`);
                    return res
                        .status(existing.response_status)
                        .set('X-Idempotent-Replayed', 'true')
                        .json(existing.response_body);
                }

                console.log(`[Idempotence] Requête en cours pour clé ${idempotencyKey}`);
                return res.status(409).json({
                    success: false,
                    message: 'Requête en cours de traitement'
                });
            }

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
