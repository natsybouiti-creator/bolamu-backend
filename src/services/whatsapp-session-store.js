// ============================================================
// WhatsApp Session Store - RemoteAuth avec PostgreSQL
// ============================================================

const pool = require('../config/db');

class PostgresStore {
  constructor() {
    this.client = null;
  }

  async sessionExists(id) {
    try {
      const result = await pool.query(
        'SELECT 1 FROM whatsapp_sessions WHERE id = $1',
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('[PostgresStore] Erreur sessionExists:', error.message);
      return false;
    }
  }

  async save(id, session) {
    try {
      if (!session) {
        console.log(`[PostgresStore] Session ${id} vide ou null, skip save`);
        return;
      }
      const sessionString = JSON.stringify(session);
      const exists = await this.sessionExists(id);

      if (exists) {
        await pool.query(
          `UPDATE whatsapp_sessions 
           SET session = $1, updated_at = NOW() 
           WHERE id = $2`,
          [sessionString, id]
        );
      } else {
        await pool.query(
          `INSERT INTO whatsapp_sessions (id, session, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())`,
          [id, sessionString]
        );
      }
      console.log(`[PostgresStore] Session ${id} sauvegardée (${sessionString.length} caractères)`);
    } catch (error) {
      console.error('[PostgresStore] Erreur save:', error.message);
      throw error;
    }
  }

  async extract(id) {
    try {
      const result = await pool.query(
        'SELECT session FROM whatsapp_sessions WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        console.log(`[PostgresStore] Aucune session trouvée pour ${id}`);
        return undefined;
      }

      const sessionString = result.rows[0].session;
      const session = JSON.parse(sessionString);
      console.log(`[PostgresStore] Session ${id} extraite (${sessionString.length} caractères)`);
      return session;
    } catch (error) {
      console.error('[PostgresStore] Erreur extract:', error.message);
      return undefined;
    }
  }

  async delete(id) {
    try {
      await pool.query(
        'DELETE FROM whatsapp_sessions WHERE id = $1',
        [id]
      );
      console.log(`[PostgresStore] Session ${id} supprimée`);
    } catch (error) {
      console.error('[PostgresStore] Erreur delete:', error.message);
      throw error;
    }
  }
}

module.exports = PostgresStore;
