const { Pool } = require('pg');
require('dotenv').config();

// On utilise DATABASE_URL pour Neon, sinon on reste en local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Indispensable pour la sécurité de Neon
  }
});

// Petit test de connexion pour confirmer le succès
pool.on('connect', () => {
  console.log("📡 Connecté à la base de données CLOUD (Neon) !");
});

module.exports = pool;
