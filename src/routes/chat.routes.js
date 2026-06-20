// ============================================================
// Routes : Chat communauté + médecins
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const chatService = require('../services/chat.service');

/**
 * GET /api/v1/chat/:channel/messages
 * Messages d'un canal (auth patient requis)
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
  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * POST /api/v1/chat/:channel/messages
 * Envoyer un message (auth patient requis)
 */
router.post('/:channel/messages', authMiddleware, async (req, res) => {
  try {
    const { channel } = req.params;
    const { content, message_type = 'text', achievement_data } = req.body;
    const sender_phone = req.user.phone;
    
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    
    if (!content || content.trim().length === 0) {
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
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * POST /api/v1/chat/messages/:id/react
 * Ajouter une réaction (auth patient requis)
 */
router.post('/messages/:id/react', authMiddleware, async (req, res) => {
  try {
    const { id: message_id } = req.params;
    const { reaction = 'encourage' } = req.body;
    const phone = req.user.phone;
    
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    
    const result = await chatService.addReaction({ message_id, phone, reaction });
    
    res.json(result);
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'ajout de la réaction' });
  }
});

/**
 * GET /api/v1/chat/medecin/messages
 * Messages avec un médecin (auth patient ou médecin requis)
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
  } catch (error) {
    console.error('Error getting doctor messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * POST /api/v1/chat/medecin/messages
 * Envoyer un message à un médecin (auth patient ou médecin requis)
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
    
    if (!content || content.trim().length === 0) {
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
  } catch (error) {
    console.error('Error sending doctor message:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * GET /api/v1/chat/doctors
 * Liste des médecins avec qui le patient a eu des RDV
 */
router.get('/doctors', authMiddleware, async (req, res) => {
  try {
    const patient_phone = req.user.phone;
    
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    
    const doctors = await chatService.getPatientDoctors({ patient_phone });
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    console.error('Error getting patient doctors:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des médecins' });
  }
});

module.exports = router;
