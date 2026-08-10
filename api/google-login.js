const { send, adminFetch, method } = require('./_lib');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const VALID_ROLES = ['mentee', 'mentor', 'admin'];

function safeRedirectOrigin(req) {
  const origin = String(req.headers.origin || '');
  if (/^https:\/\/ftg-fellowship\.vercel\.app$/i.test(origin)) return origin;
  if (/^https:\/\/ftg-fellowship-[a-z0-9-]+-projectglobalinspire-8233s-projects\.vercel\.app$/i.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)) return origin;
  return 'https://ftg-fellowship.vercel.app';
}

async function googleIdentity(credential) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const identity = await response.json().catch(() => ({}));
  if (!response.ok || !identity.email) throw new Error('Identitas Google tidak valid atau sudah kedaluwarsa');
  if (identity.aud !== GOOGLE_CLIENT_ID) throw new Error('Identitas Google bukan untuk aplikasi FTG');
  if (!['true', true].includes(identity.email_verified)) throw new Error('Email Google belum terverifikasi');
  return identity;
}

async function profileForGoogle(email, role) {
  const googleMatches = await adminFetch(`/rest/v1/profiles?google_email=ilike.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}&select=id,email,full_name,role,status,google_email&limit=2`);
  if (googleMatches && googleMatches.length === 1) return googleMatches[0];

  // Akun yang memang memakai alamat Gmail yang sama dapat langsung login;
  // akun FTG lama tetap wajib menghubungkan Google sekali dari dashboard.
  const emailMatches = await adminFetch(`/rest/v1/profiles?email=ilike.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}&select=id,email,full_name,role,status,google_email&limit=2`);
  return emailMatches && emailMatches.length === 1 ? emailMatches[0] : null;
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    if (!GOOGLE_CLIENT_ID) return send(res, 503, { error: 'Login Google belum dikonfigurasi panitia' });
    const body = req.body || {};
    const role = String(body.role || '').toLowerCase();
    if (!body.credential || !VALID_ROLES.includes(role)) return send(res, 400, { error: 'Data login Google tidak lengkap' });

    const identity = await googleIdentity(String(body.credential));
    const profile = await profileForGoogle(String(identity.email).toLowerCase(), role);
    if (!profile) return send(res, 403, { error: 'Akun Google ini belum dihubungkan ke profil FTG ' + role + '. Masuk dengan email dan password sekali, lalu hubungkan Google dari dashboard.' });
    if (profile.status !== 'active') {
      const message = profile.status === 'dropped' ? 'Status kepesertaan telah dinyatakan gugur.' : 'Akun sedang dikunci panitia.';
      return send(res, 403, { error: `${message} Hubungi panitia untuk informasi lebih lanjut.` });
    }

    const redirectTo = `${safeRedirectOrigin(req)}/login.html?google=1&role=${encodeURIComponent(role)}`;
    const generated = await adminFetch('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({ type: 'magiclink', email: profile.email, options: { redirect_to: redirectTo } })
    });
    const actionLink = generated && (generated.action_link || (generated.properties && generated.properties.action_link));
    if (!actionLink) throw new Error('Supabase tidak menerbitkan sesi login');

    await adminFetch('/rest/v1/audit_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ actor_id: profile.id, action: 'auth.google_login', entity_type: 'profile', entity_id: profile.id, detail: { google_email: identity.email, role } })
    }).catch(() => null);
    return send(res, 200, { action_link: actionLink, role, display_name: profile.full_name });
  } catch (error) {
    return send(res, 500, { error: error.message || 'Login Google gagal diproses' });
  }
};
