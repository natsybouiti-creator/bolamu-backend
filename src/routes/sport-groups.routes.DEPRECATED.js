// ============================================================
// Routes : Groupes de sport
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const sportGroupsService = require('../services/sport-groups.service');

/**
 * GET /api/v1/sport-groups
 * Liste des groupes de sport (auth optionnel)
 */
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    const phone = req.user?.phone || null;
    
    const groups = await sportGroupsService.getGroups({ phone, city });
    
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('[SPORT-GROUPS] Error getting sport groups:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des groupes' });
  }
});

/**
 * POST /api/v1/sport-groups/:id/join
 * Rejoindre un groupe (auth patient requis)
 */
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const { id: group_id } = req.params;
    const phone = req.user.phone;
    
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    
    const result = await sportGroupsService.joinGroup({ phone, group_id });
    
    res.json(result);
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la jonction au groupe' });
  }
});

/**
 * DELETE /api/v1/sport-groups/:id/join
 * Quitter un groupe (auth patient requis)
 */
router.delete('/:id/join', authMiddleware, async (req, res) => {
  try {
    const { id: group_id } = req.params;
    const phone = req.user.phone;
    
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    
    const result = await sportGroupsService.leaveGroup({ phone, group_id });
    
    res.json(result);
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sortie du groupe' });
  }
});

/**
 * GET /api/v1/sport-groups/:id/members
 * Top membres d'un groupe
 */
router.get('/:id/members', async (req, res) => {
  try {
    const { id: group_id } = req.params;
    const { limit = 10 } = req.query;
    
    const members = await sportGroupsService.getGroupMembers({ group_id, limit: parseInt(limit) });
    
    res.json({ success: true, data: members });
  } catch (error) {
    console.error('Error getting group members:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des membres' });
  }
});

module.exports = router;
