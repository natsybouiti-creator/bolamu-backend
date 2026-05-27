// ============================================================
// BOLAMU — Configuration Metrics Prometheus (Sprint 5)
// ============================================================
const client = require('prom-client');

// Initialiser le registre par défaut
const register = new client.Registry();

// Métriques par défaut
client.collectDefaultMetrics({ register });

// Compteur HTTP requests par route/méthode/status
const httpRequestsTotal = new client.Counter({
  name: 'bolamu_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Histogram latence P95/P99 par route
const httpRequestDuration = new client.Histogram({
  name: 'bolamu_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Gauge connexions base de données actives
const dbConnectionsActive = new client.Gauge({
  name: 'bolamu_db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

// Fonction pour enregistrer une requête HTTP
function recordHttpRequest(method, route, statusCode, duration) {
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route }, duration / 1000);
}

// Fonction pour mettre à jour les connexions DB
function updateDbConnections(count) {
  dbConnectionsActive.set(count);
}

// Exposer les métriques (accès restreint IP interne uniquement)
function getMetrics() {
  return register.metrics();
}

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  dbConnectionsActive,
  recordHttpRequest,
  updateDbConnections,
  getMetrics
};
