// ============================================================
// BOLAMU — Middleware Request Logger (Sprint 5)
// ============================================================
const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Exclure /metrics et /api/v1/test des logs (trop verbeux)
  if (req.path === '/metrics' || req.path === '/api/v1/test') {
    return next();
  }

  // Logger chaque requête
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip || req.connection.remoteAddress
    };

    // Ajouter user_phone si authentifié
    if (req.user && req.user.phone) {
      logData.user_phone = req.user.phone;
    }

    logger.http(logData);
  });

  next();
}

module.exports = requestLogger;
