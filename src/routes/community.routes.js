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

module.exports = router;
