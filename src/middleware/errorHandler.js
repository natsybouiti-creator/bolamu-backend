// ============================================================
// BOLAMU — Middleware Error Handler Global (Sprint 5)
// ============================================================
const logger = require('../config/logger');

// Codes d'erreur standardisés
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR'
};

function errorHandler(err, req, res, next) {
  // Logger l'erreur complète (stack trace)
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    user_phone: req.user?.phone
  });

  // Déterminer le code d'erreur
  let errorCode = ERROR_CODES.SERVER_ERROR;
  let statusCode = 500;

  if (err.name === 'ValidationError') {
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError') {
    errorCode = ERROR_CODES.AUTH_ERROR;
    statusCode = 401;
  } else if (err.name === 'NotFoundError') {
    errorCode = ERROR_CODES.NOT_FOUND;
    statusCode = 404;
  } else if (err.name === 'PaymentError') {
    errorCode = ERROR_CODES.PAYMENT_ERROR;
    statusCode = 402;
  } else if (err.name === 'ConflictError') {
    errorCode = ERROR_CODES.CONFLICT_ERROR;
    statusCode = 409;
  }

  // Retourner au client : { error: "message", code: "ERROR_CODE" }
  // JAMAIS la stack trace en production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: err.message || 'Erreur interne serveur',
    code: errorCode,
    ...(isDevelopment && { stack: err.stack })
  });
}

module.exports = errorHandler;
