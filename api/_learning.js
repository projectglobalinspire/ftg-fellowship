const { send, adminFetch, requireRole, method } = require('./_lib');

const CANVAS_ID = 'dt-canvas-month-1';
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const iso = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function defaultConfig(settings = {}) {
  const active = Math.min(4, Math.max(1, Number(settings.current_week) || 1));
  const phases = [
    ['EMPATHIZE', 'Memahami manusia', ['Untuk siapa kita mendesain?', 'Apa kebutuhan terdalam mereka?', 'Apa yang mengejutkan dari temuanmu?']],
    ['DEFINE', 'Merumuskan masalah', ['Apa masalah utamanya?', 'Insight apa yang membuatnya penting?', 'Untuk siapa masalah ini paling mendesak?']],
    ['IDEATE', 'Mengembangkan solusi', ['Apa semua solusi yang mungkin?', 'Bagaimana solusi ini menguntungkan komunitas?', 'Ide mana yang paling sesuai nilai dan etika?']],
    ['PROTOTYPE & TEST', 'Menguji solusi', ['Versi paling sederhana apa yang dapat dibuat?', 'Asumsi apa yang ingin diuji?', 'Apa yang berhasil, gagal, dan perlu diperbaiki?']]
  ];
  return {
    version: 1,
    title: 'GI Design Thinking Canvas — Prophetic Method',
    instructions: 'Isi canvas secara bertahap. Setiap perubahan tersimpan otomatis dan dapat dipantau mentor serta Fasil.',
    active_week: active,
    weeks: phases.map((row, index) => ({
      number: index + 1, phase: row[0], title: row[1], description: '',
      mode: index + 1 <= active ? 'open' : 'automatic', open_at: null, close_at: null,
      questions: row[2]
    }))
  };
}

function normalizeConfig(input, settings) {
  const fallback = defaultConfig(settings);
  const source = input && typeof input === 'object' ? input : {};
  const weeks = Array.isArray(source.weeks) ? source.weeks : fallback.weeks;
  return {
    version: 1,
    title: clean(source.title || fallback.title, 160),
    instructions: clean(source.instructions || fallback.instructions, 1200),
    active_week: Math.min(4, Math.max(1, Number(source.active_week) || Number(settings.current_week) || 1)),
    weeks: [1, 2, 3, 4].map(number => {
      const raw = weeks.find(item => Number(item && item.number) === number) || fallback.weeks[number - 1];
      const questions = Array.isArray(raw.questions) ? raw.questions.map(q => clean(q, 240)).filter(Boolean).slice(0, 12) : fallback.weeks[number - 1].questions;
      return {
        number, phase: clean(raw.phase || fallback.weeks[number - 1].phase, 80),
        title: clean(raw.title || fallback.weeks[number - 1].title, 140),
        description: clean(raw.description, 500), mode: ['automatic', 'open', 'closed'].includes(raw.mode) ? raw.mode : 'automatic',
        open_at: iso(raw.open_at), close_at: iso(raw.close_at), questions: questions.length ? questions : fallback.weeks[number - 1].questions
      };
    })
  };
}

function weekOpen(week, activeWeek) {
  if (week.mode === 'open') return true;
  if (week.mode === 'closed') return false;
  const now = Date.now(), start = week.open_at ? Date.parse(week.open_at) : null, end = week.close_at ? Date.parse(week.close_at) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return week.number <= activeWeek;
}

async function audit(actor, action, entityId, detail) {
  return adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:actor, action, entity_type:'learning_canvas', entity_id:entityId, detail:detail || {} }) }).catch(() => null);
}

async function baseData() {
  const [settingsRows, assignments] = await Promise.all([
    adminFetch('/rest/v1/program_settings?id=eq.1&select=*'),
    adminFetch(`/rest/v1/assignments?id=eq.${CANVAS_ID}&select=*`)
  ]);
  const settings = settingsRows[0] || { current_week: 1, current_month: 1 };
  const assignment = assignments[0] || null;
  const config = normalizeConfig(assignment && assignment.checklist && assignment.checklist[0] && assignment.checklist[0].learning_canvas, settings);
  return { settings, assignment, config };
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentee', 'mentor', 'admin']);
    if (!auth) return;
    const base = await baseData();
    const activeWeek = base.config.active_week;
    const publicConfig = Object.assign({}, base.config, { weeks: base.config.weeks.map(w => Object.assign({}, w, { is_open: weekOpen(w, activeWeek) })) });

    if (req.method === 'GET') {
      if (auth.profile.role === 'mentee') {
        const rows = await adminFetch(`/rest/v1/submissions?assignment_id=eq.${CANVAS_ID}&mentee_id=eq.${encodeURIComponent(auth.user.id)}&select=id,status,checklist_state,text_content,link_url,files,submitted_at,updated_at,reviews(score,decision,feedback,updated_at)`);
        return send(res, 200, { assignment:base.assignment, config:publicConfig, progress:rows[0] || null });
      }
      let menteeFilter = '';
      if (auth.profile.role === 'mentor') menteeFilter = `&mentor_id=eq.${encodeURIComponent(auth.user.id)}`;
      const [profiles, submissions] = await Promise.all([
        adminFetch(`/rest/v1/profiles?role=eq.mentee&status=eq.active${menteeFilter}&select=id,full_name,email,initials,path,mentor_id,mentee_number&order=full_name.asc`),
        adminFetch(`/rest/v1/submissions?assignment_id=eq.${CANVAS_ID}&select=id,mentee_id,status,checklist_state,text_content,link_url,files,submitted_at,updated_at,reviews(score,decision,feedback,updated_at)`)
      ]);
      const allowed = new Set(profiles.map(p => p.id));
      return send(res, 200, { assignment:base.assignment, config:publicConfig, learners:profiles.map(profile => ({ profile, progress:submissions.find(s => s.mentee_id === profile.id) || null })).filter(row => allowed.has(row.profile.id)) });
    }

    const body = req.body || {};
    if (body.action === 'config_save') {
      if (auth.profile.role !== 'admin') return send(res, 403, { error:'Hanya Fasil yang dapat mengatur kurikulum Canvas' });
      const config = normalizeConfig(body.config, base.settings);
      const deadline = config.weeks.map(w => w.close_at).filter(Boolean).sort().pop() || null;
      const payload = {
        id:CANVAS_ID, cohort_id:null, title:config.title, description:config.instructions, deadline,
        points:100, checklist:[{ learning_canvas:config }], rubric:[
          { name:'Kedalaman empati', weight:30, max:100 }, { name:'Kejelasan masalah', weight:25, max:100 },
          { name:'Kualitas ide', weight:25, max:100 }, { name:'Refleksi & etika', weight:20, max:100 }
        ], status:'published', is_template:false, created_by:auth.user.id, updated_at:new Date().toISOString()
      };
      await adminFetch('/rest/v1/assignments?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(payload) });
      await adminFetch(`/rest/v1/program_settings?id=eq.1`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ current_week:config.active_week, active_phase:config.weeks[config.active_week - 1].phase.split(' ')[0], updated_by:auth.user.id, updated_at:new Date().toISOString() }) });
      const mentees = await adminFetch('/rest/v1/profiles?role=eq.mentee&status=eq.active&select=id');
      await adminFetch(`/rest/v1/assignment_targets?assignment_id=eq.${CANVAS_ID}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
      if (mentees.length) await adminFetch('/rest/v1/assignment_targets', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify(mentees.map(m => ({ assignment_id:CANVAS_ID, mentee_id:m.id }))) });
      await audit(auth.user.id, 'learning.config_update', CANVAS_ID, { active_week:config.active_week, modes:config.weeks.map(w => w.mode) });
      return send(res, 200, { ok:true, config:Object.assign({}, config, { weeks:config.weeks.map(w => Object.assign({}, w, { is_open:weekOpen(w, config.active_week) })) }) });
    }

    if (body.action === 'progress_save') {
      if (auth.profile.role !== 'mentee') return send(res, 403, { error:'Hanya mentee yang dapat mengisi Canvas' });
      if (!base.assignment) return send(res, 409, { error:'Canvas belum dipublikasikan Fasil' });
      const raw = body.progress && typeof body.progress === 'object' ? body.progress : {};
      const progress = { niyyah:clean(raw.niyyah, 1500), weeks:{}, updated_at:new Date().toISOString() };
      for (const week of publicConfig.weeks) {
        const source = raw.weeks && raw.weeks[String(week.number)] || {};
        const answers = Array.isArray(source.answers) ? source.answers.map(a => clean(a, 4000)).slice(0, week.questions.length) : [];
        if (week.is_open) progress.weeks[String(week.number)] = { answers, updated_at:new Date().toISOString() };
      }
      const existing = await adminFetch(`/rest/v1/submissions?assignment_id=eq.${CANVAS_ID}&mentee_id=eq.${encodeURIComponent(auth.user.id)}&select=id,status,checklist_state,text_content,link_url,files,submitted_at`);
      const previous = existing[0] && existing[0].checklist_state || {};
      for (const week of publicConfig.weeks) if (!week.is_open && previous.weeks && previous.weeks[String(week.number)]) progress.weeks[String(week.number)] = previous.weeks[String(week.number)];
      const submit = body.submit === true;
      const submissionId = `${CANVAS_ID}:${auth.user.id}`;
      const old = existing[0] || {};
      const record = { id:submissionId, assignment_id:CANVAS_ID, mentee_id:auth.user.id,
        text_content:body.reflection === undefined ? (old.text_content || '') : clean(body.reflection, 8000),
        link_url:old.link_url || null, files:Array.isArray(body.files) ? body.files.slice(0, 10) : (old.files || []), checklist_state:progress,
        status:submit ? 'submitted' : (['submitted','approved'].includes(old.status) ? old.status : 'draft'),
        submitted_at:submit ? new Date().toISOString() : (old.submitted_at || null), updated_at:new Date().toISOString() };
      await adminFetch('/rest/v1/submissions?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(record) });
      if (submit) {
        const versions = await adminFetch(`/rest/v1/submission_versions?submission_id=eq.${encodeURIComponent(submissionId)}&select=version_number&order=version_number.desc&limit=1`);
        await adminFetch('/rest/v1/submission_versions', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ submission_id:submissionId, version_number:(versions[0] ? Number(versions[0].version_number) + 1 : 1), text_content:record.text_content, link_url:null, files:record.files }) });
        await audit(auth.user.id, 'learning.submit', submissionId, { active_week:activeWeek });
      }
      return send(res, 200, { ok:true, progress, status:record.status, submitted_at:record.submitted_at });
    }
    return send(res, 400, { error:'Aksi pembelajaran tidak dikenal' });
  } catch (error) { return send(res, 500, { error:error.message }); }
};
