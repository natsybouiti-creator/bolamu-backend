const db = require('../config/db');

const logAccessAttempt = async (recordId, user, reason, ip) => {
  try {
    await db.query(
      `INSERT INTO health_record_access_log
       (record_id, accessed_by, role_at_access, access_reason, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, user.id, user.role, reason, ip]
    );
  } catch (err) {
    console.error('[BHP] Échec log accès:', err.message);
  }
};

const bhpAccessMiddleware = (allowedRoles) => 
  async (req, res, next) => {
    const { user } = req;
    const recordId = req.params.recordId || req.params.id;

    // 1. Vérification du rôle
    if (!allowedRoles.includes(user.role)) {
      await logAccessAttempt(
        recordId, user, 'ACCESS_DENIED_ROLE', req.ip
      );
      return res.status(403).json({ 
        success: false, 
        error: 'BHP_ACCESS_DENIED' 
      });
    }

    // 2. Vérification consentement si record médical
    if (recordId) {
      const result = await db.query(
        'SELECT * FROM health_records WHERE id=$1 AND is_deleted=false',
        [recordId]
      );
      const record = result.rows[0];
      
      if (record && !record.consent_granted) {
        await logAccessAttempt(
          recordId, user, 'ACCESS_DENIED_CONSENT', req.ip
        );
        return res.status(403).json({ 
          success: false, 
          error: 'BHP_CONSENT_REQUIRED' 
        });
      }

      // 3. Médecin CMS : consultation active requise
      if (user.role === 'cms_medecin' && record) {
        const rdv = await db.query(
          `SELECT id FROM appointments 
           WHERE doctor_id=$1 AND patient_id=$2
           AND status='en_cours' AND DATE(scheduled_at)=CURRENT_DATE`,
          [user.id, record.patient_id]
        );
        if (!rdv.rows.length) {
          await logAccessAttempt(
            recordId, user, 
            'ACCESS_DENIED_NO_ACTIVE_RDV', req.ip
          );
          return res.status(403).json({ 
            success: false, 
            error: 'BHP_NO_ACTIVE_CONSULTATION' 
          });
        }
      }

      // 4. Log accès autorisé
      await logAccessAttempt(
        recordId, user, 
        req.body?.reason || 'access_granted', req.ip
      );
    }

    next();
  };

module.exports = { bhpAccessMiddleware, logAccessAttempt };
