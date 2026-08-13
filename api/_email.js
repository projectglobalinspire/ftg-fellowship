const nodemailer = require('nodemailer');
const { adminFetch } = require('./_lib');

const DEFAULT_APP_URL = 'https://ftg-fellowship.vercel.app';

function emailProvider() {
  const requested = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  const zohoReady = Boolean(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_APP_PASSWORD);
  const resendReady = Boolean(process.env.RESEND_API_KEY);
  if ((requested === 'zoho' || !requested) && zohoReady) return 'zoho';
  if ((requested === 'resend' || !requested) && resendReady) return 'resend';
  return 'not_configured';
}

function senderAddress() {
  const fallback = process.env.ZOHO_SMTP_USER || 'noreply@projectglobalinspire.com';
  return process.env.NOTIFICATION_FROM_EMAIL || `FTG Fellowship <${fallback}>`;
}

const EMAIL_STYLES = {
  assignment: { icon:'📝', eyebrow:'TUGAS BARU', accent:'#f97316', soft:'#fff7ed', button:'Lihat Tugas', intro:'Ada tugas baru yang perlu kamu kerjakan.' },
  deadline_3: { icon:'🗓️', eyebrow:'PENGINGAT H-3', accent:'#2563eb', soft:'#eff6ff', button:'Cek Deadline', intro:'Masih ada waktu untuk menyelesaikan tugas dengan tenang.' },
  deadline_1: { icon:'⏰', eyebrow:'PENGINGAT H-1', accent:'#ea580c', soft:'#fff7ed', button:'Selesaikan Tugas', intro:'Deadline besok. Pastikan jawaban dan lampiran sudah lengkap.' },
  deadline_0: { icon:'⚡', eyebrow:'DEADLINE HARI INI', accent:'#dc2626', soft:'#fef2f2', button:'Kumpulkan Sekarang', intro:'Tugas berakhir hari ini. Jangan lupa memastikan status pengumpulan.' },
  late: { icon:'⚠️', eyebrow:'TUGAS TERLAMBAT', accent:'#b91c1c', soft:'#fef2f2', button:'Buka Tugas', intro:'Deadline telah lewat dan tugas belum tercatat selesai.' },
  review: { icon:'⭐', eyebrow:'FEEDBACK & NILAI', accent:'#7c3aed', soft:'#f5f3ff', button:'Baca Feedback', intro:'Mentor sudah meninjau hasil pekerjaanmu.' },
  revision: { icon:'🔄', eyebrow:'PERMINTAAN REVISI', accent:'#d97706', soft:'#fffbeb', button:'Perbaiki Tugas', intro:'Mentor meminta beberapa perbaikan pada tugasmu.' },
  session: { icon:'🤝', eyebrow:'AGENDA MENTORING', accent:'#0891b2', soft:'#ecfeff', button:'Lihat Agenda', intro:'Sesi mentoring baru telah dijadwalkan.' },
  registration: { icon:'✅', eyebrow:'STATUS PENDAFTARAN', accent:'#16a34a', soft:'#f0fdf4', button:'Masuk ke Platform', intro:'Ada pembaruan pada status akun FTG Fellowship kamu.' },
  account: { icon:'🔐', eyebrow:'KEAMANAN AKUN', accent:'#475569', soft:'#f8fafc', button:'Lihat Status Akun', intro:'Status akses akun kamu telah diperbarui oleh Fasil.' },
  certificate: { icon:'🎓', eyebrow:'SERTIFIKAT TERSEDIA', accent:'#1a5f4f', soft:'#ecfdf5', button:'Lihat Sertifikat', intro:'Selamat! Sertifikat fellowship kamu sudah tersedia.' },
  general: { icon:'🔔', eyebrow:'PEMBERITAHUAN', accent:'#1a5f4f', soft:'#ecfdf5', button:'Buka Dashboard', intro:'Ada pembaruan baru dari FTG Fellowship.' }
};

function templateKey(notice) {
  const type = String(notice && notice.type || '').toLowerCase();
  const title = String(notice && notice.title || '').toLowerCase();
  if (type === 'assignment') return 'assignment';
  if (type.startsWith('late:') || title.includes('terlambat')) return 'late';
  if (type.startsWith('deadline:')) {
    const days = type.split(':').pop();
    return days === '3' ? 'deadline_3' : days === '1' ? 'deadline_1' : 'deadline_0';
  }
  if (type === 'review' && (title.includes('revisi') || title.includes('direvisi'))) return 'revision';
  if (type === 'review') return 'review';
  if (type === 'session' || type === 'calendar') return 'session';
  if (type === 'registration') return 'registration';
  if (type.startsWith('account_')) return 'account';
  if (type === 'certificate') return 'certificate';
  return 'general';
}

function htmlTemplate(title, body, href, type) {
  const safe = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const appUrl = String(process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
  const link = href && /^https?:\/\//i.test(href) ? href : `${appUrl}/${String(href || '').replace(/^\//,'')}`;
  const key = templateKey({ type, title });
  const style = EMAIL_STYLES[key] || EMAIL_STYLES.general;
  return `<!doctype html><html><body style="margin:0;background:#eef3f6;font-family:Arial,Helvetica,sans-serif;color:#1e293b"><div style="display:none;max-height:0;overflow:hidden;color:transparent">${safe(style.intro)} ${safe(body)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f6"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe5ea;border-radius:22px;overflow:hidden;box-shadow:0 12px 35px rgba(30,41,59,.08)"><tr><td style="height:7px;background:${style.accent}"></td></tr><tr><td style="padding:28px 32px 22px"><table role="presentation" width="100%"><tr><td><div style="font-size:20px;font-weight:900;color:#164e43;letter-spacing:-.5px">Faith to Gro<span style="color:#f97316">W</span> <span style="color:#94a3b8;font-weight:400">×</span> Global Inspire</div><div style="font-size:10px;font-weight:800;letter-spacing:1.7px;color:#94a3b8;margin-top:5px">FUTURE BUILDERS FELLOWSHIP 2026</div></td><td align="right" valign="top"><span style="display:inline-block;background:${style.soft};color:${style.accent};border-radius:999px;padding:8px 11px;font-size:18px">${style.icon}</span></td></tr></table><div style="margin-top:28px;color:${style.accent};font-size:11px;font-weight:900;letter-spacing:1.5px">${style.eyebrow}</div><h1 style="font-size:25px;line-height:1.25;margin:8px 0 10px;color:#1e293b">${safe(title)}</h1><p style="font-size:14px;line-height:1.7;color:#64748b;margin:0 0 18px">${safe(style.intro)}</p><div style="background:${style.soft};border-left:4px solid ${style.accent};border-radius:12px;padding:15px 17px;font-size:14px;line-height:1.65;color:#334155">${safe(body)}</div><div style="margin:24px 0 8px"><a href="${safe(link)}" style="display:inline-block;background:${style.accent};color:#fff;text-decoration:none;padding:13px 19px;border-radius:11px;font-weight:800;font-size:14px">${style.button} &nbsp;→</a></div><p style="font-size:11px;line-height:1.6;color:#94a3b8;margin:22px 0 0">Jika tombol tidak berfungsi, buka <a href="${safe(link)}" style="color:${style.accent}">${safe(link)}</a></p></td></tr><tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px"><p style="margin:0;color:#64748b;font-size:11px;line-height:1.6"><b style="color:#334155">FTG Fellowship</b> · Email otomatis dari sistem program.<br>Balas email ini jika memerlukan bantuan dari Fasil.</p></td></tr></table><p style="font-size:10px;color:#94a3b8;margin:14px 0 0">© 2026 Faith to Grow × Global Inspire</p></td></tr></table></body></html>`;
}

function zohoTransport() {
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_APP_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
}

async function sendZoho(payload) {
  const info = await zohoTransport().sendMail({
    from: senderAddress(),
    to: payload.recipient,
    replyTo: process.env.NOTIFICATION_REPLY_TO || process.env.ZOHO_SMTP_USER,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    headers: { 'X-FTG-Notification': String(payload.notification_id || 'system') }
  });
  return info.messageId || info.response || 'zoho-smtp';
}

async function sendResend(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ from:senderAddress(), to:[payload.recipient], reply_to:process.env.NOTIFICATION_REPLY_TO || undefined, subject:payload.subject, html:payload.html, text:payload.text })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Resend ${response.status}`);
  return data.id;
}

async function updateOutbox(id, values) {
  if (!id) return;
  await adminFetch(`/rest/v1/email_outbox?id=eq.${encodeURIComponent(id)}`, {
    method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify(values)
  });
}

async function deliverEmail(profile, notice, notificationId) {
  if (!profile || !profile.email) return { status:'skipped', reason:'Email penerima tidak tersedia' };
  const provider = emailProvider();
  const subject = `[FTG Fellowship] ${String(notice.title || 'Pemberitahuan').replace(/[\r\n]+/g, ' ').slice(0, 160)}`;
  const body = String(notice.body || '').slice(0, 1000);
  const payload = {
    notification_id: notificationId || null,
    user_id: profile.id,
    recipient: String(profile.email).trim().toLowerCase(),
    subject,
    html: htmlTemplate(notice.title, body, notice.href, notice.type),
    text: `${notice.title}\n\n${body}\n\nBuka dashboard: ${DEFAULT_APP_URL}`,
    status: provider === 'not_configured' ? 'skipped' : 'queued',
    error: provider === 'not_configured' ? 'Provider email belum dikonfigurasi' : null
  };
  const rows = await adminFetch('/rest/v1/email_outbox', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify({
    notification_id:payload.notification_id, user_id:payload.user_id, recipient:payload.recipient,
    subject:payload.subject, html:payload.html, status:payload.status, error:payload.error
  }) });
  const outbox = rows && rows[0];
  if (provider === 'not_configured') return { status:'skipped', provider, outbox_id:outbox && outbox.id };
  try {
    const providerId = provider === 'zoho' ? await sendZoho(payload) : await sendResend(payload);
    await updateOutbox(outbox && outbox.id, { status:'sent', provider_id:providerId, sent_at:new Date().toISOString(), attempts:1, error:null });
    return { status:'sent', provider, provider_id:providerId, outbox_id:outbox && outbox.id };
  } catch (error) {
    const reason = String(error && error.message || 'Pengiriman email gagal').slice(0, 500);
    await updateOutbox(outbox && outbox.id, { status:'failed', error:reason, attempts:1 });
    return { status:'failed', provider, reason, outbox_id:outbox && outbox.id };
  }
}

module.exports = { deliverEmail, htmlTemplate, emailProvider, senderAddress };
