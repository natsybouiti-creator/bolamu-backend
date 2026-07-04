const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Routes publiques
router.get('/sport-groups', communityController.getSportGroups);
router.get('/sport-groups/:id/members', communityController.getGroupMembers);
router.get('/clubs', communityController.getClubs);
router.get('/leaderboard', communityController.getLeaderboard);
router.get('/leaderboard/:group_id', communityController.getGroupLeaderboard);
router.get('/chat/:conversation_id/messages', communityController.getMessages);

// Routes protégées (auth requise)
router.post('/sport-groups', authMiddleware, communityController.createSportGroup);
router.post('/sport-groups/:id/join', authMiddleware, communityController.joinGroup);
router.delete('/sport-groups/:id/leave', authMiddleware, communityController.leaveGroup);
router.post('/clubs', authMiddleware, communityController.createClub);
router.post('/clubs/:id/join', authMiddleware, communityController.joinClub);
router.post('/chat/:conversation_id/messages', authMiddleware, communityController.sendMessage);
router.get('/streaks/me', authMiddleware, communityController.getMyStreak);

// Routes sociales leaderboard
router.post('/leaderboard/encourage', authMiddleware, communityController.encourageMember);
router.post('/leaderboard/comment', authMiddleware, communityController.commentMember);

// Follow un utilisateur
router.post('/follow/:phone', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/db');
    const followerPhone = req.user.phone;
    const followingPhone = req.params.phone;
    
    await pool.query(`
      INSERT INTO follows (follower_phone, following_phone, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
    `, [followerPhone, followingPhone]);
    
    res.json({ success: true, following: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
