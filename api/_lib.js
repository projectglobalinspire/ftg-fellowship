const crypto = require('crypto');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
const rateBuckets = new Map();

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function requestId(req) {
  return String(req.headers['x-vercel-id'] || req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 120);
}

function serverError(req, res, error, publicMessage = 'Permintaan belum dapat diproses') {
  const id = requestId(req);
  const safeLog = String(error && error.message || error || 'Unknown server error').replace(/[\r\n]/g, ' ').slice(0, 500);
  console.error(`[${id}] ${safeLog}`);
  return send(res, 500, { error: publicMessage, request_id: id });
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket && req.socket.remoteAddress || 'unknown').slice(0, 80);
}

function rateLimit(req, res, scope, options = {}) {
  const limit = Math.max(1, Number(options.limit || 10));
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) {
    for (const [storedKey, value] of rateBuckets) if (now >= value.resetAt) rateBuckets.delete(storedKey);
  }
  if (bucket.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  send(res, 429, { error: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' });
  return false;
}

function validPassword(value) {
  const password = String(value || '');
  return password.length >= 10 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
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

module.exports = { send, serverError, rateLimit, validPassword, adminFetch, currentUser, requireRole, method, SUPABASE_URL, PUBLISHABLE };
