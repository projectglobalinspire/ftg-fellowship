const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail } = require('./_email');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentor', 'admin']);
    if (!auth) return;
    if (req.body && req.body.action === 'email_test') {
      if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat menguji provider email' });
      const requestedRecipient = String(req.body.recipient || auth.profile.email || auth.user.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedRecipient) || requestedRecipient.length > 254) return send(res, 400, { error:'Email tujuan tes tidak valid' });
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
