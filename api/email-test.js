const { send, requireRole, method } = require('./_lib');
const { deliverEmail, emailProvider, senderAddress } = require('./_email');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    const provider = emailProvider();
    if (req.method === 'GET') return send(res, 200, {
      configured: provider !== 'not_configured', provider,
      sender: provider === 'not_configured' ? null : senderAddress()
    });
    if (provider === 'not_configured') return send(res, 503, { error:'Provider email belum dikonfigurasi' });
    const target = { id:auth.profile.id, email:auth.profile.email || auth.user.email };
    const result = await deliverEmail(target, {
      title:'Tes notifikasi email berhasil',
      body:'Zoho Mail telah tersambung ke FTG Fellowship. Email tugas, pengingat, feedback, dan revisi siap dikirim dari server.',
      href:'admin-dashboard.html'
    }, null);
    if (result.status !== 'sent') return send(res, 502, { ok:false, provider, error:result.reason || 'Pengiriman gagal', outbox_id:result.outbox_id });
    return send(res, 200, { ok:true, provider, sent_to:target.email, provider_id:result.provider_id, outbox_id:result.outbox_id });
  } catch (error) { return send(res, 500, { error:error.message }); }
};
