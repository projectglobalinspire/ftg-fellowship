const { adminFetch } = require('./_lib');

const FROM = process.env.NOTIFICATION_FROM_EMAIL || 'FTG Fellowship <noreply@projectglobalinspire.com>';

function htmlTemplate(title, body, href) {
  const safe = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const link = href && /^https?:\/\//i.test(href) ? href : `https://ftg-fellowship.vercel.app/${String(href || '').replace(/^\//,'')}`;
  return `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:26px;border:1px solid #e2e8f0"><div style="color:#1a5f4f;font-size:12px;font-weight:800;letter-spacing:.08em">FTG × GI FELLOWSHIP</div><h1 style="font-size:21px;color:#1e293b;margin:12px 0 8px">${safe(title)}</h1><p style="font-size:14px;line-height:1.65;color:#475569">${safe(body)}</p><a href="${safe(link)}" style="display:inline-block;margin-top:16px;background:#1a5f4f;color:#fff;text-decoration:none;padding:11px 17px;border-radius:10px;font-weight:700;font-size:13px">Buka Dashboard</a><p style="font-size:10px;color:#94a3b8;margin-top:22px">Email otomatis dari Future Builders Fellowship.</p></div></div>`;
}

async function deliverEmail(profile, notice, notificationId) {
  if (!profile || !profile.email) return { status: 'skipped', reason: 'Email penerima tidak tersedia' };
  const payload = {
    notification_id: notificationId || null,
    user_id: profile.id,
    recipient: profile.email,
    subject: `[FTG Fellowship] ${notice.title}`,
    html: htmlTemplate(notice.title, notice.body, notice.href),
    status: process.env.RESEND_API_KEY ? 'queued' : 'skipped',
    error: process.env.RESEND_API_KEY ? null : 'RESEND_API_KEY belum dikonfigurasi'
  };
  const rows = await adminFetch('/rest/v1/email_outbox', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(payload) });
  const outbox = rows && rows[0];
  if (!process.env.RESEND_API_KEY) return { status:'skipped', outbox_id:outbox && outbox.id };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ from:FROM, to:[profile.email], subject:payload.subject, html:payload.html })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Resend ${response.status}`);
    await adminFetch(`/rest/v1/email_outbox?id=eq.${outbox.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ status:'sent',provider_id:data.id,sent_at:new Date().toISOString(),attempts:1 }) });
    return { status:'sent', provider_id:data.id, outbox_id:outbox.id };
  } catch (error) {
    if (outbox) await adminFetch(`/rest/v1/email_outbox?id=eq.${outbox.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ status:'failed',error:error.message,attempts:1 }) });
    return { status:'failed', reason:error.message, outbox_id:outbox && outbox.id };
  }
}

module.exports = { deliverEmail, htmlTemplate };
