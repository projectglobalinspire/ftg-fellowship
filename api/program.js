const { send, adminFetch, requireRole, method } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    const body = req.body || {};
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
