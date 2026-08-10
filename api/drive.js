const { send, adminFetch, requireRole, method } = require('./_lib');

const ROOT_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const OWNER_EMAIL = process.env.GOOGLE_DRIVE_OWNER_EMAIL || 'projectglobalinspire@gmail.com';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
let tokenCache = { value: '', expiresAt: 0 };

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let length = 0;
    req.on('data', part => {
      length += part.length;
      if (length > limit) {
        reject(new Error('Payload terlalu besar'));
        req.destroy();
        return;
      }
      parts.push(part);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

function uploadTarget(value) {
  let target;
  try { target = new URL(String(value || '')); } catch (_) { return null; }
  if (target.protocol !== 'https:' || target.hostname !== 'www.googleapis.com') return null;
  if (target.pathname !== '/upload/drive/v3/files') return null;
  if (target.searchParams.get('uploadType') !== 'resumable' || !target.searchParams.get('upload_id')) return null;
  return target.toString();
}

async function uploadChunk(req, res) {
  const target = uploadTarget(req.headers['x-ftg-upload-url']);
  if (!target) return send(res, 400, { error: 'Sesi unggah Drive tidak valid' });
  const range = String(req.headers['x-ftg-content-range'] || '');
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
  if (!match) return send(res, 400, { error: 'Rentang unggahan tidak valid' });
  const start = Number(match[1]), end = Number(match[2]), total = Number(match[3]);
  if (total < 1 || total > MAX_BYTES || end < start || end >= total || end - start + 1 > MAX_CHUNK_BYTES) {
    return send(res, 400, { error: 'Ukuran atau rentang unggahan tidak valid' });
  }
  const chunk = await readRaw(req, MAX_CHUNK_BYTES);
  if (chunk.length !== end - start + 1) return send(res, 400, { error: 'Isi potongan berkas tidak lengkap' });
  const response = await fetch(target, {
    method: 'PUT', redirect: 'manual',
    headers: {
      'Content-Type': String(req.headers['x-ftg-file-type'] || 'application/octet-stream'),
      'Content-Length': String(chunk.length), 'Content-Range': range
    },
    body: chunk
  });
  if (response.status === 308) return send(res, 200, { complete: false, received: response.headers.get('Range') || `bytes=0-${end}` });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok || !data || !data.id) {
    const message = data && data.error && data.error.message;
    return send(res, response.status >= 400 ? response.status : 502, { error: message || `Google Drive menolak unggahan (${response.status})` });
  }
  return send(res, 200, { complete: true, file: data });
}

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
  if (!method(req, res, ['GET', 'POST', 'PUT'])) return;
  try {
    const auth = await requireRole(req, res, ['mentee', 'mentor', 'admin']);
    if (!auth) return;
    if (req.method === 'PUT') {
      if (auth.profile.role !== 'mentee') return send(res, 403, { error: 'Hanya mentee yang dapat mengunggah pengumpulan' });
      return uploadChunk(req, res);
    }
    if (req.method === 'GET') {
      return send(res, 200, { configured: configured(), owner: OWNER_EMAIL, root_folder_id: configured() ? ROOT_ID : null });
    }
    if (!configured()) return send(res, 503, { error: 'Drive pusat belum selesai diotorisasi panitia' });
    const rawBody = await readRaw(req, 64 * 1024);
    let body = {};
    try { body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}; }
    catch (_) { return send(res, 400, { error: 'Payload JSON tidak valid' }); }
    const profiles = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,email,full_name,google_email,mentor_id,status`);
    const profile = profiles && profiles[0];
    if (!profile || profile.status !== 'active') return send(res, 403, { error: 'Akun tidak aktif' });

    if (body.action === 'mentor-share') {
      if (auth.profile.role !== 'mentor') return send(res, 403, { error: 'Hanya mentor yang dapat memperbarui akses mentor' });
      if (!profile.google_email) return send(res, 400, { error: 'Hubungkan akun Google mentor terlebih dahulu' });
      if (!body.file_id || !(await isInsideRoot(body.file_id))) return send(res, 400, { error: 'Berkas bukan bagian dari Drive pusat FTG' });
      await shareReader(body.file_id, profile.google_email);
      await adminFetch('/rest/v1/audit_logs', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ actor_id: auth.user.id, action: 'drive.mentor_share', entity_type: 'drive_file', entity_id: body.file_id, detail: { mentor_email: profile.google_email } })
      });
      return send(res, 200, { shared: true, email: profile.google_email, file_id: body.file_id });
    }
    if (auth.profile.role !== 'mentee') return send(res, 403, { error: 'Hanya mentee yang dapat mengunggah pengumpulan' });

    if (body.action === 'delete') {
      if (!body.file_id || !(await isInsideRoot(body.file_id))) return send(res, 400, { error: 'Berkas bukan bagian dari Drive pusat FTG' });
      const owned = await drive(`files/${encodeURIComponent(body.file_id)}?fields=id,name,trashed,appProperties`);
      if (!owned.appProperties || owned.appProperties.ftgUserId !== auth.user.id) {
        return send(res, 403, { error: 'Berkas ini bukan milik pengumpulan akunmu' });
      }
      const trashed = await drive(`files/${encodeURIComponent(body.file_id)}?fields=id,name,trashed`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true })
      });
      await adminFetch('/rest/v1/audit_logs', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ actor_id: auth.user.id, action: 'drive.central_trash', entity_type: 'drive_file', entity_id: body.file_id, detail: { name: owned.name, recoverable: true } })
      });
      return send(res, 200, { deleted: true, recoverable: true, file: trashed });
    }

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
module.exports.config = { api: { bodyParser: false } };
