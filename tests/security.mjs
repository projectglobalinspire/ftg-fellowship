import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ignored = new Set(['.git', '.vercel', 'node_modules', 'artifacts']);
const textExtensions = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md', '.sql', '.txt', '.yml', '.yaml']);

async function sourceFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes:true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name === '.gitignore') files.push(full);
  }
  return files;
}

test('repository does not expose known credential formats', async () => {
  const failures = [];
  for (const file of await sourceFiles()) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (relative === 'tests/security.mjs') continue;
    const content = await readFile(file, 'utf8');
    const checks = [
      [/(?:arya|siti|rizky|dina|bagas|faris|panitia)20\d{2}/i, 'legacy password'],
      [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
      [/(?:sk_live|sk_test)_[a-z0-9_-]{16,}/i, 'provider secret'],
      [/insert\s+into\s+(?:public\.)?ftg_users\s*\([^)]*password/i, 'plaintext password SQL'],
      [/\|\s*(?:password|kata sandi)\s*\|/i, 'credential table']
    ];
    for (const [pattern, label] of checks) if (pattern.test(content)) failures.push(`${relative}: ${label}`);
  }
  assert.deepEqual(failures, [], `Sensitive material found:\n${failures.join('\n')}`);
});

test('critical production security controls remain enabled', async () => {
  const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(vercel.headers[0].headers.map(item => [item.key.toLowerCase(), item.value]));
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['strict-transport-security'], /max-age=63072000/);
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(headers['content-security-policy'], /object-src 'none'/);

  const drive = await readFile(path.join(root, 'api', 'drive.js'), 'utf8');
  assert.match(drive, /verifyUploadSession/);
  assert.match(drive, /x-ftg-upload-token/);
  const google = await readFile(path.join(root, 'api', '_google-login.js'), 'utf8');
  assert.match(google, /rateLimit\(req, res, 'google-login'/);
  assert.match(google, /identity\.aud !== GOOGLE_CLIENT_ID/);
  const admin = await readFile(path.join(root, 'api', 'admin-users.js'), 'utf8');
  assert.match(admin, /requireRole\(req, res, \['admin'\]\)/);
  assert.match(admin, /validPassword\(body\.password\)/);
  const program = await readFile(path.join(root, 'api', 'program.js'), 'utf8');
  assert.match(program, /validImageBytes\(bytes, match\[1\]\)/);
  assert.match(program, /validPassword\(password\)/);
  const cron = await readFile(path.join(root, 'api', 'cron-reminders.js'), 'utf8');
  assert.match(cron, /if \(!expected\) return send\(res, 503/);
});
