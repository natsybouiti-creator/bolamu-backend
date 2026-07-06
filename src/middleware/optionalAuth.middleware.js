const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    req.user = null;
    return next();
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(parts[1], JWT_SECRET);
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = optionalAuth;
