// ============================================================
// Routes : Chat (Sprint 3 — conversation-based + ancien canal)
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
    const conv = await chatService.getCommunauteConversation();
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
      Math.min(parseInt(limit) || 20, 100),
      before_id ? parseInt(before_id) : null
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const myPhone = req.user.phone;
    const pool = require('../config/db');

    if (!participant_phone) {
      return res.status(400).json({ success: false, message: 'participant_phone requis' });
    }

    // Créer une conversation simple (sans vérification d'existence pour éviter les erreurs)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const convResult = await client.query(
        `INSERT INTO conversations (type, is_active) VALUES ('patient_patient', true) RETURNING id`
      );
      const conversation_id = convResult.rows[0].id;

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, participant_phone, joined_at) VALUES ($1, $2, NOW()), ($1, $3, NOW())`,
        [conversation_id, myPhone, participant_phone]
      );

      await client.query('COMMIT');
      return res.json({ success: true, data: { conversation_id } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// ANCIEN SYSTÈME — canal médecins (conservé pour compatibilité)
// Les routes fixes sont déclarées AVANT /:medecin_phone dynamique
// ============================================================

/**
 * GET /api/v1/chat/medecin/messages
 * Messages avec un médecin (ancien système canal)
 */
router.get('/medecin/messages', authMiddleware, async (req, res) => {
  try {
    const { doctor_phone } = req.query;
    const phone = req.user.phone;

    if (req.user.role !== 'patient' && req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients et médecins' });
    }

    if (!doctor_phone) {
      return res.status(400).json({ success: false, message: 'Numéro de médecin requis' });
    }

    const channel = `medecin_${doctor_phone}`;
    const { limit = 20, before_id } = req.query;

    const messages = await chatService.getMessages({
      channel,
      limit: parseInt(limit),
      before_id: before_id ? parseInt(before_id) : null
    });

    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/chat/medecin/messages
 * Envoyer un message à un médecin (ancien système canal)
 */
router.post('/medecin/messages', authMiddleware, async (req, res) => {
  try {
    const { content, doctor_phone } = req.body;
    const sender_phone = req.user.phone;

    if (req.user.role !== 'patient' && req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients et médecins' });
    }

    if (!doctor_phone) {
      return res.status(400).json({ success: false, message: 'Numéro de médecin requis' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu du message requis' });
    }

    const channel = `medecin_${doctor_phone}`;
    const message = await chatService.sendMessage({
      sender_phone,
      channel,
      content,
      message_type: 'text'
    });

    res.json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
      req.params.medecin_phone
    );

    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/chat/doctors
 * Liste des médecins avec qui le patient a eu des RDV
 */
router.get('/doctors', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    const doctors = await chatService.getPatientDoctors({ patient_phone: req.user.phone });
    res.json({ success: true, data: doctors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// ANCIEN SYSTÈME — canal communauté / groupes sport
// ============================================================

/**
 * POST /api/v1/chat/messages/:id/react
 * Ajouter une réaction à un message (groupes sport)
 */
router.post('/messages/:id/react', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    const result = await chatService.addReaction({
      message_id: req.params.id,
      phone: req.user.phone,
      reaction: req.body.reaction || 'encourage'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/chat/:channel/messages
 * Messages d'un canal (groupes sport, communauté)
 */
router.get('/:channel/messages', authMiddleware, async (req, res) => {
  try {
    const { channel } = req.params;
    const { limit = 20, before_id } = req.query;

    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }

    const messages = await chatService.getMessages({
      channel,
      limit: parseInt(limit),
      before_id: before_id ? parseInt(before_id) : null
    });

    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/chat/:channel/messages
 * Envoyer un message dans un canal (groupes sport, communauté)
 */
router.post('/:channel/messages', authMiddleware, async (req, res) => {
  try {
    const { channel } = req.params;
    const { content, message_type = 'text', achievement_data } = req.body;
    const sender_phone = req.user.phone;

    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu du message requis' });
    }

    const message = await chatService.sendMessage({
      sender_phone,
      channel,
      content,
      message_type,
      achievement_data
    });

    res.json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
