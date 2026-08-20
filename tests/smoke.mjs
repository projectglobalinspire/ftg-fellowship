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
  const publicPages = new Set(['index.html', 'login.html', 'panitia.html', 'certificate.html', 'privacy-policy.html', 'terms.html', 'donor-login.html', 'donor-messages.html']);
  for (const file of htmlFiles.filter(file => !publicPages.has(file))) {
    const source = await text(file);
    const donorFlow = file.startsWith('donor-') && /donor\.js\?v=\d+/.test(source);
    assert.ok(/app\.js\?v=\d+/.test(source) || donorFlow || (['attendance.html', 'profile-setup.html'].includes(file) && /auth\.getSession/.test(source)), `${file}: authenticated engine missing`);
  }
});

test('browser bundle contains no fallback passwords or server secrets', async () => {
  const bundle = [await text('app.js'), await text('login.html'), await text('ftg-config.js')].join('\n');
  assert.doesNotMatch(bundle, /USERS_FALLBACK|service_role|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(bundle, /(?:arya|faris|panitia)20\d{2}/i);
});

test('production config has security headers, cron and no public object embedding', async () => {
  const config = JSON.parse(await text('vercel.json'));
  const headers = Object.fromEntries(config.headers[0].headers.map(item => [item.key, item.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.equal(config.crons[0].path, '/api/cron-reminders');
  assert.equal(config.rewrites.length, 3);
  assert.ok(config.rewrites.every(item => item.destination.startsWith('/api/system?resource=')));
});

test('Hobby deployment stays within twelve serverless functions', async () => {
  const apiFiles = (await readdir(path.join(root, 'api'))).filter(file => file.endsWith('.js') && !file.startsWith('_'));
  assert.ok(apiFiles.length <= 12, `Vercel Hobby limit exceeded: ${apiFiles.length} functions`);
  const system = await text('api/system.js');
  for (const resource of ['certificates','errors','health']) assert.match(system, new RegExp(`resource === '${resource}'`));
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

test('Fasil navigation is split, warm and every program action is wired', async () => {
  const app = await text('app.js');
  const css = await text('responsive.css');
  const dashboard = await text('admin-dashboard.html');
  const accounts = await text('admin-akun.html');
  const program = await text('admin-program.html');
  for (const source of [dashboard, accounts, program]) {
    assert.match(source, /href="admin-program\.html"/);
    assert.match(source, /ftgAuthWarm/);
  }
  assert.match(app, /PAGE\.indexOf\('admin-program'\)/);
  assert.doesNotMatch(app, /PAGE\.indexOf\('admin-'\) !== 0/);
  assert.match(app, /PAGE\.indexOf\('admin-dashboard'\) === 0\) initAdminDashboard/);
  assert.match(css, /ftg-auth-warm/);
  for (const id of ['adminGlobalTask','adminCohort','adminSettings','adminRubrics','adminCalendar','adminAttendance','adminCertificates','adminHealth','adminAudit','adminExcel','adminPdf','adminRecordings','adminLearning','adminWorkshopSchedule','adminAssignmentMonitor','adminNotifications','adminAnnouncements','adminDonorPortal','adminInvestorTrust','adminTracks']) {
    assert.match(app, new RegExp(`['"]${id}['"]`), `${id} missing`);
  }
  assert.match(app, /\$\('#adminCohort', sec\)\.addEventListener/);
  assert.match(app, /recordingButton\.addEventListener/);
  assert.match(app, /learningButton\.addEventListener/);
  assert.match(app, /assignmentMonitor\.addEventListener/);
  assert.match(app, /notificationButton\.addEventListener/);
  assert.match(app, /function openBusy\(button,\s*opener\)/);
  assert.ok(app.indexOf('function openBusy(button, opener)') < app.indexOf('function upgradeMenteeCalendar()'), 'busy/error helper must be shared before participant calendar actions');
  assert.match(app, /aria-busy/);
  assert.match(app, /Membuka…/);
  assert.match(app, /Server terlalu lama merespons/);
});

test('application pages use precompiled Tailwind CSS instead of the browser compiler', async () => {
  for (const file of htmlFiles) {
    const html = await text(file);
    if (!/app\.js\?v=(?:87|88)/.test(html)) continue;
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com/, `${file} must not run the Tailwind compiler in production`);
    assert.match(html, /tailwind-static\.css\?v=1/, `${file} must load the precompiled utility stylesheet`);
  }
  assert.ok((await text('tailwind-static.css')).length > 20_000, 'precompiled Tailwind stylesheet is unexpectedly empty');
});

test('Fasil can open and persist a new assignment without a modal race', async () => {
  const app = await text('app.js');
  const monitorStart = app.indexOf('function openAssignmentMonitor()');
  const monitorEnd = app.indexOf('function openAdminNotificationCenter()', monitorStart);
  const monitor = app.slice(monitorStart, monitorEnd);
  const editorStart = app.indexOf('function openAssignmentEditor(task, onSaved, onClosed)');
  const editorEnd = app.indexOf('function mountMentorAssignmentManager()', editorStart);
  const editor = app.slice(editorStart, editorEnd);
  assert.ok(monitorStart > -1 && monitorEnd > monitorStart, 'assignment monitor must exist');
  assert.match(monitor, /assignmentMonitorCreate/);
  assert.match(monitor, /openAssignmentEditor\(null,function\(\)/);
  assert.match(monitor, /shut\(\);\s*setTimeout\(function\(\)\{\s*try\{\s*var editor=openAssignmentEditor/, 'monitor must close before the editor opens to prevent nested modal deadlocks');
  assert.match(monitor, /create\.setAttribute\('aria-busy','true'\)/);
  assert.match(monitor, /if\(!editor\|\|!editor\.overlay\|\|!document\.contains\(editor\.overlay\)\)throw new Error/);
  assert.match(monitor, /Assignment editor failed/);
  assert.ok(editorStart > -1 && editorEnd > editorStart, 'assignment editor must exist');
  assert.match(editor, /return modal\(/, 'assignment editor must return its mounted modal handle');
  assert.match(editor, /availableMentees = menteeIds\(\)\.filter/);
  assert.match(editor, /structuredAssignmentSave\(candidate, true\)\.then/);
  assert.ok(editor.indexOf('structuredAssignmentSave(candidate, true)') < editor.indexOf('close();'), 'server save must finish before closing the editor');
  assert.match(editor, /Assignment save failed/);
});

test('failed and stacked modals cannot leave the dashboard frozen', async () => {
  const app = await text('app.js');
  const modalStart = app.indexOf('var MODAL_STACK = []');
  const modalEnd = app.indexOf('/* ---------- Sidebar navigation wiring ---------- */', modalStart);
  const source = app.slice(modalStart, modalEnd);
  assert.ok(modalStart > -1 && modalEnd > modalStart, 'shared modal manager must exist');
  assert.match(source, /overlay\.style\.zIndex = String\(9998 \+ Math\.max\(0, layerIndex\) \* 4\)/);
  assert.match(source, /overlay\.style\.pointerEvents = active \? 'auto' : 'none'/);
  assert.match(source, /catch \(error\) \{[\s\S]*cleanupLayer\(false\);[\s\S]*ov\.remove\(\);[\s\S]*Modal mount failed/);
  assert.match(source, /if \(!closed && document\.contains\(ov\)\) ov\.classList\.add\('is-visible'\)/);
});

test('secure Fasil account creation has one production handler and visible progress', async () => {
  const app = await text('app.js');
  const api = await text('api/admin-users.js');
  const sharedInitials = app.indexOf('function initialsOf(name)');
  const adminDashboard = app.indexOf('function initAdminDashboard()');
  assert.ok(sharedInitials > -1 && sharedInitials < adminDashboard, 'initialsOf must be a shared helper, not scoped inside the legacy admin dashboard');
  assert.equal((app.match(/function initialsOf\(name\)/g) || []).length, 1, 'initialsOf must have one source of truth');
  assert.match(app, /Produksi memakai[\s\S]*mountSecureAccountAdmin/);
  assert.match(app, /id="suStatus"/);
  assert.match(app, /Membuat akun…/);
  assert.match(app, /button\.disabled=true/);
  assert.match(app, /Password minimal 10 karakter/);
  assert.match(app, /data-secure-account-bound/);
  assert.doesNotMatch(app, /old\.parentNode\.replaceChild\(fresh, old\)/, 'account toolbar buttons must stay mounted while data hydrates');
  assert.match(api, /Email ini sudah terdaftar/);
  assert.match(api, /validPassword\(body\.password\)/);
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
  const deploymentConfig = await text('vercel.json');
  const driveApi = await text('api/drive.js');
  assert.match(config, /driveMode:\s*'central'/);
  assert.match(app, /if \(centralDriveEnabled\(\) && role !== 'mentor'\) return;/);
  assert.match(app, /centralDriveEnabled\(\) \? Promise\.resolve\(\) : driveAuth\(\)/);
  assert.match(config, /projectglobalinspire@gmail\.com/);
  assert.match(app, /centralDriveUpload/);
  assert.match(app, /\/api\/drive/);
  assert.match(driveApi, /GOOGLE_DRIVE_REFRESH_TOKEN/);
  assert.match(driveApi, /uploadType=resumable/);
  assert.match(driveApi, /requireRole\(req, res, \['mentee', 'mentor', 'admin'\]\)/);
  assert.doesNotMatch([app, config].join('\n'), /GOOGLE_DRIVE_CLIENT_SECRET|GOOGLE_DRIVE_REFRESH_TOKEN/);
  assert.match(app, /function putCentralDriveFile/);
  assert.match(app, /fetch\('\/api\/drive\?chunk=1'/);
  assert.match(app, /file\.slice\(start, end\)/);
  assert.match(app, /3 \* 1024 \* 1024/);
  assert.doesNotMatch(app, /new XMLHttpRequest\(\)/);
  assert.match(driveApi, /bodyParser: false/);
  assert.match(driveApi, /hostname !== 'www\.googleapis\.com'/);
  assert.match(driveApi, /Content-Range/);
  assert.match(driveApi, /response\.status === 308/);
  assert.match(app, /function mountMentorGooglePanel/);
  assert.match(app, /Akses Google Mentor/);
  assert.match(app, /centralDriveEnabled\(\) && role !== 'mentor'/);
  assert.match(app, /function backfillMentorDriveAccess/);
  assert.match(driveApi, /body\.action === 'mentor-share'/);
  assert.match(driveApi, /drive\.mentor_share/);
  assert.match(app, /function deleteUploadedDriveFile/);
  assert.match(app, /action: 'delete'/);
  assert.match(app, /Sampah Drive pusat/);
  assert.match(driveApi, /body\.action === 'delete'/);
  assert.match(driveApi, /appProperties\.ftgUserId !== auth\.user\.id/);
  assert.match(driveApi, /JSON\.stringify\(\{ trashed: true \}\)/);
  assert.match(driveApi, /drive\.central_trash/);
  assert.match(deploymentConfig, /https:\/\/\*\.googleapis\.com/);
  assert.match(deploymentConfig, /https:\/\/\*\.googleusercontent\.com/);
  assert.doesNotMatch(app, /Silakan hubungkan Drive lalu coba lagi/);
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
  assert.match(login, /type:\s*'email'/);
  assert.match(googleLogin, /token_hash:\s*tokenHash, type:\s*'email'/);
  assert.match(googleLogin, /refresh_token:\s*verified\.refresh_token/);
  assert.match(login, /auth\.setSession/);
  assert.doesNotMatch(googleLogin, /verify_path/);
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
  assert.match(program, /qa_google_auth/);
  assert.match(program, /token_hash:tokenHash, type:'email'/);
  assert.match(setup, /MENUNGGU VERIFIKASI/);
  assert.match(setup, /Simpan Profil & Kirim Verifikasi/);
  assert.match(adminApi, /'invited', 'active'/);
  assert.match(app, /Verifikasi Pendaftaran Google/);
  assert.match(app, /data-registration-approve/);
  assert.match(app, /data-registration-block/);
  assert.match(app, /login_provider/);
});

test('mentor applicants complete professional screening before Fasil approval', async () => {
  const setup = await text('profile-setup.html');
  const program = await text('api/program.js');
  const adminApi = await text('api/admin-users.js');
  const app = await text('app.js');
  assert.match(setup, /id="mentorFields"/);
  for (const id of ['mentorPhone','mentorLinkedin','mentorJobTitle','mentorCompany','mentorExperience','mentorExpertise','mentorBio','mentorAvailability','mentorMotivation','mentorCommitment']) assert.match(setup, new RegExp(`id="${id}"`));
  assert.match(setup, /name="mentorFormat"/);
  assert.match(setup, /requestedRole === 'mentor'/);
  assert.match(program, /function mentorApplication/);
  assert.match(program, /MENTOR_EXPERTISE/);
  assert.match(program, /registration\.mentor_submitted/);
  assert.match(adminApi, /approve_registration/);
  assert.match(adminApi, /reject_registration/);
  assert.match(adminApi, /registration\.approve/);
  assert.match(adminApi, /Form calon mentor belum lengkap/);
  assert.match(app, /function openMentorApplicationReview/);
  assert.match(app, /data-registration-detail/);
  assert.match(app, /Setujui sebagai Mentor/);
});

test('mentor identity follows the authenticated profile and incomplete mentors are gated', async () => {
  const app = await text('app.js');
  const adminApi = await text('api/admin-users.js');
  const programApi = await text('api/program.js');
  assert.match(app, /mentorFirstName = displayName/);
  assert.match(app, /mentorHeader\.textContent = 'Halo, ' \+ mentorFirstName/);
  assert.match(app, /local\.name !== AUTH\.profile\.full_name/);
  assert.match(app, /Profil server adalah sumber kebenaran/);
  assert.match(app, /prepare_incomplete_mentor/);
  assert.match(adminApi, /mentorProfileRequired/);
  assert.match(adminApi, /profilePatch\.status = 'invited'/);
  assert.match(adminApi, /Lengkapi profil Mentor/);
  assert.match(programApi, /prepareIncompleteMentor/);
  for (const file of ['mentor-dashboard.html', 'mentor-mentee.html', 'mentor-review.html']) {
    assert.match(await text(file), /app\.js\?v=(?:87|88)/);
  }
});

test('all authenticated identities and mentor pairings come from profile data', async () => {
  const app = await text('app.js');
  const adminApi = await text('api/admin-users.js');
  const programApi = await text('api/program.js');
  assert.match(app, /return Number\(s\.menteeId\) \|\| menteeIdByEmail/);
  assert.match(app, /return 0;/);
  assert.match(app, /MENTEES\[number\] = Object\.assign/);
  assert.match(app, /mentorNameForMentee/);
  assert.match(app, /value\.replace\(\/Arya Ramadhan\/g, displayName\)/);
  assert.match(app, /reviewer \? reviewer\.full_name : 'Mentor'/);
  assert.match(adminApi, /async function nextMenteeNumber/);
  assert.match(adminApi, /patch\.mentee_number = await nextMenteeNumber/);
  assert.match(adminApi, /profilePatch\.mentee_number = null/);
  assert.match(adminApi, /profilePatch\.mentee_number = currentProfile\.mentee_number \|\| await nextMenteeNumber/);
  assert.match(programApi, /async function profileContext/);
  assert.match(programApi, /action === 'profile_context'/);
  assert.match(app, /action:'profile_context'/);
  for (const file of ['mentee-dashboard.html','assignment-submission.html','design-thinking-module.html','progress-tracker.html','jurnal.html','mentor-feedback.html','workshop-library.html','kpi-leaderboard.html']) {
    assert.match(await text(file), /app\.js\?v=(?:87|88)/);
  }
});

test('dashboards do not flicker and users can edit profile while Fasil can delete safely', async () => {
  const app = await text('app.js');
  const css = await text('responsive.css');
  const program = await text('api/program.js');
  const adminUsers = await text('api/admin-users.js');
  assert.doesNotMatch(app, /Update baru dari ' \+ who \+ ' — memuat ulang/);
  assert.match(app, /Data terbaru dari ' \+ who \+ ' sudah disinkronkan/);
  assert.match(app, /classList\.add\('ftg-auth-ready'\)/);
  assert.match(css, /html:not\(\.ftg-auth-ready\):not\(\.ftg-auth-warm\)/);
  assert.match(app, /function openProfileEditor/);
  assert.match(app, /function mountProfileControl/);
  assert.match(app, /firstLabel\.parentNode\.insertBefore\(photoRow,firstLabel\)/);
  assert.match(app, /nameInput\.insertAdjacentElement\('afterend',bioWrap\)/);
  assert.doesNotMatch(app, /box\.insertBefore\(photoRow,firstLabel\)/);
  assert.match(css, /\.ftg-language-control\{[^}]*height:44px[^}]*padding:0 8px/);
  assert.match(css, /\.ftg-language-control select\{[^}]*min-height:32px!important/);
  assert.match(css, /\.ftg-profile-control\.ftg-profile-photo\{[^}]*padding:4px!important/);
  assert.match(program, /async function updateOwnProfile/);
  assert.match(program, /action === 'profile_update'/);
  assert.match(program, /action === 'profile_password'/);
  assert.match(program, /async function uploadProfilePhoto/);
  assert.match(program, /async function deleteProfilePhoto/);
  assert.match(app, /function resizeProfilePhoto/);
  assert.match(app, /Bio singkat/);
  assert.match(app, /Tambahkan password login/);
  assert.match(app, /function startProfileRealtime/);
  assert.match(app, /ftg:profiles-changed/);
  assert.match(app, /table:'profiles'/);
  assert.match(app, /setInterval\(pollProfiles,3000\)/);
  assert.match(program, /profile_bio:bio/);
  assert.match(program, /avatar_url:avatarUrl/);
  assert.match(app, /Hapus User Permanen/);
  assert.match(app, /method:'DELETE'/);
  assert.match(adminUsers, /Fasil tidak dapat menghapus akunnya sendiri/);
  assert.match(adminUsers, /Fasil aktif terakhir tidak boleh dihapus/);
  assert.match(adminUsers, /detach\('audit_logs','actor_id'\)/);
  assert.match(adminUsers, /mentor_sessions\?or=/);
});

test('Fasil approval labels and one-week mentor deadlines are complete', async () => {
  const app = await text('app.js');
  const login = await text('login.html');
  const admin = await text('admin-dashboard.html');
  assert.match(login, /label: 'FASIL'/);
  assert.match(admin, /Dashboard Fasil/);
  assert.match(app, /defaultAssignmentDeadline\(7\)/);
  assert.match(app, /type="datetime-local"/);
  assert.match(app, /data-deadline-days="3"/);
  assert.match(app, /data-deadline-days="7"/);
  assert.match(app, /data-deadline-days="14"/);
  assert.match(app, /classList\.toggle\('is-active', active\)/);
  assert.match(app, /setAttribute\('aria-pressed', active \? 'true' : 'false'\)/);
  assert.match(app, /mentorTaskDeadline[\s\S]*addEventListener\('input'/);
  assert.match(app, /Deadline harus berada setelah waktu sekarang/);
  assert.match(app, /deadlineDate\(task\.deadline\)\.toISOString\(\)/);
});

test('login shows progress animation and never looks frozen', async () => {
  const login = await text('login.html');
  assert.match(login, /id="authLoading"/);
  assert.match(login, /@keyframes authSpin/);
  assert.match(login, /function showAuthLoading/);
  assert.match(login, /Menghubungkan Google/);
  assert.match(login, /Memeriksa email dan password/);
  assert.match(login, /function finishAuthLoading/);
  assert.match(login, /Proses login terlalu lama/);
});

test('sidebar footer status never overlaps logout or content', async () => {
  const app = await text('app.js');
  const responsive = await text('responsive.css');
  assert.match(responsive, /aside\[data-design-id\]\s*>\s*nav[\s\S]*overflow-y:\s*auto/);
  assert.match(responsive, /height:\s*100dvh\s*!important/);
  assert.match(responsive, /\.ftg-conn\s*\{[\s\S]*position:\s*static/);
  assert.match(app, /if \(aside\) aside\.appendChild\(b\)/);
  assert.doesNotMatch(app, /b\.style\.cssText = 'position:fixed;bottom:10px;left:12px/);
});

test('all dashboard shells follow the real viewport without a 900px scroll tail', async () => {
  const responsive = await text('responsive.css');
  for (const page of htmlFiles) {
    const html = await text(page);
    assert.doesNotMatch(html, /min-h-\[900px\]/, `${page} still forces a 900px canvas`);
    if (/main\s+data-design-id=/.test(html)) {
      assert.match(html, /responsive\.css\?v=(?:79|80|81)/, `${page} must load the no-scroll-tail shell`);
    }
  }
  assert.match(responsive, /body:has\(main\[data-design-id\]\)[\s\S]*min-height:\s*100dvh/);
  assert.match(responsive, /main\[data-design-id\][\s\S]*min-height:\s*100dvh\s*!important/);
});

test('header notification and profile controls stay grouped on the right', async () => {
  const app = await text('app.js');
  const responsive = await text('responsive.css');
  assert.match(app, /querySelector\('\[data-design-id\*="notif"\], \.fa-bell'\)/);
  assert.match(app, /actions\.classList\.add\('ftg-header-actions'\)/);
  assert.match(app, /actions\.insertBefore\(b,actions\.firstChild\)/);
  assert.match(responsive, /\.ftg-header-actions\s*\{[^}]*margin-left:\s*auto/);
  assert.match(responsive, /\.ftg-header-actions \.ftg-global-search\s*\{[^}]*margin-left:\s*0/);
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

test('mentor assignments open in the same rich inline mentee workspace', async () => {
  const app = await text('app.js');
  const responsive = await text('responsive.css');
  assert.match(app, /function mountInlineTaskSubmission/);
  assert.match(app, /ftg-inline-task-workspace/);
  assert.match(app, /TUGAS DARI MENTOR/);
  assert.match(app, /byId\('assignment-brief'\), byId\('submission-form'\)/);
  assert.match(app, /view\.box\.classList\.add\('ftg-inline-task-box'\)/);
  assert.match(app, /workspace\.scrollIntoView/);
  assert.match(responsive, /\.ftg-inline-task-toolbar/);
  assert.match(responsive, /\.ftg-inline-task-box/);
});

test('real notifications, Zoho email, calendar, reports and health monitoring have server endpoints', async () => {
  const email = await text('api/_email.js');
  const notifications = await text('api/notifications.js');
  const reminders = await text('api/cron-reminders.js');
  const calendar = await text('api/calendar.js');
  const reports = await text('api/reports.js');
  const app = await text('app.js');
  assert.match(email, /smtppro\.zoho\.com/);
  assert.match(email, /ZOHO_SMTP_APP_PASSWORD/);
  assert.match(email, /EMAIL_STYLES/);
  assert.match(email, /deadline_3/);
  assert.match(email, /PERMINTAAN REVISI/);
  assert.match(email, /SERTIFIKAT TERSEDIA/);
  assert.match(email, /role="presentation"/);
  assert.match(email, /disableFileAccess: true/);
  assert.match(email, /minVersion: 'TLSv1\.2'/);
  assert.match(notifications, /auth\.profile\.role !== 'admin'/);
  assert.match(notifications, /requestedRecipient/);
  assert.match(notifications, /test_type/);
  assert.match(notifications, /Tes notifikasi email berhasil/);
  assert.match(reminders, /reminder_days: \[3, 1, 0\]/);
  assert.match(reminders, /Tugas terlambat/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(app, /function openMenteeCalendar/);
  assert.match(app, /function googleCalendarUrl/);
  assert.match(app, /dataset\.menteeCalendar = '1'/);
  assert.match(app, /function openEventManager/);
  assert.match(app, /data-event-edit/);
  assert.match(app, /action:'event_delete'/);
  assert.match(reports, /application\/vnd\.ms-excel/);
  assert.match(app, /Kesehatan Program/);
  assert.match(app, /Zoho aktif/);
  assert.match(app, /Audit Log/);
});

test('Fasil calendar supports create, edit and delete with a responsive in-app mentee view', async () => {
  const app = await text('app.js');
  const api = await text('api/operations.js');
  const css = await text('responsive.css');
  assert.match(app, /#adminCalendar[\s\S]*openEventManager/);
  assert.match(app, /id:\$\('#eventId'/);
  assert.match(app, /Simpan Perubahan/);
  assert.match(api, /action === 'event_delete'/);
  assert.match(api, /event\.delete/);
  assert.match(api, /Waktu selesai harus setelah waktu mulai/);
  assert.match(css, /\.ftg-calendar-view-list article/);
  assert.match(app, /href="#" data-mentee-calendar/, 'mentee calendar trigger must exist before enhancement runs');
  assert.match(css, /\.ftg-event-manager-layout/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*\.ftg-event-manager-layout\{grid-template-columns:1fr\}/);
});

test('Fasil can manually send synchronized email and dashboard notifications', async () => {
  const app = await text('app.js');
  const api = await text('api/notifications.js');
  const css = await text('responsive.css');
  assert.match(app, /Email & Notifikasi/);
  assert.match(app, /function openAdminNotificationCenter/);
  assert.match(app, /action:'manual_send'/);
  assert.match(app, /Email \+ notifikasi dashboard/);
  assert.match(app, /Riwayat Pengiriman Terbaru/);
  assert.match(app, /mailAdminLoading[\s\S]{0,120}loading\.remove\(\)/, 'completed recipient loading state must be removed');
  assert.match(api, /async function manualSend/);
  assert.match(api, /notification\.manual_send/);
  assert.match(api, /Hanya Fasil yang dapat mengirim pesan manual/);
  assert.match(api, /email_outbox\?select=/);
  assert.match(css, /\.ftg-mail-compose/);
  assert.match(css, /\.ftg-mail-loading\[hidden\]\{display:none!important\}/, 'hidden mail loader must not override the workspace');
});

test('registration email is required, verified, synchronized and visible to Fasil', async () => {
  const setup = await text('profile-setup.html');
  const program = await text('api/program.js');
  const adminApi = await text('api/admin-users.js');
  const notifications = await text('api/notifications.js');
  const app = await text('app.js');
  assert.match(setup, /Email login & notifikasi \*/);
  assert.match(setup, /id="googleEmail"[^>]*type="email"[^>]*required[^>]*readonly/);
  assert.match(setup, /email:notificationEmail/);
  assert.match(program, /Email notifikasi harus sama dengan email login yang telah terverifikasi/);
  assert.match(program, /Profil pendaftaran berhasil dikirim/);
  assert.match(program, /notification_preferences:\{ in_app:true, email:true/);
  assert.match(adminApi, /profilePatch\.email = normalizedEmail/);
  assert.match(notifications, /email_valid:validEmail/);
  assert.match(app, /Semua Email Terdaftar/);
  assert.match(app, /Email akun menjadi tujuan otomatis notifikasi/);
  assert.match(app, /Direktori Email/);
});

test('LMS recordings are playable for mentees and mentors but managed only by Fasil', async () => {
  const app = await text('app.js');
  const operations = await text('api/operations.js');
  const responsive = await text('responsive.css');
  const vercel = await text('vercel.json');
  assert.match(app, /function mountRecordingLibrary/);
  assert.match(app, /youtube-nocookie\.com\/embed/);
  assert.match(app, /function fastLoad/);
  assert.match(app, /id="ftgLmsSearch"/);
  assert.match(app, /Pusat rekaman mentoring, workshop/);
  assert.match(app, /featured-mentoring-1/);
  assert.match(app, /loading="eager"/);
  assert.match(app, /AbortController/);
  assert.match(app, /\[50,500,1500,3000\]/);
  assert.match(app, /document\.getElementById\('ftgLmsBody'\)/);
  assert.match(app, /document\.getElementById\('recordingForm'\)/);
  assert.doesNotMatch(app, /byId\('(ftgLms|recording)/);
  assert.doesNotMatch(app, /serviceWorker\.register\(/);
  assert.match(app, /getRegistrations\(\)/);
  const workshop = await text('workshop-library.html');
  assert.match(workshop, /ftg-lms-cache-repair-v45/);
  assert.doesNotMatch(workshop, /classList\.contains\('ftg-lms-loading'\)/);
  assert.match(responsive, /Professional LMS composition/);
  assert.match(responsive, /SEDANG DIPUTAR/);
  assert.match(app, /LMS & Rekaman/);
  assert.match(app, /function openRecordingManager/);
  assert.match(app, /recording_save/);
  assert.match(app, /recording_delete/);
  assert.match(app, /workshop-library[\s\S]*mentee\|mentor|mentee\|mentor[\s\S]*workshop-library/);
  assert.match(operations, /resource === 'recordings'/);
  assert.match(operations, /const youtubeId/);
  assert.match(operations, /action === 'recording_save'/);
  assert.match(operations, /action === 'recording_delete'/);
  assert.match(operations, /auth\.profile\.role !== 'admin'/);
  assert.match(responsive, /\.ftg-lms-frame/);
  assert.match(responsive, /aspect-ratio:16\/9/);
  assert.match(vercel, /frame-src[^\"]*youtube-nocookie\.com/);
});

test('Design Thinking is server-backed, weekly controlled, versioned and monitored by role', async () => {
  const app = await text('app.js');
  const api = await text('api/_learning.js');
  const operations = await text('api/operations.js');
  assert.match(app, /api\/operations\?resource=learning/);
  assert.match(app, /action:'progress_save'/);
  assert.match(app, /Kurikulum & Canvas/);
  assert.match(app, /Tugas & Pengumpulan/);
  assert.match(api, /week\.mode === 'open'/);
  assert.match(api, /week\.mode === 'closed'/);
  assert.match(api, /week\.number <= activeWeek/);
  assert.match(api, /auth\.profile\.role !== 'admin'/);
  assert.match(api, /auth\.profile\.role !== 'mentee'/);
  assert.match(api, /submission_versions/);
  assert.match(api, /assignment_targets/);
  assert.match(api, /audit_logs/);
  assert.match(operations, /learningHandler/);
});

test('workshop dates are centrally editable by Fasil and synchronized to every LMS role', async () => {
  const app = await text('app.js');
  const api = await text('api/program.js');
  const css = await text('responsive.css');
  assert.match(api, /function defaultWorkshopSchedule/);
  assert.match(api, /workshop_schedule_get/);
  assert.match(api, /workshop_schedule_save/);
  assert.match(api, /workshop\.schedule_update/);
  assert.match(app, /function loadWorkshopSchedule/);
  assert.match(app, /function openWorkshopScheduleManager/);
  assert.match(app, /adminWorkshopSchedule/);
  assert.match(app, /Simpan & Publikasikan/);
  assert.match(app, /Jadwal workshop tersimpan dan tersinkron ke LMS/);
  assert.match(css, /\.ftg-workshop-manager/);
  assert.match(await text('workshop-library.html'), /app\.js\?v=(?:87|88)/);
  assert.match(await text('admin-program.html'), /app\.js\?v=88/);
});

test('public impact pages are bilingual, multi-program, privacy-safe and managed by Fasil', async () => {
  const app = await text('app.js');
  const donor = await text('donor.js');
  const api = await text('api/donor.js');
  const css = await text('donor.css');
  const programApi = await text('api/program.js');
  assert.match(await text('admin-program.html'), /app\.js\?v=88/);
  assert.match(await text('admin-program.html'), /responsive\.css\?v=80/);
  assert.match(await text('admin-dashboard.html'), /app\.js\?v=(?:87|88)/);
  for (const page of ['donor-programs.html','donor-program.html','donor-dashboard.html','donor-sroi.html','donor-csr.html','donor-portfolio.html','donor-esg.html','donor-dataroom.html']) {
    assert.match(await text(page), /donor\.js\?v=8/);
    assert.match(await text(page), /donor\.css\?v=8/);
  }
  assert.match(donor, /ftgDonorLang/);
  assert.match(donor, /fetch\('\/api\/donor'/);
  assert.match(donor, /donor-programs\.html/);
  assert.match(donor, /sessionStorage/);
  assert.match(donor, /function routeTo/);
  assert.match(donor, /Tersinkron LMS/);
  assert.match(donor, /Laporan finansial · Draft/);
  assert.match(donor, /function financeBadge/);
  assert.doesNotMatch(donor, /action:'rating'/);
  assert.doesNotMatch(donor, /action:'message'/);
  assert.match(api, /createHmac\('sha256'/);
  assert.match(api, /requireRole\(req,res,\['admin'\]\)/);
  assert.match(api, /admin_program_save/);
  assert.match(api, /source === 'ftg'/);
  assert.match(api, /public_consent/);
  assert.match(api, /public:true/);
  assert.match(api, /assignment_targets/);
  assert.match(api, /attendance_records/);
  assert.match(api, /activity_trend/);
  assert.match(api, /review_turnaround_hours/);
  assert.match(api, /status:\['draft','verified','audited'\]/);
  assert.match(api, /ensureTrustFields/);
  assert.match(api, /liveTargets/);
  assert.match(api, /scenario_low/);
  assert.match(api, /registration_number/);
  assert.match(api, /evidence_url/);
  assert.match(api, /participant-\$\{index\+1\}/);
  assert.doesNotMatch(api, /code_hash:\s*codeHash\(['"][^'"]+['"]\)/);
  assert.match(app, /function openDonorPortalManager/);
  assert.match(app, /Publikasi Program & Dampak/);
  assert.match(app, /Status laporan finansial/);
  assert.match(app, /function openInvestorTrustManager/);
  assert.match(app, /Investor Trust Center/);
  assert.match(app, /cachedApiRequest\('donor-admin','\/api\/donor\?admin=1'/);
  assert.match(css, /\.donor-shell/);
  assert.match(css, /\.public-program-hero/);
  assert.match(css, /\.impact-line-chart/);
  assert.match(donor, /function activityChart/);
  assert.match(donor, /function targetDashboard/);
  assert.match(donor, /function dataRoom/);
  assert.match(donor, /function sroiAssurance/);
  assert.match(donor, /function openMetricDetail/);
  assert.match(donor, /setInterval\(refreshLive/);
  assert.match(programApi, /currentFlags/);
});

test('track pairing, admin-completed mentors and mentee announcements are server backed', async () => {
  const app = await text('app.js');
  const program = await text('api/program.js');
  const adminUsers = await text('api/admin-users.js');
  const setup = await text('profile-setup.html');
  const css = await text('responsive.css');
  assert.match(setup, /id="mentorPath"/);
  assert.match(setup, /action:'tracks_list'/);
  assert.match(setup, /fetchTracks/);
  assert.match(adminUsers, /admin_mentor_profile/);
  assert.match(adminUsers, /created_by_fasil:true/);
  assert.match(adminUsers, /pairUnassignedByTrack/);
  assert.match(program, /pairings_data/);
  assert.match(program, /pairings_save/);
  assert.match(program, /pairings_auto/);
  assert.match(program, /tracks_list/);
  assert.match(program, /tracks_save/);
  assert.match(program, /program_tracks/);
  assert.match(program, /Track .* masih digunakan peserta atau mentor/);
  assert.match(program, /mentor\.path!==mentee\.path/);
  assert.match(app, /function openCohortManager/);
  assert.match(app, /function openTrackManager/);
  assert.match(app, /id='adminTracks'/);
  assert.match(app, /trackOptions\(profile\.path,true\)/);
  assert.match(app, /data-pairing-mentee/);
  assert.match(app, /function adminMentorProfileModal/);
  assert.match(app, /className='ftg-account-delete'/);
  assert.match(program, /announcements_list/);
  assert.match(program, /announcement_save/);
  assert.match(program, /announcement_delete/);
  assert.match(program, /display_mode/);
  assert.match(program, /Jadwal tayang membutuhkan waktu mulai dan selesai/);
  assert.match(program, /cleanAnnouncement\(source,existing\).*send\(res,400/);
  assert.match(app, /function openAnnouncementManager/);
  assert.match(app, /id="announcementPermanent"/);
  assert.match(app, /Simpan & Tampilkan ke Mentee/);
  assert.match(app, /Waktu selesai harus setelah waktu mulai/);
  assert.match(app, /function mountMenteeAnnouncementBoard/);
  assert.match(app, /PAGE\.indexOf\('mentee-dashboard'\) !== 0 \|\| myRole\(\) !== 'mentee'/);
  assert.match(app, /id='adminAnnouncements'/);
  assert.match(css, /\.ftg-mentee-announcement/);
  assert.match(css, /Mentee announcement: calm editorial card with a stable navigation rail/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 220px/);
  assert.match(css, /\.ftg-mentee-announcement-poster img\{width:100%;height:100%;object-fit:contain/);
  assert.match(css, /\.ftg-mentee-announcement\{grid-template-columns:1fr;min-height:0\}/);
  assert.match(css, /#announcementForm\{display:flex/);
  assert.match(css, /\.ftg-announcement-actions\{order:-3;position:sticky/);
  assert.match(css, /\.ftg-track-manager/);
});

test('Fasil dialogs keep controls separated, closable and responsive', async () => {
  const app = await text('app.js');
  const css = await text('responsive.css');
  assert.match(app, /box\.setAttribute\('role', 'dialog'\)/);
  assert.match(app, /box\.setAttribute\('aria-modal', 'true'\)/);
  assert.match(app, /toolbar\.appendChild\(modalClose\)/);
  assert.match(app, /document\.addEventListener\('keydown', onKeydown, true\)/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(app, /event\.key !== 'Tab'/);
  assert.match(app, /class="ftg-track-actions"/);
  assert.match(app, /classList\.add\('ftg-modal-box-wide','ftg-track-manager-dialog'\)/);
  assert.match(css, /\.ftg-modal-toolbar\{/);
  assert.match(css, /\.ftg-modal-close\{\s*position:static!important/);
  assert.match(css, /\.ftg-track-manager-dialog\{width:min\(820px/);
  assert.match(css, /\.ftg-track-list article\{grid-template-columns:44px minmax\(0,1fr\) 88px!important/);
  assert.match(css, /\.ftg-track-actions\{grid-column:1\/-1/);
  assert.match(app, /id="assignmentMonitorCreate"/);
  assert.match(app, /class="ftg-assignment-monitor-head"/);
  assert.match(css, /\.ftg-assignment-monitor-head\{display:flex/);
  assert.match(css, /\.ftg-assignment-monitor-head>\.ftg-suite-primary\{flex:none/);
  assert.doesNotMatch(css, /\.ftg-monitor-create\{[^}]*margin-top:\s*-/);
});

test('mentee announcements rotate every ten seconds with accessible controls', async () => {
  const app = await text('app.js');
  const css = await text('responsive.css');
  assert.match(app, /timer=setTimeout\(function\(\)\{go\(1,true\);\},10000\)/);
  assert.match(app, /data-announcement-prev/);
  assert.match(app, /data-announcement-next/);
  assert.match(app, /Berpindah otomatis setiap 10 detik/);
  assert.match(app, /event\.key==='ArrowRight'/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /ftg-announcement-editor-heading/);
  assert.match(css, /@keyframes ftgAnnouncementTimer/);
  assert.match(css, /\.ftg-announcement-controls/);
  assert.match(css, /\.ftg-announcement-progress i/);
  assert.match(css, /Professional announcement manager and 10-second mentee carousel/);
});

test('slow Fasil screens use parallel data, deduped cache and visible loading feedback', async () => {
  const app = await text('app.js');
  const adminUsers = await text('api/admin-users.js');
  const program = await text('api/program.js');
  const css = await text('responsive.css');
  assert.match(adminUsers, /Promise\.all\(\[/);
  assert.match(adminUsers, /const authById = new Map/);
  assert.match(app, /function cachedApiRequest/);
  assert.match(app, /API_INFLIGHT\[key\]/);
  assert.match(app, /Date\.now\(\) - inflight\.at < 6000/);
  assert.match(app, /API_INFLIGHT\[key\] = \{ promise:request, at:Date\.now\(\) \}/);
  assert.match(app, /requestMethod==='GET'\?12000:30000/);
  assert.match(app, /Object\.assign\(\{timeout:12000\},options\|\|\{\}\)/);
  assert.match(app, /timeout:8000/);
  assert.match(app, /readSessionCache\('ftg-admin-users'/);
  assert.match(app, /function accountLoadingSkeleton/);
  assert.match(app, /function operationLoader/);
  assert.match(app, /ACTIVE_OPERATION_LOADER/);
  assert.match(app, /previous\._ftgClose/);
  assert.match(app, /ftg-operation-dismiss/);
  assert.match(app, /Proses tetap berjalan di latar belakang/);
  assert.match(app, /USER_ACTION_CONTEXT/);
  assert.match(app, /showActionLoader=options\.loading!==false&&Date\.now\(\)-USER_ACTION_CONTEXT\.at<2200/);
  assert.match(app, /requestMethod==='GET'\?'Memuat data…'/);
  assert.match(app, /actionButton\.classList\.add\('ftg-action-pending'\)/);
  assert.match(app, /actionButton\.classList\.remove\('ftg-action-pending'\)/);
  assert.match(app, /document\.addEventListener\('submit'/);
  assert.match(app, /window\.addEventListener\('unhandledrejection'/);
  assert.match(app, /function visibleActionError/);
  assert.match(app, /Koneksi ke server terputus/);
  assert.match(app, /LAST_TOAST/);
  assert.match(app, /Menyimpan perubahan/);
  assert.match(app, /Tidak ada perubahan yang perlu disimpan/);
  assert.match(adminUsers, /unchanged:true/);
  assert.match(app, /document\.addEventListener\('click'.*USER_ACTION_CONTEXT/);
  assert.match(app, /openBusy\(this,openCohortManager\)/);
  assert.match(app, /cachedApiRequest\('program-pairings'/);
  assert.match(app, /cachedApiRequest\('program-tracks'/);
  assert.match(app, /function warmAdminControlCenter/);
  assert.match(app, /cachedApiRequest\('admin-operations'/);
  assert.match(app, /cachedApiRequest\('operations-events'/);
  assert.match(app, /cachedApiRequest\('operations-recordings'/);
  assert.match(app, /cachedApiRequest\('operations-learning'/);
  assert.match(app, /Menyimpan pengaturan…/);
  assert.match(app, /Menyimpan rubrik…/);
  assert.match(app, /Membuat QR…/);
  assert.match(app, /button\.disabled=true/);
  assert.doesNotMatch(app, /toast\('Pengaturan program tersimpan','✅'\);location\.reload\(\)/);
  assert.match(app, /Object\.assign\(\{\},rawFlags,featureFlags\)/);
  assert.match(program, /feature_flags: Object\.assign\(\{\}, currentFlags,/);
  assert.match(css, /\.ftg-operation-loading/);
  assert.match(css, /\.ftg-operation-loading\.is-slow \.ftg-operation-dismiss/);
  assert.match(css, /\.ftg-action-error/);
  assert.match(css, /\.ftg-action-pending/);
  assert.match(css, /\.ftg-account-skeleton/);
});

test('dashboards are bilingual and Fasil operations have real data flows', async () => {
  const app = await text('app.js');
  const operations = await text('api/operations.js');
  const program = await text('api/program.js');
  const css = await text('responsive.css');
  assert.match(app, /function mountLanguageControl/);
  assert.match(app, /localStorage\.getItem\('ftg-language'\)/);
  assert.match(app, /function applyLanguage/);
  assert.match(app, /Object\.assign\(LANGUAGE_EN/);
  assert.match(app, /LANGUAGE_PATTERNS/);
  assert.match(app, /LANGUAGE_DATE_WORDS/);
  assert.match(app, /LANGUAGE_RENDERED=new WeakMap/);
  assert.match(app, /input,textarea,select,option,button/);
  assert.match(app, /window\.FTG_I18N=/);
  assert.match(app, /addedNodes\.forEach/);
  assert.match(css, /\.ftg-language-control/);
  assert.match(app, /function initRealLeaderboard/);
  assert.match(operations, /function leaderboardData/);
  assert.match(operations, /resource === 'leaderboard'/);
  assert.match(operations, /Tugas & target.*Pengumpulan.*Review mentor.*Presensi & progres canvas/);
  assert.match(app, /assignmentMonitorCreate/);
  assert.match(app, /openAssignmentEditor\(null/);
  assert.match(app, /eventStart.*nextHour/);
  assert.match(app, /function mountUpcomingEvents/);
  assert.match(program, /missing_by_track/);
  assert.match(app, /Maksimal 5 keahlian/);
  assert.match(app, /refreshSession/);
});

test('dashboard motion is purposeful, interruptible and accessible', async () => {
  const app = await text('app.js');
  const css = await text('responsive.css');
  assert.match(css, /--ftg-motion-fast:140ms/);
  assert.match(css, /--ftg-ease-out:cubic-bezier\(\.23,1,\.32,1\)/);
  assert.match(css, /\.ftg-modal-ov\.is-visible/);
  assert.match(css, /\.ftg-modal-ov\.is-closing/);
  assert.match(css, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /button:not\(:disabled\):active[\s\S]*scale\(\.97\)/);
  assert.match(css, /transition:transform var\(--ftg-motion-panel\)/);
  assert.doesNotMatch(css, /transition\s*:\s*all\b/);
  assert.doesNotMatch(css, /transition\s*:\s*(?:width|height|margin|padding)/);
  assert.match(app, /ov\.classList\.add\('is-closing'\)/);
  assert.match(app, /ov\.classList\.add\('is-visible'\)/);
  assert.match(app, /bar\.style\.transform = 'scaleX\(0\)'/);
  assert.doesNotMatch(app, /document\.body\.classList\.add\('ftg-anim'\)/);
});

test('dashboard sidebars keep icons and labels on one stable alignment rail', async () => {
  const css = await text('responsive.css');
  assert.match(css, /aside\[data-design-id\]\s*>\s*nav\s*>\s*a\s*\{[\s\S]*width:\s*100%[\s\S]*justify-content:\s*flex-start\s*!important/);
  assert.match(css, /aside\[data-design-id\]\s*>\s*nav\s*>\s*a\s*>\s*i:first-child\s*\{[\s\S]*flex:\s*0\s+0\s+20px[\s\S]*width:\s*20px\s*!important/);
  assert.match(css, /aside\[data-design-id\]\s*>\s*nav\s*>\s*a\s*>\s*\.ml-auto\s*\{\s*margin-left:\s*auto\s*!important/);
});
