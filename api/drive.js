const { send, adminFetch, requireRole, method } = require('./_lib');

const ROOT_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const OWNER_EMAIL = process.env.GOOGLE_DRIVE_OWNER_EMAIL || 'projectglobalinspire@gmail.com';
const MAX_BYTES = 20 * 1024 * 1024;
let tokenCache = { value: '', expiresAt: 0 };

function configured() {
  return !!(ROOT_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function accessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('Otorisasi Drive pusat perlu diperbarui oleh panitia');
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Math.max(60, +(data.expires_in || 3600) - 60) * 1000 };
  return tokenCache.value;
}

async function drive(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, Object.assign({}, options, {
    headers: Object.assign({ Authorization: `Bearer ${token}` }, options.headers || {})
  }));
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) throw new Error((data && data.error && data.error.message) || `Google Drive ${response.status}`);
  return data;
}

function clean(value, fallback) {
  return String(value || fallback || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 120) || fallback;
}

async function folder(name, parentId) {
  const safeName = clean(name, 'Tanpa Nama');
  const escaped = safeName.replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and '${parentId}' in parents and trashed=false`;
  const found = await drive(`files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);
  if (found.files && found.files[0]) return found.files[0].id;
  const created = await drive('files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: safeName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  });
  return created.id;
}

async function submissionFolder(profile, label) {
  const menteeRoot = await folder('Mentee', ROOT_ID);
  const person = await folder(profile.full_name || profile.email, menteeRoot);
  return folder(label, person);
}

async function isInsideRoot(fileId) {
  let ids = [fileId];
  const seen = new Set();
  for (let depth = 0; depth < 6 && ids.length; depth++) {
    const next = [];
    for (const id of ids) {
      if (id === ROOT_ID) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const item = await drive(`files/${encodeURIComponent(id)}?fields=id,parents`);
      for (const parent of item.parents || []) {
        if (parent === ROOT_ID) return true;
        next.push(parent);
      }
    }
    ids = next;
  }
  return false;
}

async function shareReader(fileId, email) {
  if (!email || email.toLowerCase() === OWNER_EMAIL.toLowerCase()) return null;
  try {
    return await drive(`files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email })
    });
  } catch (error) {
    if (/already|existing permission/i.test(error.message)) return null;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentee', 'mentor', 'admin']);
    if (!auth) return;
    if (req.method === 'GET') {
      return send(res, 200, { configured: configured(), owner: OWNER_EMAIL, root_folder_id: configured() ? ROOT_ID : null });
    }
    if (!configured()) return send(res, 503, { error: 'Drive pusat belum selesai diotorisasi panitia' });
    if (auth.profile.role !== 'mentee') return send(res, 403, { error: 'Hanya mentee yang dapat mengunggah pengumpulan' });
    const body = req.body || {};
    const profiles = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,email,full_name,google_email,mentor_id,status`);
    const profile = profiles && profiles[0];
    if (!profile || profile.status !== 'active') return send(res, 403, { error: 'Akun mentee tidak aktif' });

    if (body.action === 'session') {
      const size = Number(body.size || 0);
      if (!body.file_name || !size || size > MAX_BYTES) return send(res, 400, { error: 'Nama atau ukuran berkas tidak valid (maksimal 20 MB)' });
      const parentId = await submissionFolder(profile, clean(body.folder_label, 'Pengumpulan'));
      const token = await accessToken();
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size,mimeType,parents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': body.mime_type || 'application/octet-stream',
          'X-Upload-Content-Length': String(size)
        },
        body: JSON.stringify({ name: clean(body.file_name, 'berkas'), parents: [parentId], appProperties: { ftgUserId: auth.user.id, ftgFolder: clean(body.folder_label, 'Pengumpulan') } })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error.error && error.error.message) || `Sesi unggah Drive ${response.status}`);
      }
      const uploadUrl = response.headers.get('Location');
      if (!uploadUrl) throw new Error('Google Drive tidak mengirim URL unggah');
      return send(res, 200, { upload_url: uploadUrl, owner: OWNER_EMAIL });
    }

    if (body.action === 'finalize') {
      if (!body.file_id || !(await isInsideRoot(body.file_id))) return send(res, 400, { error: 'Berkas bukan bagian dari Drive pusat FTG' });
      const file = await drive(`files/${encodeURIComponent(body.file_id)}?fields=id,name,webViewLink,webContentLink,size,mimeType,parents`);
      let mentorEmail = process.env.MENTOR_GOOGLE_EMAIL || '';
      if (profile.mentor_id) {
        const mentors = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profile.mentor_id)}&select=google_email`);
        mentorEmail = (mentors && mentors[0] && mentors[0].google_email) || mentorEmail;
      }
      const shares = [];
      for (const email of [profile.google_email, mentorEmail].filter(Boolean)) {
        try { await shareReader(file.id, email); shares.push({ email, shared: true }); }
        catch (error) { shares.push({ email, shared: false, reason: error.message }); }
      }
      await adminFetch('/rest/v1/audit_logs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ actor_id: auth.user.id, action: 'drive.central_upload', entity_type: 'drive_file', entity_id: file.id, detail: { name: file.name, owner: OWNER_EMAIL, mentor_email: mentorEmail } })
      });
      const mentorShare = mentorEmail ? shares.find(item => item.email === mentorEmail) : null;
      return send(res, 200, { file, owner: OWNER_EMAIL, sharing: mentorShare || { shared: false, reason: 'Mentor belum menghubungkan akun Google' }, shares });
    }
    return send(res, 400, { error: 'Aksi Drive tidak dikenali' });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
