const pool = require('../config/db');

/**
 * POST /api/v1/admin/waha-webhook
 * Webhook WAHA pour alertes session
 * Pas d'authMiddleware - WAHA appelle sans token
 */
async function wahaWebhook(req, res) {
  try {
    const { event, session, payload } = req.body;

    // Vérifier payload WAHA valide
    if (!event || !session) {
      console.error('[WAHA WEBHOOK] Payload invalide:', req.body);
      return res.status(400).json({ success: false, message: 'Payload invalide' });
    }

    // Log dans audit_log
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      ['waha_webhook', 'system', 'waha_sessions', null, JSON.stringify({ event, session, payload })]
    );

    console.log('[WAHA WEBHOOK] Event reçu:', event, 'Session:', session);

    // Si session tombée, tenter relance automatique
    if (event === 'session.status' && payload?.status !== 'WORKING') {
      console.error('[WAHA ALERTE] Session tombée:', session, 'Status:', payload.status);
      
      try {
        const wahaUrl = process.env.WAHA_URL || 'https://waha-bolamu.onrender.com';
        const restartUrl = `${wahaUrl}/api/sessions/${session}/restart`;
        
        console.log('[WAHA WEBHOOK] Tentative restart session:', restartUrl);
        
        const restartResponse = await fetch(restartUrl, {
          method: 'POST',
          headers: {
            'X-Api-Key': process.env.WAHA_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (restartResponse.ok) {
          console.log('[WAHA WEBHOOK] Restart OK pour session:', session);
        } else {
          console.error('[WAHA WEBHOOK] Restart échoué:', restartResponse.status);
        }
      } catch (restartErr) {
        console.error('[WAHA WEBHOOK] Erreur restart:', restartErr.message);
      }
    }

    // Toujours répondre 200 (WAHA re-essaie si pas de 200)
    res.status(200).json({ success: true, message: 'Webhook traité' });
  } catch (error) {
    console.error('[WAHA WEBHOOK] Erreur:', error.message);
    // Toujours répondre 200 même en erreur
    res.status(200).json({ success: true, message: 'Webhook traité avec erreur' });
  }
}

module.exports = { wahaWebhook };
