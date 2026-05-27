// ============================================================
// BOLAMU — Configuration Logger Winston (Sprint 5)
// ============================================================
const winston = require('winston');

// Définir les niveaux de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Définir les couleurs pour les logs
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Format du log
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Transports
const transports = [
  // Console (développement uniquement)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple()
    ),
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  }),

  // Fichier logs/error.log (erreurs uniquement)
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: format
  })
];

// BetterStack transport (si BETTERSTACK_SOURCE_TOKEN présent)
if (process.env.BETTERSTACK_SOURCE_TOKEN) {
  const { Logtail } = require('@logtail/node');
  const logtail = new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN);
  transports.push(logtail);
}

// Créer le logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Ne jamais logger : passwords, tokens JWT, numéros de carte
  exitOnError: false
});

module.exports = logger;
