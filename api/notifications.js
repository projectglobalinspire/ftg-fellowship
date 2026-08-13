const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail } = require('./_email');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentor', 'admin']);
    if (!auth) return;
    if (req.body && req.body.action === 'email_test') {
      if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat menguji provider email' });
      const result = await deliverEmail({ id:auth.profile.id, email:auth.profile.email || auth.user.email }, {
        title:'Tes notifikasi email berhasil',
        body:'Zoho Mail telah tersambung ke FTG Fellowship. Email tugas, pengingat, feedback, dan revisi siap dikirim dari server.',
        href:'admin-dashboard.html'
      }, null);
      if (result.status !== 'sent') return send(res, 502, { ok:false, provider:result.provider, error:result.reason || 'Pengiriman gagal', outbox_id:result.outbox_id });
      return send(res, 200, { ok:true, provider:result.provider, sent_to:auth.profile.email || auth.user.email, provider_id:result.provider_id, outbox_id:result.outbox_id });
    }
    const items = Array.isArray(req.body && req.body.notifications) ? req.body.notifications : [req.body || {}];
    if (!items.length || items.length > 100) return send(res, 400, { error: 'Jumlah notifikasi tidak valid' });
    const targets = [...new Set(items.map(item => item.user_id).filter(Boolean))];
    const profiles = targets.length ? await adminFetch(`/rest/v1/profiles?id=in.(${targets.map(encodeURIComponent).join(',')})&select=id,email,mentor_id,notification_preferences`) : [];
    if (auth.profile.role === 'mentor' && profiles.some(profile => profile.mentor_id !== auth.user.id)) return send(res, 403, { error: 'Mentee bukan tanggung jawab mentor ini' });
    const allowed = new Set(profiles.map(profile => profile.id));
    const clean = items.filter(item => allowed.has(item.user_id)).map(item => ({
      user_id: item.user_id,
      type: String(item.type || 'general').slice(0, 80),
      title: String(item.title || 'Pemberitahuan').slice(0, 160),
      body: String(item.body || '').slice(0, 500),
      href: String(item.href || '').slice(0, 240),
      delivery: { in_app: 'sent' }
    }));
    if (!clean.length) return send(res, 400, { error: 'Penerima notifikasi tidak valid' });
    const inserted = await adminFetch('/rest/v1/notifications', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(clean) });
    let emailed = 0, failed = 0;
    for (const notice of inserted || []) {
      const profile = profiles.find(p => p.id === notice.user_id);
      const prefs = (profile && profile.notification_preferences) || {};
      if (prefs.email === false) continue;
      const result = await deliverEmail(profile, notice, notice.id);
      if (result.status === 'sent') emailed++; else if (result.status === 'failed') failed++;
      await adminFetch(`/rest/v1/notifications?id=eq.${notice.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:result.status } }) });
    }
    return send(res, 201, { ok: true, sent: clean.length, emailed, email_failed: failed });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
