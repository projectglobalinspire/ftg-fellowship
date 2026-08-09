import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const text = file => readFile(path.join(root, file), 'utf8');
const htmlFiles = (await readdir(root)).filter(file => file.endsWith('.html'));

test('all application pages have responsive metadata and valid local links', async () => {
  for (const file of htmlFiles) {
    const source = await text(file);
    assert.match(source, /<meta name="viewport"/i, `${file}: viewport missing`);
    for (const match of source.matchAll(/href="([^"#?]+\.html)(?:[?#][^"]*)?"/gi)) {
      assert.ok(existsSync(path.join(root, match[1])), `${file}: broken link ${match[1]}`);
    }
  }
});

test('protected pages use the shared authenticated application engine', async () => {
  const publicPages = new Set(['index.html', 'login.html', 'panitia.html']);
  for (const file of htmlFiles.filter(file => !publicPages.has(file))) {
    const source = await text(file);
    assert.match(source, /app\.js\?v=\d+/, `${file}: shared engine missing`);
  }
});

test('browser bundle contains no fallback passwords or server secrets', async () => {
  const bundle = [await text('app.js'), await text('login.html'), await text('ftg-config.js')].join('\n');
  assert.doesNotMatch(bundle, /USERS_FALLBACK|service_role|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(bundle, /arya2026|faris2026|panitia2026/);
});

test('production config has security headers, cron and no public object embedding', async () => {
  const config = JSON.parse(await text('vercel.json'));
  const headers = Object.fromEntries(config.headers[0].headers.map(item => [item.key, item.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.equal(config.crons[0].path, '/api/cron-reminders');
});

test('database migrations include RLS and legacy access hardening', async () => {
  const schema = await text('supabase/migrations/20260809_production.sql');
  const hardening = await text('supabase/migrations/20260809_security_hardening.sql');
  assert.match(schema, /alter table public\.profiles enable row level security/i);
  assert.match(hardening, /revoke all on table public\.ftg_users from public, anon, authenticated/i);
  assert.match(hardening, /my_mentor_google_email/i);
});

test('inline page scripts parse without syntax errors', async () => {
  for (const file of htmlFiles) {
    const source = await text(file);
    for (const match of source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      assert.doesNotThrow(() => new Function(match[1]), `${file}: invalid inline script`);
    }
  }
});

test('first-login welcome is personalized for mentees and mentors', async () => {
  const source = await text('app.js');
  assert.match(source, /Mulai Perjalanan Saya/);
  assert.match(source, /Mulai Mendampingi Mentee/);
  assert.match(source, /ftgWelcomeSeen:/);
  assert.match(source, /onboarding_completed:\s*true/);
});

test('participant discipline requires three absences and admin confirmation', async () => {
  const app = await text('app.js');
  const api = await text('api/admin-users.js');
  const migration = await text('supabase/migrations/20260809_participant_discipline.sql');
  assert.match(app, /Disiplin & Status Peserta/);
  assert.match(app, /Tetapkan Gugur/);
  assert.match(api, /currentAbsences < 3/);
  assert.match(api, /body\.confirmation !== 'GUGUR'/);
  assert.match(migration, /absence_count integer not null default 0/);
  assert.match(migration, /'dropped'/);
  assert.doesNotMatch(migration, /grant update/i);
});
