// ============================================================
// Routes : Chat (conversation-based — ancien système canal retiré Phase 11/12)
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const chatService = require('../services/chat.service');

// ============================================================
// NOUVEAU SYSTÈME — conversations (Sprint 3)
// Polling toutes les 10s depuis le frontend (pas de WebSocket)
// ============================================================

/**
 * GET /api/v1/chat/unread
 * Badge header : nombre de messages non lus
 */
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const unread = await chatService.getUnreadCount(req.user.phone);
    res.json({ success: true, data: { unread } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/chat/communaute
 * Conversation communautaire globale unique
 */
router.get('/communaute', authMiddleware, async (req, res) => {
  try {
    const conv = await chatService.getCommunauteConversation(req.user.phone, req.user.role);
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/chat/conversations
 * Liste des conversations du patient connecté avec last_message et unread_count
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await chatService.getPatientConversations(req.user.phone);
    res.json({ success: true, data: conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/chat/conversations/:id/messages
 * Messages paginés (cursor-based)
 * ?limit=20&before_id=xxx
 */
router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, before_id } = req.query;
    const messages = await chatService.getConversationMessages(
      id,
      req.user.phone,
      Math.min(parseInt(limit) || 20, 100),
      before_id ? parseInt(before_id) : null
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    const status = err.message.includes('Accès non autorisé') ? 403 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/chat/conversations/:id/messages
 * Envoyer un message dans une conversation
 * body: { content, type }
 */
router.post('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu requis' });
    }

    const message = await chatService.sendConversationMessage(id, req.user.phone, content.trim());
    res.json({ success: true, data: message });
  } catch (err) {
    const status = err.message.includes('Accès non autorisé') ? 403 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/chat/conversations/:id/read
 * Marquer les messages d'une conversation comme lus
 */
router.post('/conversations/:id/read', authMiddleware, async (req, res) => {
  try {
    await chatService.markAsRead(req.params.id, req.user.phone);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/chat/conversations
 * Créer ou trouver une conversation entre deux utilisateurs
 * body: { participant_phone }
 */
router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { participant_phone } = req.body;
    if (!participant_phone) {
      return res.status(400).json({ error: 'participant_phone requis' });
    }
    const myPhone = req.user.phone;
    const pool = require('../config/db');

    // Déterminer le type réel selon les rôles des deux participants
    const otherUser = await pool.query('SELECT role FROM users WHERE phone = $1', [participant_phone]);
    const otherRole = otherUser.rows[0] ? otherUser.rows[0].role : null;
    const myRole = req.user.role;
    const type = (myRole === 'doctor' || otherRole === 'doctor') ? 'patient_medecin' : 'private';

    // Vérifier si conversation existe déjà entre ces deux phones (indépendant du type,
    // mais restreint aux deux types que cette route peut produire — évite de matcher
    // une conversation club/communaute à laquelle les deux appartiendraient par ailleurs)
    const existing = await pool.query(`
      SELECT c.id FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
      WHERE c.type IN ('private', 'patient_medecin')
        AND cp1.participant_phone = $1
        AND cp2.participant_phone = $2
      LIMIT 1
    `, [myPhone, participant_phone]);

    if (existing.rows.length) {
      return res.json({ success: true, conversation_id: existing.rows[0].id, created: false });
    }

    // Créer conversation + ajouter les 2 participants
    const conv = await pool.query(
      `INSERT INTO conversations (type) VALUES ($1) RETURNING id`,
      [type]
    );
    const convId = conv.rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_phone, role) VALUES ($1, $2, $3)`,
      [convId, myPhone, myRole]
    );
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_phone, role) VALUES ($1, $2, $3)`,
      [convId, participant_phone, otherRole]
    );

    return res.status(201).json({ success: true, conversation_id: convId, created: true });
  } catch (error) {
    console.error('[chat/conversations]', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/chat/users/search?q=...&role=...
 * Recherche d'utilisateurs pour démarrer une nouvelle conversation
 * (bouton "+ Nouvelle conversation", Phase 5/12). Ouvert à tous les
 * rôles authentifiés (aucune restriction sur qui peut chercher) —
 * content_admin exclu des résultats (hors scope du chantier chat),
 * l'appelant lui-même exclu.
 */
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const pool = require('../config/db');
    const params = [`%${q}%`, req.user.phone];
    let roleClause = '';
    if (req.query.role) {
      params.push(req.query.role);
      roleClause = ' AND role = $3';
    }

    const result = await pool.query(
      `SELECT phone, full_name, role, photo_url
       FROM users
       WHERE is_active = true
         AND role != 'content_admin'
         AND phone != $2
         AND (full_name ILIKE $1 OR phone LIKE $1)
         ${roleClause}
       ORDER BY full_name ASC
       LIMIT 10`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[chat/users/search]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// NOUVEAU SYSTÈME — trouver/créer une conversation patient↔médecin
// (mal classée « ancien système » avant Phase 11/12 : utilise déjà
// getOrCreateConversation, conversations/conversation_participants —
// conservée telle quelle, cf. rapport Phase 11/12)
// ============================================================

/**
 * POST /api/v1/chat/medecin/:medecin_phone
 * Trouver ou créer une conversation patient↔médecin
 * Retourne conversation_id
 */
router.post('/medecin/:medecin_phone', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }

    const conversation = await chatService.getOrCreateConversation(
      req.user.phone,
      req.params.medecin_phone,
      req.user.role
    );

    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
