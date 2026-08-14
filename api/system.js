const { send, adminFetch, currentUser, method } = require('./_lib');
const { emailProvider, senderAddress } = require('./_email');

async function certificates(req, res) {
  if (!method(req, res, ['GET'])) return;
  if (req.query.code) {
    const code = String(req.query.code).replace(/[^a-f0-9]/gi, '').slice(0, 64);
    const rows = await adminFetch('/rest/v1/rpc/verify_certificate', { method:'POST', body:JSON.stringify({ code }) });
    return send(res, rows && rows[0] ? 200 : 404, rows && rows[0] ? { certificate:rows[0] } : { error:'Sertifikat tidak ditemukan' });
  }
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error:'Sesi tidak valid' });
  const rows = await adminFetch(`/rest/v1/certificates?mentee_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=*&order=issued_at.desc&limit=1`);
  return send(res, 200, { certificate:rows[0] || null });
}

async function errors(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const user = await currentUser(req), body = req.body || {};
    await adminFetch('/rest/v1/error_logs', { method:'POST', body:JSON.stringify({ user_id:user && user.id, level:String(body.level || 'error').slice(0,16), source:String(body.source || 'web').slice(0,120), message:String(body.message || 'Unknown error').slice(0,1000), context:body.context && typeof body.context === 'object' ? body.context : {} }) });
    return send(res, 202, { ok:true });
  } catch (_) { return send(res, 202, { ok:false }); }
}

async function health(req, res) {
  if (!method(req, res, ['GET'])) return;
  const provider = emailProvider();
  const result = { app:'healthy', database:'unknown', reminders:'unknown', checked_at:new Date().toISOString(), email:provider === 'not_configured' ? 'not_configured' : 'configured', email_provider:provider, email_sender:provider === 'not_configured' ? null : senderAddress(), central_drive:process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ? 'configured' : 'not_configured', calendar:'healthy' };
  try { await adminFetch('/rest/v1/program_settings?id=eq.1&select=id'); result.database='healthy'; } catch (_) { result.database='degraded'; }
  try { const rows=await adminFetch('/rest/v1/integration_status?select=service,status,detail,checked_at'); result.integrations=rows; const reminder=rows.find(item=>item.service==='reminders'); if(reminder)result.reminders=reminder.status; } catch (_) {}
  return send(res, result.database === 'healthy' ? 200 : 503, result);
}

module.exports = async function handler(req, res) {
  try {
    const resource=String(req.query.resource || '');
    if (resource === 'certificates') return await certificates(req, res);
    if (resource === 'errors') return await errors(req, res);
    if (resource === 'health') return await health(req, res);
    return send(res, 404, { error:'Endpoint sistem tidak ditemukan' });
  } catch (error) { return send(res, 500, { error:error.message }); }
};
