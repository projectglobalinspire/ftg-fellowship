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

test('protected pages use the shared engine or a dedicated authenticated flow', async () => {
  const publicPages = new Set(['index.html', 'login.html', 'panitia.html', 'certificate.html']);
  for (const file of htmlFiles.filter(file => !publicPages.has(file))) {
    const source = await text(file);
    assert.ok(/app\.js\?v=\d+/.test(source) || (['attendance.html', 'profile-setup.html'].includes(file) && /auth\.getSession/.test(source)), `${file}: authenticated engine missing`);
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

test('mentee dashboard primary navigation never relies on dummy links', async () => {
  const source = await text('mentee-dashboard.html');
  const labels = ['Lanjut Belajar', 'Buka Canvas', 'Mulai', 'Lihat semua badge'];
  for (const label of labels) {
    const anchor = [...source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .find(match => match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes(label));
    assert.ok(anchor, `mentee-dashboard.html: ${label} missing`);
    assert.doesNotMatch(anchor[1], /href="#"/, `mentee-dashboard.html: ${label} still uses a dummy link`);
  }
});

test('every designed button is connected to application or page code', async () => {
  const app = await text('app.js');
  for (const file of htmlFiles) {
    const source = await text(file);
    const searchable = `${app}\n${source}`;
    for (const match of source.matchAll(/<button\b[^>]*data-design-id="([^"]+)"[^>]*>/gi)) {
      const raw = match[1].replace(/-[a-z0-9]{6}$/i, '');
      const candidates = [raw, raw.replace(/-\d+$/, '-'), raw.replace(/^(btn-locked-).*$/, '$1')];
      assert.ok(candidates.some(id => searchable.includes(id)), `${file}: ${raw} has no handler`);
    }
  }
});

test('every remaining dummy anchor is an intentional wired action', async () => {
  const wired = [
    /^Dashboard$/, /^Design Thinking$/, /^Workshop Library$/, /^Tugas Saya$/,
    /^Progress Saya$/, /^Feedback Mentor$/, /^Leaderboard$/,
    /^Opening Ceremony$/, /^Closing Ceremony$/, /^Berikan Feedback$/,
    /^Progress Grup$/, /^Kirim Pesan Grup$/, /^Kumpulkan Sekarang$/
  ];
  for (const file of htmlFiles) {
    const source = await text(file);
    for (const match of source.matchAll(/<a\b[^>]*href="#"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      assert.ok(wired.some(pattern => pattern.test(label)), `${file}: unhandled dummy link "${label}"`);
    }
  }
});

test('central Drive uploads keep credentials server-side', async () => {
  const app = await text('app.js');
  const config = await text('ftg-config.js');
  const driveApi = await text('api/drive.js');
  assert.match(config, /driveMode:\s*'central'/);
  assert.match(config, /projectglobalinspire@gmail\.com/);
  assert.match(app, /centralDriveUpload/);
  assert.match(app, /\/api\/drive/);
  assert.match(driveApi, /GOOGLE_DRIVE_REFRESH_TOKEN/);
  assert.match(driveApi, /uploadType=resumable/);
  assert.match(driveApi, /requireRole\(req, res, \['mentee', 'mentor', 'admin'\]\)/);
  assert.doesNotMatch([app, config].join('\n'), /GOOGLE_DRIVE_CLIENT_SECRET|GOOGLE_DRIVE_REFRESH_TOKEN/);
});

test('Google login securely authenticates existing mentee, mentor and admin profiles', async () => {
  const login = await text('login.html');
  const app = await text('app.js');
  const googleLogin = await text('api/_google-login.js');
  const program = await text('api/program.js');
  assert.match(login, /accounts\.google\.com\/gsi\/client/);
  assert.match(login, /googleLoginButton/);
  assert.match(login, /credential:\s*response\.credential/);
  assert.match(googleLogin, /\['mentee', 'mentor', 'admin'\]/);
  assert.match(googleLogin, /google_email=ilike/);
  assert.match(googleLogin, /auth\/v1\/admin\/generate_link/);
  assert.match(googleLogin, /properties\.hashed_token/);
  assert.match(login, /auth\.verifyOtp/);
  assert.doesNotMatch(googleLogin, /return send\(res, 200, \{ action_link/);
  assert.match(googleLogin, /identity\.aud !== GOOGLE_CLIENT_ID/);
  assert.match(program, /body\.action === 'google_login'/);
  assert.match(app, /role === 'admin'.*admin-dashboard/);
});

test('new Google users complete a pending profile and require admin approval', async () => {
  const googleLogin = await text('api/_google-login.js');
  const program = await text('api/program.js');
  const adminApi = await text('api/admin-users.js');
  const setup = await text('profile-setup.html');
  const app = await text('app.js');
  assert.match(googleLogin, /registerGoogleUser/);
  assert.match(googleLogin, /status:\s*'invited'/);
  assert.match(googleLogin, /requested_role/);
  assert.match(program, /complete_google_profile/);
  assert.match(setup, /MENUNGGU VERIFIKASI/);
  assert.match(setup, /Simpan Profil & Kirim Verifikasi/);
  assert.match(adminApi, /'invited', 'active'/);
  assert.match(app, /Verifikasi Pendaftaran Google/);
  assert.match(app, /data-registration-approve/);
  assert.match(app, /data-registration-block/);
  assert.match(app, /login_provider/);
});

test('program suite covers durable revisions, flexible rubrics and operations', async () => {
  const app = await text('app.js');
  const migration = await text('supabase/migrations/20260810_program_suite.sql');
  const operations = await text('api/operations.js');
  assert.match(migration, /create table if not exists public\.review_history/i);
  assert.match(migration, /create table if not exists public\.attendance_records/i);
  assert.match(migration, /create table if not exists public\.certificates/i);
  assert.match(app, /submission_versions/);
  assert.match(app, /Riwayat versi & feedback/);
  assert.match(app, /Template Rubrik Panitia/);
  assert.match(operations, /attendance_create/);
  assert.match(operations, /certificate_issue/);
});

test('real notifications, calendar, reports and health monitoring have server endpoints', async () => {
  const email = await text('api/_email.js');
  const reminders = await text('api/cron-reminders.js');
  const calendar = await text('api/calendar.js');
  const reports = await text('api/reports.js');
  const app = await text('app.js');
  assert.match(email, /api\.resend\.com\/emails/);
  assert.match(reminders, /reminder_days: \[3, 1, 0\]/);
  assert.match(reminders, /Tugas terlambat/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(reports, /application\/vnd\.ms-excel/);
  assert.match(app, /Kesehatan Program/);
  assert.match(app, /Audit Log/);
});
