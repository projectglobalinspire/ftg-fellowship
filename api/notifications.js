const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail, emailProvider, senderAddress } = require('./_email');

const MANUAL_TYPES = new Set(['general', 'assignment', 'deadline:manual:3', 'deadline:manual:1', 'deadline:manual:0', 'late:manual', 'review', 'session', 'registration', 'account_restored', 'certificate']);

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && String(value || '').length <= 254;
}

function cleanHref(value) {
  const href = String(value || 'mentee-dashboard.html').trim().slice(0, 240);
  if (/^(?:[a-z0-9-]+\.html(?:[?#].*)?|https:\/\/ftg-fellowship\.vercel\.app\/)/i.test(href)) return href;
  return 'mentee-dashboard.html';
}

async function adminConsole(req, res, auth) {
  if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat membuka pusat email' });
  const [profiles, outbox] = await Promise.all([
    adminFetch('/rest/v1/profiles?select=id,full_name,email,role,status&email=not.is.null&order=role.asc,full_name.asc&limit=1000'),
    adminFetch('/rest/v1/email_outbox?select=id,recipient,subject,status,error,attempts,sent_at,created_at&order=created_at.desc&limit=50')
  ]);
  return send(res, 200, {
    profiles:(profiles || []).filter(profile => validEmail(profile.email)),
    outbox:outbox || [],
    email_provider:emailProvider(),
    email_sender:senderAddress()
  });
}

async function manualSend(req, res, auth) {
  if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat mengirim pesan manual' });
  const body = req.body || {};
  const ids = [...new Set((Array.isArray(body.user_ids) ? body.user_ids : []).map(String).filter(Boolean))];
  const role = ['mentee', 'mentor', 'admin', 'all'].includes(body.target_role) ? body.target_role : '';
  if (!ids.length && !role) return send(res, 400, { error:'Pilih minimal satu penerima atau grup penerima' });
  if (ids.length > 250) return send(res, 400, { error:'Maksimal 250 penerima per pengiriman' });
  const title = String(body.title || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160);
  const message = String(body.body || '').trim().slice(0, 1000);
  if (title.length < 3 || message.length < 3) return send(res, 400, { error:'Subjek dan isi pesan wajib diisi dengan jelas' });
  const type = MANUAL_TYPES.has(String(body.type || '')) ? String(body.type) : 'general';
  const channel = ['both', 'email', 'in_app'].includes(body.channel) ? body.channel : 'both';
  let profiles = await adminFetch('/rest/v1/profiles?select=id,full_name,email,role,status,notification_preferences&email=not.is.null&limit=1000');
  profiles = (profiles || []).filter(profile => profile.status === 'active' && validEmail(profile.email));
  if (ids.length) { const allowed = new Set(ids); profiles = profiles.filter(profile => allowed.has(profile.id)); }
  else if (role !== 'all') profiles = profiles.filter(profile => profile.role === role);
  if (!profiles.length) return send(res, 400, { error:'Tidak ada akun aktif dengan email valid pada pilihan penerima' });
  if (profiles.length > 250) return send(res, 400, { error:'Grup berisi lebih dari 250 akun. Pilih penerima yang lebih spesifik.' });

  const notices = profiles.map(profile => ({
    user_id:profile.id, type, title, body:message, href:cleanHref(body.href),
    delivery:{ in_app:channel === 'email' ? 'skipped' : 'sent', email:channel === 'in_app' ? 'skipped' : 'queued', manual:true }
  }));
  let inserted = [];
  if (channel !== 'email') inserted = await adminFetch('/rest/v1/notifications', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(notices) });
  let sent = 0, failed = 0;
  const results = [];
  for (const profile of profiles) {
    if (channel === 'in_app') { sent++; results.push({ user_id:profile.id, recipient:profile.email, status:'in_app' }); continue; }
    const notice = inserted.find(item => item.user_id === profile.id);
    const result = await deliverEmail(profile, notices.find(item => item.user_id === profile.id), notice && notice.id);
    if (result.status === 'sent') sent++; else failed++;
    results.push({ user_id:profile.id, recipient:profile.email, status:result.status, error:result.reason || null });
    if (notice) await adminFetch(`/rest/v1/notifications?id=eq.${notice.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:result.status, manual:true } }) });
  }
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:auth.user.id, action:'notification.manual_send', entity_type:'notification', detail:{ channel, type, title, recipients:profiles.length, sent, failed } }) }).catch(() => null);
  return send(res, failed ? 207 : 201, { ok:failed === 0, recipients:profiles.length, sent, failed, channel, results });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentor', 'admin']);
    if (!auth) return;
    if (req.method === 'GET') return adminConsole(req, res, auth);
    if (req.body && req.body.action === 'manual_send') return manualSend(req, res, auth);
    if (req.body && req.body.action === 'email_test') {
      if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat menguji provider email' });
      const requestedRecipient = String(req.body.recipient || auth.profile.email || auth.user.email || '').trim().toLowerCase();
      if (!validEmail(requestedRecipient)) return send(res, 400, { error:'Email tujuan tes tidak valid' });
      const samples = {
        general:{type:'general',title:'Tes notifikasi email berhasil',body:'Zoho Mail telah tersambung ke FTG Fellowship dan siap mengirim notifikasi program.',href:'admin-dashboard.html'},
        assignment:{type:'assignment',title:'Tugas baru dari Mentor',body:'Riset Masalah Pengguna · Deadline Kamis, 20 Agustus 2026 pukul 23.59 WITA.',href:'assignment-submission.html'},
        deadline_3:{type:'deadline:qa:3',title:'Deadline 3 hari lagi',body:'Tugas DEFINE + Values-Alignment Matrix perlu dikumpulkan sebelum Jumat pukul 23.59 WITA.',href:'assignment-submission.html'},
        deadline_1:{type:'deadline:qa:1',title:'Deadline besok',body:'Periksa kembali jawaban, checklist, link, dan lampiran sebelum mengumpulkan tugas.',href:'assignment-submission.html'},
        deadline_0:{type:'deadline:qa:0',title:'Deadline hari ini',body:'Tugas berakhir malam ini pukul 23.59 WITA. Pastikan status berubah menjadi Menunggu Review.',href:'assignment-submission.html'},
        late:{type:'late:qa',title:'Tugas terlambat',body:'Deadline tugas telah lewat. Segera kumpulkan atau hubungi Mentor jika mengalami kendala.',href:'assignment-submission.html'},
        review:{type:'review',title:'Tugas sudah dinilai',body:'Mentor memberikan nilai 92/100 beserta feedback untuk tugas Design Thinking Week 2.',href:'mentor-feedback.html'},
        revision:{type:'review',title:'Tugas perlu direvisi',body:'Perjelas problem statement dan tambahkan bukti dari minimal dua hasil wawancara. Versi lama tetap tersimpan.',href:'assignment-submission.html'},
        session:{type:'session',title:'Undangan sesi mentoring',body:'Sesi 1-on-1 bersama Mentor dijadwalkan Sabtu, 22 Agustus 2026 pukul 10.00 WITA.',href:'mentee-dashboard.html'},
        registration:{type:'registration',title:'Pendaftaran kamu disetujui',body:'Akun Mentee FTG Fellowship kamu sudah aktif dan dapat digunakan untuk mengikuti program.',href:'mentee-dashboard.html'},
        account:{type:'account_restored',title:'Akun kembali aktif',body:'Akses akun telah dipulihkan oleh Fasil. Kamu dapat melanjutkan seluruh kegiatan fellowship.',href:'mentee-dashboard.html'},
        certificate:{type:'certificate',title:'Sertifikat fellowship tersedia',body:'Selamat! Kamu memenuhi persyaratan kelulusan. Sertifikat digital sudah dapat dilihat dan diverifikasi.',href:'certificate.html'}
      };
      const sample = samples[String(req.body.test_type || 'general')];
      if (!sample) return send(res, 400, { error:'Jenis template tes tidak valid', available:Object.keys(samples) });
      const result = await deliverEmail({ id:auth.profile.id, email:requestedRecipient }, sample, null);
      if (result.status !== 'sent') return send(res, 502, { ok:false, provider:result.provider, error:result.reason || 'Pengiriman gagal', outbox_id:result.outbox_id });
      return send(res, 200, { ok:true, template:String(req.body.test_type || 'general'), provider:result.provider, sent_to:requestedRecipient, provider_id:result.provider_id, outbox_id:result.outbox_id });
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
