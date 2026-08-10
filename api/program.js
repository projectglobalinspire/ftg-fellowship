const { send, adminFetch, currentUser, requireRole, method, SUPABASE_URL, PUBLISHABLE } = require('./_lib');
const googleLogin = require('./_google-login');

function clean(value, max) { return String(value || '').trim().slice(0, max); }
function initials(name) { return clean(name, 120).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }

async function completeGoogleProfile(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Sesi pendaftaran tidak valid atau sudah berakhir' });
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,status,google_email`);
  const profile = rows && rows[0];
  if (!profile) return send(res, 404, { error: 'Profil pendaftaran tidak ditemukan' });
  if (profile.status !== 'invited') return send(res, 409, { error: 'Profil ini sudah diproses panitia' });
  const body = req.body || {};
  const fullName = clean(body.full_name, 120);
  const path = ['Career Path', 'Entrepreneur Path'].includes(body.path) ? body.path : '';
  if (fullName.length < 3 || !path) return send(res, 400, { error: 'Nama lengkap dan jalur program wajib diisi' });
  const updated = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ full_name: fullName, initials: initials(fullName), path, onboarding_completed: true, updated_at: new Date().toISOString() })
  });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'PUT', body: JSON.stringify({ user_metadata: Object.assign({}, user.user_metadata || {}, { full_name: fullName, initials: initials(fullName), path, profile_completed: true }) })
  });
  await adminFetch('/rest/v1/audit_logs', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: user.id, action: 'registration.profile_completed', entity_type: 'profile', entity_id: user.id, detail: { path, provider: 'google' } })
  }).catch(() => null);
  return send(res, 200, { profile: updated && updated[0], pending_review: true });
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    if (req.body && req.body.action === 'google_login') return googleLogin(req, res);
    if (req.body && req.body.action === 'complete_google_profile') return completeGoogleProfile(req, res);
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
