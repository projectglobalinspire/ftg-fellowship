const { send, adminFetch, currentUser, method } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    if (req.query.code) {
      const code = String(req.query.code).replace(/[^a-f0-9]/gi,'').slice(0,64);
      const rows = await adminFetch('/rest/v1/rpc/verify_certificate', { method:'POST',body:JSON.stringify({ code }) });
      return send(res, rows && rows[0] ? 200 : 404, rows && rows[0] ? { certificate:rows[0] } : { error:'Sertifikat tidak ditemukan' });
    }
    const user = await currentUser(req);
    if (!user) return send(res, 401, { error:'Sesi tidak valid' });
    const rows = await adminFetch(`/rest/v1/certificates?mentee_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=*&order=issued_at.desc&limit=1`);
    return send(res, 200, { certificate:rows[0] || null });
  } catch (error) { return send(res, 500, { error:error.message }); }
};
