const { send, requireRole, method } = require('./_lib');

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CHUNK_BYTES = 3 * 1024 * 1024;

module.exports.config = { api: { bodyParser: false } };

function uploadTarget(value) {
  let target;
  try { target = new URL(String(value || '')); } catch (_) { return null; }
  if (target.protocol !== 'https:' || target.hostname !== 'www.googleapis.com') return null;
  if (target.pathname !== '/upload/drive/v3/files') return null;
  if (target.searchParams.get('uploadType') !== 'resumable' || !target.searchParams.get('upload_id')) return null;
  return target.toString();
}

function readChunk(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let length = 0;
    req.on('data', part => {
      length += part.length;
      if (length > MAX_CHUNK_BYTES) {
        reject(new Error('Potongan berkas terlalu besar'));
        req.destroy();
        return;
      }
      parts.push(part);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['PUT'])) return;
  try {
    const auth = await requireRole(req, res, ['mentee']);
    if (!auth) return;

    const target = uploadTarget(req.headers['x-ftg-upload-url']);
    if (!target) return send(res, 400, { error: 'Sesi unggah Drive tidak valid' });

    const range = String(req.headers['x-ftg-content-range'] || '');
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
    if (!match) return send(res, 400, { error: 'Rentang unggahan tidak valid' });
    const start = Number(match[1]), end = Number(match[2]), total = Number(match[3]);
    if (total < 1 || total > MAX_FILE_BYTES || end < start || end >= total || end - start + 1 > MAX_CHUNK_BYTES) {
      return send(res, 400, { error: 'Ukuran atau rentang unggahan tidak valid' });
    }

    const chunk = await readChunk(req);
    if (chunk.length !== end - start + 1) return send(res, 400, { error: 'Isi potongan berkas tidak lengkap' });

    const response = await fetch(target, {
      method: 'PUT',
      redirect: 'manual',
      headers: {
        'Content-Type': String(req.headers['x-ftg-file-type'] || 'application/octet-stream'),
        'Content-Length': String(chunk.length),
        'Content-Range': range
      },
      body: chunk
    });

    if (response.status === 308) {
      return send(res, 200, { complete: false, received: response.headers.get('Range') || `bytes=0-${end}` });
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!response.ok || !data || !data.id) {
      const message = data && data.error && data.error.message;
      return send(res, response.status >= 400 ? response.status : 502, { error: message || `Google Drive menolak unggahan (${response.status})` });
    }
    return send(res, 200, { complete: true, file: data });
  } catch (error) {
    return send(res, 500, { error: error.message || 'Unggahan gagal diproses' });
  }
};
