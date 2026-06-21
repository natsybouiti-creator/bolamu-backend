const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false }
});

let _poolLogged = false;
pool.on('connect', () => {
  if (_poolLogged) return;
  _poolLogged = true;
  const logger = require('./logger');
  logger.info('[DB] Connecté à PostgreSQL Neon');
});

module.exports = pool;
