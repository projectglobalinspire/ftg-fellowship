const { send, adminFetch, currentUser, method } = require('./_lib');
module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try { const user = await currentUser(req); const b = req.body || {}; await adminFetch('/rest/v1/error_logs', { method: 'POST', body: JSON.stringify({ user_id: user && user.id, level: String(b.level || 'error').slice(0, 16), source: String(b.source || 'web').slice(0, 120), message: String(b.message || 'Unknown error').slice(0, 1000), context: b.context && typeof b.context === 'object' ? b.context : {} }) }); return send(res, 202, { ok: true }); } catch (_) { return send(res, 202, { ok: false }); }
};
