const ordonnanceService = require('../services/ordonnance.service');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');

async function createOrdonnance(req, res) {
  try {
    const { consultation_id, items } = req.body;
    const doctor_phone = req.user.phone;

    const result = await ordonnanceService.createOrdonnance(
      consultation_id,
      doctor_phone,
      items
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'CONSULTATION_NOT_OPEN') {
      return res.status(400).json({ 
        success: false, 
        error: 'CONSULTATION_NOT_OPEN',
        message: 'La consultation n\'est pas ouverte'
      });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function getOrdonnance(req, res) {
  try {
    const { id } = req.params;
    const requester_phone = req.user.phone;
    const role = req.user.role;

    const ordonnance = await ordonnanceService.getOrdonnance(
      id,
      requester_phone,
      role
    );

    res.json({ success: true, data: ordonnance });
  } catch (error) {
    if (error.message === 'ORDONNANCE_NOT_FOUND') {
      return res.status(404).json({ 
        success: false, 
        error: 'ORDONNANCE_NOT_FOUND'
      });
    }
    if (error.message === 'ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        error: 'ACCESS_DENIED'
      });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

async function dispenseOrdonnance(req, res) {
  try {
    const { id } = req.params;
    const pharmacie_phone = req.user.phone;

    const result = await ordonnanceService.dispenseOrdonnance(
      id,
      pharmacie_phone,
      req
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'ORDONNANCE_NOT_ACTIVE') {
      return res.status(400).json({ 
        success: false, 
        error: 'ORDONNANCE_NOT_ACTIVE',
        message: 'L\'ordonnance n\'est pas active'
      });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

module.exports = {
  createOrdonnance,
  getOrdonnance,
  dispenseOrdonnance
};
