const { send, adminFetch } = require('./_lib');

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
  const googleMatches = await adminFetch(`/rest/v1/profiles?google_email=ilike.${encodeURIComponent(email)}&select=id,email,full_name,role,status,google_email&limit=2`);
  if (googleMatches && googleMatches.length === 1) return googleMatches[0];
  const emailMatches = await adminFetch(`/rest/v1/profiles?email=ilike.${encodeURIComponent(email)}&select=id,email,full_name,role,status,google_email&limit=2`);
  return emailMatches && emailMatches.length === 1 ? emailMatches[0] : null;
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'GP';
}

async function registerGoogleUser(identity, requestedRole) {
  const email = String(identity.email).toLowerCase();
  const listed = await adminFetch('/auth/v1/admin/users?page=1&per_page=1000');
  let user = (listed.users || listed || []).find(item => String(item.email || '').toLowerCase() === email);
  const displayName = String(identity.name || email.split('@')[0]).trim().slice(0, 120);
  if (!user) {
    user = await adminFetch('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email, email_confirm: true,
        user_metadata: {
          full_name: displayName, initials: initials(displayName), role: 'mentee',
          requested_role: requestedRole, signup_provider: 'google', google_email: email,
          picture: String(identity.picture || '').slice(0, 600)
        }
      })
    });
  } else {
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ user_metadata: Object.assign({}, user.user_metadata || {}, { requested_role: requestedRole, signup_provider: 'google', google_email: email }) })
    });
  }

  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id`);
  const profile = {
    email, full_name: displayName, role: 'mentee', initials: initials(displayName),
    status: 'invited', google_email: email, google_connected_at: new Date().toISOString(),
    onboarding_completed: false, updated_at: new Date().toISOString()
  };
  if (rows && rows[0]) {
    await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(profile) });
  } else {
    await adminFetch('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(Object.assign({ id: user.id }, profile)) });
  }
  return Object.assign({ id: user.id }, profile);
}

module.exports = async function googleLogin(req, res) {
  try {
    if (!GOOGLE_CLIENT_ID) return send(res, 503, { error: 'Login Google belum dikonfigurasi panitia' });
    const body = req.body || {};
    const role = String(body.role || '').toLowerCase();
    if (!body.credential || !VALID_ROLES.includes(role)) return send(res, 400, { error: 'Data login Google tidak lengkap' });

    const identity = await googleIdentity(String(body.credential));
    let profile = await profileForGoogle(String(identity.email).toLowerCase(), role);
    let registered = false;
    if (!profile) {
      profile = await registerGoogleUser(identity, role);
      registered = true;
    }
    if (profile.status === 'active' && profile.role !== role) {
      return send(res, 403, { error: `Akun ini terdaftar sebagai ${profile.role}. Pilih jenis login yang sesuai.` });
    }
    if (!['active', 'invited'].includes(profile.status)) {
      const message = profile.status === 'dropped' ? 'Status kepesertaan telah dinyatakan gugur.' : 'Akun sedang dikunci panitia.';
      return send(res, 403, { error: `${message} Hubungi panitia untuk informasi lebih lanjut.` });
    }

    const redirectTo = `${safeRedirectOrigin(req)}/login.html?google=1&role=${encodeURIComponent(role)}`;
    const generated = await adminFetch('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({ type: 'magiclink', email: profile.email, options: { redirect_to: redirectTo } })
    });
    const tokenHash = generated && (generated.hashed_token || (generated.properties && generated.properties.hashed_token));
    if (!tokenHash) throw new Error('Supabase tidak menerbitkan token login');
    // Verifikasi dilakukan langsung oleh Supabase JS di domain aplikasi. Ini
    // menghindari Site URL proyek yang lama (localhost) mengambil alih redirect.
    const verifyPath = `/login.html#google_token=${encodeURIComponent(tokenHash)}&type=email&role=${encodeURIComponent(role)}`;

    await adminFetch('/rest/v1/audit_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ actor_id: profile.id, action: 'auth.google_login', entity_type: 'profile', entity_id: profile.id, detail: { google_email: identity.email, role } })
    }).catch(() => null);
    return send(res, 200, { verify_path: verifyPath, role, display_name: profile.full_name, registered, status: profile.status });
  } catch (error) {
    return send(res, 500, { error: error.message || 'Login Google gagal diproses' });
  }
};
