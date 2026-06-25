// ============================================================
// WhatsApp Session Store - RemoteAuth avec PostgreSQL
// ============================================================

const pool = require('../config/db');
const fs = require('fs');

class PostgresStore {
  constructor() {
    this.client = null;
  }

  async sessionExists({ session }) {
    try {
      const result = await pool.query(
        'SELECT 1 FROM whatsapp_sessions WHERE id = $1',
        [session]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('[PostgresStore] Erreur sessionExists:', error.message);
      return false;
    }
  }

  async save({ session }) {
    try {
      // RemoteAuth a déjà créé le zip : ${session}.zip dans le cwd
      const zipPath = `${session}.zip`;
      
      if (!fs.existsSync(zipPath)) {
        console.log(`[PostgresStore] Fichier zip non trouvé: ${zipPath}, skip save`);
        return;
      }
      
      const data = fs.readFileSync(zipPath); // buffer binaire
      const exists = await this.sessionExists({ session });
      
      if (exists) {
        await pool.query(
          'UPDATE whatsapp_sessions SET session = $1, updated_at = NOW() WHERE id = $2',
          [data, session]
        );
      } else {
        await pool.query(
          'INSERT INTO whatsapp_sessions (id, session, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
          [session, data]
        );
      }
      console.log(`[PostgresStore] Session ${session} sauvegardée (${data.length} octets)`);
    } catch (error) {
      console.error('[PostgresStore] Erreur save:', error.message);
      throw error;
    }
  }

  async extract({ session, path }) {
    try {
      const result = await pool.query(
        'SELECT session FROM whatsapp_sessions WHERE id = $1',
        [session]
      );

      if (result.rows.length === 0) {
        console.log(`[PostgresStore] Aucune session trouvée pour ${session}`);
        return;
      }

      const data = result.rows[0].session;
      fs.writeFileSync(path, data); // restaure le zip binaire
      console.log(`[PostgresStore] Session ${session} restaurée vers ${path}`);
    } catch (error) {
      console.error('[PostgresStore] Erreur extract:', error.message);
    }
  }

  async delete({ session }) {
    try {
      await pool.query(
        'DELETE FROM whatsapp_sessions WHERE id = $1',
        [session]
      );
      console.log(`[PostgresStore] Session ${session} supprimée`);
    } catch (error) {
      console.error('[PostgresStore] Erreur delete:', error.message);
      throw error;
    }
  }
}

module.exports = PostgresStore;
