const communityService = require('../services/communityService');

exports.getSportGroups = async (req, res) => {
  try {
    const groups = await communityService.getSportGroups();
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSportGroup = async (req, res) => {
  try {
    const { name, sport, description } = req.body;
    const phone = req.user.phone;
    const group = await communityService.createSportGroup(name, sport, description, phone);
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.user.phone;
    const result = await communityService.joinGroup(phone, id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'ALREADY_MEMBER') {
      res.status(409).json({ success: false, error: 'Déjà membre de ce groupe' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.user.phone;
    await communityService.leaveGroup(phone, id);
    res.status(200).json({ success: true, message: 'Groupe quitté' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const members = await communityService.getGroupMembers(id);
    res.status(200).json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getClubs = async (req, res) => {
  try {
    const clubs = await communityService.getClubs();
    res.status(200).json({ success: true, data: clubs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createClub = async (req, res) => {
  try {
    const { name, description, sport } = req.body;
    const phone = req.user.phone;
    const club = await communityService.createClub(name, description, sport, phone);
    res.status(201).json({ success: true, data: club });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.joinClub = async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.user.phone;
    const result = await communityService.joinClub(phone, id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'ALREADY_MEMBER') {
      res.status(409).json({ success: false, error: 'Déjà membre de ce club' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await communityService.getLeaderboard();
    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGroupLeaderboard = async (req, res) => {
  try {
    const { group_id } = req.params;
    const leaderboard = await communityService.getGroupLeaderboard(group_id);
    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const phone = req.user ? req.user.phone : null;
    const messages = await communityService.getMessages(conversation_id, phone);
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    if (error.message === 'NOT_MEMBER') {
      res.status(403).json({ success: false, error: 'Accès non autorisé' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const { content } = req.body;
    const phone = req.user.phone;
    const message = await communityService.sendMessage(phone, conversation_id, content);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    if (error.message === 'NOT_MEMBER') {
      res.status(403).json({ success: false, error: 'Accès non autorisé' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

exports.getMyStreak = async (req, res) => {
  try {
    const phone = req.user.phone;
    const streak = await communityService.getStreak(phone);
    res.status(200).json({ success: true, data: streak });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.encourageMember = async (req, res) => {
  try {
    const { target_phone } = req.body;
    const from_phone = req.user.phone;
    const result = await communityService.encourageMember(from_phone, target_phone);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.commentMember = async (req, res) => {
  try {
    const { target_phone, comment } = req.body;
    const from_phone = req.user.phone;
    if (!comment || comment.length > 140) {
      return res.status(400).json({ success: false, error: 'Commentaire invalide (max 140 caractères)' });
    }
    const result = await communityService.commentMember(from_phone, target_phone, comment);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
