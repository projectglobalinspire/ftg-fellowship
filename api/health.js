const { send, adminFetch, method } = require('./_lib');
module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const result = { app: 'healthy', database: 'unknown', reminders: 'unknown', checked_at: new Date().toISOString() };
  try { await adminFetch('/rest/v1/program_settings?id=eq.1&select=id'); result.database = 'healthy'; } catch (e) { result.database = 'degraded'; }
  try { const rows = await adminFetch('/rest/v1/integration_status?select=service,status,detail,checked_at'); result.integrations = rows; const r = rows.find(x => x.service === 'reminders'); if (r) result.reminders = r.status; } catch (_) {}
  return send(res, result.database === 'healthy' ? 200 : 503, result);
};
