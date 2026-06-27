const ok  = (res, data, message = '') => res.json({ success: true,  data, message, timestamp: new Date().toISOString() });
const err = (res, status, message, code = 'ERROR') => res.status(status).json({ success: false, error: { code, message }, message, timestamp: new Date().toISOString() });
module.exports = { ok, err };
