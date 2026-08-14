const { send, adminFetch, currentUser, requireRole, method, SUPABASE_URL, PUBLISHABLE } = require('./_lib');
const googleLogin = require('./_google-login');
const { deliverEmail } = require('./_email');

function clean(value, max) { return String(value || '').trim().slice(0, max); }
function initials(name) { return clean(name, 120).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
const MENTOR_EXPERTISE = ['Career Development','CV & LinkedIn','Interview Skills','Salary Negotiation','Personal Branding','Entrepreneurship','Business Model','Marketing','Product Development','Finance & Fundraising','Leadership','Mental Health','Tech & Digital','Creative Industry','Social Impact'];
function mentorApplicationComplete(application) { return Boolean(application && application.commitment_confirmed && application.phone && application.job_title && application.company_or_institution && application.years_of_experience && Array.isArray(application.expertise_tags) && application.expertise_tags.length && String(application.bio || '').length >= 40 && application.availability_hours && application.mentoring_format && String(application.motivation || '').length >= 60); }

function safeUrl(value) {
  const input = clean(value, 500);
  if (!input) return '';
  try { const url = new URL(input); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''; } catch (_) { return ''; }
}

function mentorApplication(body) {
  const source = body && body.mentor_application || {};
  const phone = clean(source.phone, 24).replace(/[\s-]/g, '');
  const tags = Array.isArray(source.expertise_tags) ? [...new Set(source.expertise_tags.filter(item => MENTOR_EXPERTISE.includes(item)))].slice(0, 5) : [];
  const data = {
    phone, linkedin_url: safeUrl(source.linkedin_url), job_title: clean(source.job_title, 120),
    company_or_institution: clean(source.company_or_institution, 160), years_of_experience: clean(source.years_of_experience, 12),
    expertise_tags: tags, bio: clean(source.bio, 600), availability_hours: clean(source.availability_hours, 12),
    mentoring_format: clean(source.mentoring_format, 12), motivation: clean(source.motivation, 1000),
    commitment_confirmed: source.commitment_confirmed === true, submitted_at: new Date().toISOString()
  };
  if (!/^(?:\+62|62|0)8\d{8,12}$/.test(data.phone)) throw new Error('Nomor WhatsApp Indonesia belum valid');
  if (!data.job_title || !data.company_or_institution || !['1-3','4-6','7-10','10+'].includes(data.years_of_experience)) throw new Error('Jabatan, institusi, dan pengalaman wajib diisi');
  if (!tags.length || data.bio.length < 40) throw new Error('Pilih bidang keahlian dan isi bio minimal 40 karakter');
  if (!['2-4','4-6','6+'].includes(data.availability_hours) || !['online','offline','hybrid'].includes(data.mentoring_format)) throw new Error('Kesediaan waktu dan format mentoring wajib dipilih');
  if (data.motivation.length < 60 || !data.commitment_confirmed) throw new Error('Motivasi minimal 60 karakter dan komitmen mentor wajib disetujui');
  return data;
}

async function completeGoogleProfile(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Sesi pendaftaran tidak valid atau sudah berakhir' });
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,status,google_email,onboarding_completed`);
  const profile = rows && rows[0];
  if (!profile) return send(res, 404, { error: 'Profil pendaftaran tidak ditemukan' });
  if (profile.status !== 'invited') return send(res, 409, { error: 'Profil ini sudah diproses panitia' });
  if (profile.onboarding_completed) return send(res, 409, { error:'Profil sudah dikirim dan sedang menunggu verifikasi Fasil' });
  const body = req.body || {};
  const email = clean(body.email, 254).toLowerCase();
  const verifiedEmail = clean(user.email, 254).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== verifiedEmail || email !== clean(profile.email, 254).toLowerCase()) return send(res, 400, { error:'Email notifikasi harus sama dengan email login yang telah terverifikasi' });
  const requestedRole = ['mentee', 'mentor'].includes(user.user_metadata && user.user_metadata.requested_role) ? user.user_metadata.requested_role : 'mentee';
  const fullName = clean(body.full_name, 120);
  const path = requestedRole === 'mentor' ? 'Senior Mentor' : (['Career Path', 'Entrepreneur Path'].includes(body.path) ? body.path : '');
  if (fullName.length < 3 || !path) return send(res, 400, { error: 'Nama lengkap dan jalur program wajib diisi' });
  let application = null;
  if (requestedRole === 'mentor') application = mentorApplication(body);
  const updated = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ email, full_name: fullName, initials: initials(fullName), path, notification_preferences:{ in_app:true, email:true, deadline:true, review:true, session:true }, onboarding_completed: true, updated_at: new Date().toISOString() })
  });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'PUT', body: JSON.stringify({ user_metadata: Object.assign({}, user.user_metadata || {}, { full_name: fullName, initials: initials(fullName), path, profile_completed: true, mentor_application: application }) })
  });
  await adminFetch('/rest/v1/audit_logs', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: user.id, action: requestedRole === 'mentor' ? 'registration.mentor_submitted' : 'registration.profile_completed', entity_type: 'profile', entity_id: user.id, detail: { path, provider: 'google', requested_role: requestedRole, expertise: application && application.expertise_tags } })
  }).catch(() => null);
  const notification = { type:'registration', title:'Profil pendaftaran berhasil dikirim', body:`Profil ${requestedRole === 'mentor' ? 'Mentor' : 'Mentee'} kamu sudah diterima dan sedang menunggu verifikasi Fasil.`, href:'profile-setup.html' };
  const notices = await adminFetch('/rest/v1/notifications', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(Object.assign({ user_id:user.id, delivery:{ in_app:'sent', email:'queued' } }, notification)) }).catch(() => []);
  const delivery = await deliverEmail({ id:user.id, email }, notification, notices[0] && notices[0].id).catch(error => ({ status:'failed', reason:error.message }));
  if (notices[0]) await adminFetch(`/rest/v1/notifications?id=eq.${encodeURIComponent(notices[0].id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:delivery.status } }) }).catch(() => null);
  const admins = await adminFetch('/rest/v1/profiles?role=eq.admin&status=eq.active&select=id,email,notification_preferences&limit=50').catch(() => []);
  const adminNotice = { type:'registration', title:'Pendaftaran baru menunggu verifikasi', body:`${fullName} mendaftar sebagai ${requestedRole === 'mentor' ? 'Mentor' : 'Mentee'} menggunakan ${email}.`, href:'admin-dashboard.html' };
  for (const admin of admins || []) {
    const adminNotices = await adminFetch('/rest/v1/notifications', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(Object.assign({ user_id:admin.id, delivery:{ in_app:'sent', email:'queued' } }, adminNotice)) }).catch(() => []);
    const adminDelivery = await deliverEmail(admin, adminNotice, adminNotices[0] && adminNotices[0].id).catch(error => ({ status:'failed', reason:error.message }));
    if (adminNotices[0]) await adminFetch(`/rest/v1/notifications?id=eq.${encodeURIComponent(adminNotices[0].id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:adminDelivery.status } }) }).catch(() => null);
  }
  return send(res, 200, { profile: updated && updated[0], pending_review: true, email_delivery:delivery.status });
}

async function prepareIncompleteMentor(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error:'Sesi mentor tidak valid atau berakhir' });
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,status`);
  const profile = rows && rows[0];
  if (!profile || profile.role !== 'mentor') return send(res, 403, { error:'Akun ini bukan mentor' });
  if (mentorApplicationComplete(user.user_metadata && user.user_metadata.mentor_application)) return send(res, 200, { complete:true });
  await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ status:'invited', onboarding_completed:false, path:'Senior Mentor', updated_at:new Date().toISOString() }) });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body:JSON.stringify({ user_metadata:Object.assign({}, user.user_metadata || {}, { requested_role:'mentor', role:'mentee', profile_completed:false, registration_decision:'pending' }) }) });
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:user.id, action:'registration.mentor_profile_required', entity_type:'profile', entity_id:user.id, detail:{ previous_status:profile.status } }) }).catch(() => null);
  return send(res, 200, { complete:false, redirected:true });
}

async function profileContext(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error:'Sesi pengguna tidak valid atau berakhir' });
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,initials,path,cohort_id,mentee_number,mentor_id,status`);
  const profile = rows && rows[0];
  if (!profile) return send(res, 404, { error:'Profil pengguna tidak ditemukan' });
  let mentor = null;
  if (profile.mentor_id) {
    const mentors = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profile.mentor_id)}&select=id,full_name,initials,path,status`);
    mentor = mentors && mentors[0] || null;
  }
  return send(res, 200, { profile, mentor });
}

async function updateOwnProfile(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error:'Sesi pengguna tidak valid atau berakhir' });
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,path,status`);
  const profile = rows && rows[0];
  if (!profile || profile.status !== 'active') return send(res, 403, { error:'Profil tidak aktif' });
  const fullName = clean(req.body && req.body.full_name, 120);
  if (fullName.length < 3) return send(res, 400, { error:'Nama lengkap minimal 3 karakter' });
  let path = profile.path;
  if (profile.role === 'mentee') {
    path = clean(req.body && req.body.path, 40);
    if (!['Career Path','Entrepreneur Path'].includes(path)) return send(res, 400, { error:'Jalur mentee tidak valid' });
  } else if (profile.role === 'mentor') path = 'Senior Mentor';
  const prefs = req.body && req.body.notification_preferences || {};
  const notificationPreferences = {
    in_app:true,
    email:prefs.email !== false,
    deadline:prefs.deadline !== false,
    review:prefs.review !== false,
    session:prefs.session !== false
  };
  const patch = { full_name:fullName, initials:initials(fullName), path, notification_preferences:notificationPreferences, updated_at:new Date().toISOString() };
  const updated = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method:'PATCH', headers:{ Prefer:'return=representation' }, body:JSON.stringify(patch) });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body:JSON.stringify({ user_metadata:Object.assign({}, user.user_metadata || {}, { full_name:fullName, initials:patch.initials, path }) }) });
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:user.id, action:'profile.self_update', entity_type:'profile', entity_id:user.id, detail:{ full_name:fullName, path } }) }).catch(() => null);
  return send(res, 200, { profile:updated && updated[0] });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    if (req.body && req.body.action === 'google_login') return googleLogin(req, res);
    if (req.body && req.body.action === 'complete_google_profile') return completeGoogleProfile(req, res);
    if (req.body && req.body.action === 'prepare_incomplete_mentor') return prepareIncompleteMentor(req, res);
    if (req.body && req.body.action === 'profile_context') return profileContext(req, res);
    if (req.body && req.body.action === 'profile_update') return updateOwnProfile(req, res);
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    const body = req.body || {};
    if (body.action === 'qa_google_auth') {
      const candidates = await adminFetch('/rest/v1/profiles?role=eq.mentee&status=eq.active&select=id,email&order=created_at.asc&limit=1');
      const candidate = candidates && candidates[0];
      if (!candidate) return send(res, 409, { error: 'Belum ada akun mentee aktif untuk QA autentikasi' });
      const generated = await adminFetch('/auth/v1/admin/generate_link', { method:'POST', body:JSON.stringify({ type:'magiclink', email:candidate.email }) });
      const tokenHash = generated && (generated.hashed_token || (generated.properties && generated.properties.hashed_token));
      if (!tokenHash) throw new Error('QA tidak menerima hashed token');
      const verifiedResponse = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method:'POST', headers:{ apikey:PUBLISHABLE, 'Content-Type':'application/json' },
        body:JSON.stringify({ token_hash:tokenHash, type:'email' })
      });
      const verified = await verifiedResponse.json().catch(() => ({}));
      const passed = verifiedResponse.ok && !!verified.access_token && !!verified.refresh_token && verified.user && verified.user.id === candidate.id;
      await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ actor_id:auth.user.id, action:'auth.google_qa', entity_type:'profile', entity_id:candidate.id, detail:{ passed, status:verifiedResponse.status } }) }).catch(() => null);
      return send(res, passed ? 200 : 502, { passed, generated:!!tokenHash, session_created:!!verified.access_token, refresh_created:!!verified.refresh_token, user_match:!!(verified.user && verified.user.id === candidate.id), status:verifiedResponse.status });
    }
    if (body.action === 'settings') {
      const patch = {
        id: 1,
        program_name: String(body.program_name || 'Future Builders Fellowship').slice(0, 120),
        current_month: Math.max(1, Number(body.current_month) || 1),
        current_week: Math.max(1, Number(body.current_week) || 1),
        passing_score: Math.min(100, Math.max(0, Number(body.passing_score) || 75)),
        active_phase: ['EMPATHIZE','DEFINE','IDEATE','PROTOTYPE','TEST'].includes(body.active_phase) ? body.active_phase : 'DEFINE',
        completion_requirement: Math.min(100, Math.max(0, Number(body.completion_requirement) || 80)),
        attendance_requirement: Math.min(100, Math.max(0, Number(body.attendance_requirement) || 80)),
        quality_requirement: Math.min(100, Math.max(0, Number(body.quality_requirement) || 75)),
        feature_flags: body.feature_flags && typeof body.feature_flags === 'object' ? body.feature_flags : {},
        kpi_weights: body.kpi_weights && typeof body.kpi_weights === 'object' ? body.kpi_weights : {},
        rubric_templates: Array.isArray(body.rubric_templates) ? body.rubric_templates.slice(0, 30) : [],
        updated_by: auth.user.id,
        updated_at: new Date().toISOString()
      };
      await adminFetch('/rest/v1/program_settings?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(patch) });
      await adminFetch('/rest/v1/audit_logs', { method:'POST', body:JSON.stringify({ actor_id:auth.user.id, action:'settings.update', entity_type:'program_settings', entity_id:'1', detail:{ active_phase:patch.active_phase, current_month:patch.current_month, current_week:patch.current_week } }) });
      return send(res, 200, { ok: true });
    }
    if (body.action === 'cohort') {
      if (!body.name) return send(res, 400, { error: 'Nama cohort wajib diisi' });
      const cohortPayload = { name: String(body.name).slice(0, 120), start_date: body.start_date || null, end_date: body.end_date || null, status: 'active', updated_at: new Date().toISOString() };
      let cohort;
      if (body.id && /^[0-9a-f-]{36}$/i.test(body.id)) {
        const rows = await adminFetch(`/rest/v1/cohorts?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(cohortPayload) });
        cohort = rows[0];
      } else {
        const rows = await adminFetch('/rest/v1/cohorts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(cohortPayload) });
        cohort = rows[0];
      }
      const profiles = await adminFetch('/rest/v1/profiles?select=id,role,mentee_number,email');
      const mentors = await adminFetch('/rest/v1/profiles?role=eq.mentor&status=eq.active&select=id,email');
      for (const pair of body.pairings || []) {
        const mentee = profiles.find(p => p.role === 'mentee' && p.mentee_number === Number(pair.mentee_number));
        const mentor = mentors.find(p => p.id === pair.mentor_id || p.email === pair.mentor_email);
        if (mentee) await adminFetch(`/rest/v1/profiles?id=eq.${mentee.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ cohort_id: cohort.id, mentor_id: mentor ? mentor.id : null, updated_at: new Date().toISOString() }) });
      }
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'cohort.update', entity_type: 'cohort', entity_id: cohort.id, detail: { name: cohort.name, pairings: (body.pairings || []).length } }) });
      return send(res, 200, { cohort });
    }
    return send(res, 400, { error: 'Aksi program tidak dikenal' });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
