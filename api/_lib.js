const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function adminFetch(path, options = {}) {
  if (!SUPABASE_URL || !SECRET) throw new Error('Server Supabase belum dikonfigurasi');
  const headers = Object.assign({ apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${path}`, Object.assign({}, options, { headers }));
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) throw new Error((data && (data.msg || data.message || data.error_description || data.error)) || `Supabase ${response.status}`);
  return data;
}

async function currentUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !SUPABASE_URL || !PUBLISHABLE) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}

async function requireRole(req, res, roles) {
  const user = await currentUser(req);
  if (!user) { send(res, 401, { error: 'Sesi tidak valid atau sudah berakhir' }); return null; }
  const profiles = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,status`);
  const profile = profiles && profiles[0];
  if (!profile || profile.status !== 'active' || roles.indexOf(profile.role) === -1) { send(res, 403, { error: 'Akses tidak diizinkan' }); return null; }
  return { user, profile };
}

function method(req, res, allowed) {
  if (allowed.indexOf(req.method) > -1) return true;
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'Metode tidak didukung' });
  return false;
}

module.exports = { send, adminFetch, currentUser, requireRole, method, SUPABASE_URL, PUBLISHABLE };
