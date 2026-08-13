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

function htmlTemplate(title, body, href) {
  const safe = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const appUrl = String(process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
  const link = href && /^https?:\/\//i.test(href) ? href : `${appUrl}/${String(href || '').replace(/^\//,'')}`;
  return `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:26px;border:1px solid #e2e8f0"><div style="color:#1a5f4f;font-size:12px;font-weight:800;letter-spacing:.08em">FTG × GI FELLOWSHIP</div><h1 style="font-size:21px;color:#1e293b;margin:12px 0 8px">${safe(title)}</h1><p style="font-size:14px;line-height:1.65;color:#475569">${safe(body)}</p><a href="${safe(link)}" style="display:inline-block;margin-top:16px;background:#1a5f4f;color:#fff;text-decoration:none;padding:11px 17px;border-radius:10px;font-weight:700;font-size:13px">Buka Dashboard</a><p style="font-size:10px;color:#94a3b8;margin-top:22px">Email otomatis dari Future Builders Fellowship. Balas email ini jika memerlukan bantuan.</p></div></div>`;
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
    html: htmlTemplate(notice.title, body, notice.href),
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
