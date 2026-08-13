const crypto = require('crypto');
const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail } = require('./_email');

const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const safe = (value, max = 500) => String(value || '').trim().slice(0, max);
const youtubeId = value => {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (/^\/(embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch (_) { return ''; }
};

async function audit(actor, action, entityType, entityId, detail = {}) {
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:actor, action, entity_type:entityType, entity_id:String(entityId || ''), detail }) });
}

async function eligibility(menteeId) {
  const [profiles, settingsRows, submissions, attendance, targets] = await Promise.all([
    adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(menteeId)}&select=id,email,full_name,cohort_id,status`),
    adminFetch('/rest/v1/program_settings?id=eq.1&select=program_name,passing_score,completion_requirement,attendance_requirement,quality_requirement'),
    adminFetch(`/rest/v1/submissions?mentee_id=eq.${encodeURIComponent(menteeId)}&select=status,reviews(score)`),
    adminFetch(`/rest/v1/attendance_records?mentee_id=eq.${encodeURIComponent(menteeId)}&select=status`),
    adminFetch(`/rest/v1/assignment_targets?mentee_id=eq.${encodeURIComponent(menteeId)}&select=assignment_id,assignments(status)`)
  ]);
  const profile = profiles[0], settings = settingsRows[0] || {};
  if (!profile) return null;
  const total = targets.filter(t=>!t.assignments || t.assignments.status !== 'archived').length, done = submissions.filter(s => s.status === 'approved').length;
  const scores = submissions.flatMap(s => s.reviews || []).map(r => +r.score).filter(Number.isFinite);
  const totalAttendance = attendance.length, present = attendance.filter(r => ['present','late','excused'].includes(r.status)).length;
  const metrics = {
    completion: total ? Math.round(done / total * 100) : 0,
    attendance: totalAttendance ? Math.round(present / totalAttendance * 100) : 100,
    quality: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : 0,
    requirements: { completion:+(settings.completion_requirement || 80), attendance:+(settings.attendance_requirement || 80), quality:+(settings.quality_requirement || settings.passing_score || 75) }
  };
  metrics.eligible = metrics.completion >= metrics.requirements.completion && metrics.attendance >= metrics.requirements.attendance && metrics.quality >= metrics.requirements.quality && profile.status === 'active';
  return { profile, settings, metrics };
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET','POST'])) return;
  try {
    const auth = await requireRole(req, res, ['mentee','mentor','admin']);
    if (!auth) return;
    if (req.method === 'GET') {
      const resource = String(req.query.resource || 'overview');
      if (resource === 'events') {
        const rows = await adminFetch('/rest/v1/program_events?select=*&order=starts_at.asc');
        return send(res, 200, { events:rows });
      }
      if (resource === 'recordings') {
        const rows = await adminFetch('/rest/v1/program_events?event_type=eq.other&select=*&order=starts_at.desc');
        return send(res, 200, { recordings:rows.filter(row => String(row.location || '').startsWith('LMS · ')).map(row => Object.assign({}, row, { location:String(row.location).slice(6),youtube_id:youtubeId(row.meeting_link) })).filter(row => row.youtube_id) });
      }
      if (resource === 'certificate') {
        const target = auth.profile.role === 'mentee' ? auth.user.id : req.query.mentee_id;
        if (!target) return send(res, 400, { error:'Mentee wajib dipilih' });
        const rows = await adminFetch(`/rest/v1/certificates?mentee_id=eq.${encodeURIComponent(target)}&revoked_at=is.null&select=*&order=issued_at.desc&limit=1`);
        const check = await eligibility(target);
        return send(res, 200, { certificate:rows[0] || null, eligibility:check && check.metrics });
      }
      if (resource === 'audit') {
        if (auth.profile.role !== 'admin') return send(res, 403, { error:'Khusus panitia' });
        const rows = await adminFetch('/rest/v1/audit_logs?select=*,profiles!audit_logs_actor_id_fkey(full_name,email)&order=created_at.desc&limit=200');
        return send(res, 200, { logs:rows });
      }
      if (resource === 'attendance') {
        if (auth.profile.role === 'mentee') {
          const rows = await adminFetch(`/rest/v1/attendance_records?mentee_id=eq.${auth.user.id}&select=*,attendance_sessions(title,opens_at)&order=created_at.desc`);
          return send(res, 200, { records:rows });
        }
        const sessions = await adminFetch('/rest/v1/attendance_sessions?select=*,attendance_records(id,mentee_id,status,checked_in_at,method,note)&order=opens_at.desc&limit=30');
        return send(res, 200, { sessions });
      }
      if (auth.profile.role !== 'admin') return send(res, 403, { error:'Khusus panitia' });
      const [settings, profiles, assignments, submissions, events, attendance, integrations, reviewHistory] = await Promise.all([
        adminFetch('/rest/v1/program_settings?id=eq.1&select=*'),
        adminFetch('/rest/v1/profiles?select=id,email,full_name,role,status,warning_level,absence_count,last_active_at,google_email,mentor_id,cohort_id&order=full_name.asc'),
        adminFetch('/rest/v1/assignments?select=id,title,deadline,status,rubric,created_by'),
        adminFetch('/rest/v1/submissions?select=id,assignment_id,mentee_id,status,submitted_at,updated_at,reviews(score,decision,updated_at)'),
        adminFetch('/rest/v1/program_events?select=*&order=starts_at.asc'),
        adminFetch('/rest/v1/attendance_records?select=mentee_id,status,checked_in_at'),
        adminFetch('/rest/v1/integration_status?select=*')
        ,adminFetch('/rest/v1/review_history?select=submission_id,score,decision,created_at&order=created_at.asc')
      ]);
      return send(res, 200, { settings:settings[0] || {}, profiles, assignments, submissions, events, attendance, integrations, review_history:reviewHistory });
    }

    const body = req.body || {}, action = body.action;
    if (action === 'check_in') {
      if (auth.profile.role !== 'mentee') return send(res, 403, { error:'Presensi QR hanya untuk mentee' });
      const tokenHash = hash(body.token);
      const sessions = await adminFetch(`/rest/v1/attendance_sessions?token_hash=eq.${tokenHash}&status=eq.open&select=*`);
      const session = sessions[0], now = new Date();
      if (!session) return send(res, 404, { error:'QR presensi tidak valid' });
      if (now < new Date(session.opens_at) || now > new Date(session.closes_at)) return send(res, 400, { error:'Waktu presensi sudah ditutup' });
      const rows = await adminFetch('/rest/v1/attendance_records?on_conflict=session_id,mentee_id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=representation' }, body:JSON.stringify({ session_id:session.id,mentee_id:auth.user.id,status:'present',checked_in_at:now.toISOString(),method:'qr',recorded_by:auth.user.id,updated_at:now.toISOString() }) });
      await audit(auth.user.id,'attendance.check_in','attendance_session',session.id,{ method:'qr' });
      return send(res, 200, { ok:true, session, record:rows[0] });
    }
    if (auth.profile.role !== 'admin') return send(res, 403, { error:'Perubahan ini khusus panitia' });

    if (action === 'event_save') {
      if (!body.title || !body.starts_at) return send(res, 400, { error:'Judul dan waktu mulai wajib diisi' });
      const payload = { title:safe(body.title,160),event_type:body.event_type || 'other',starts_at:body.starts_at,ends_at:body.ends_at || null,location:safe(body.location,180) || null,meeting_link:safe(body.meeting_link,500) || null,description:safe(body.description,1500) || null,visibility:body.visibility || 'all',cohort_id:body.cohort_id || null,created_by:auth.user.id,updated_at:new Date().toISOString() };
      let rows;
      if (body.id) rows = await adminFetch(`/rest/v1/program_events?id=eq.${encodeURIComponent(body.id)}`, { method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload) });
      else rows = await adminFetch('/rest/v1/program_events', { method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload) });
      await audit(auth.user.id,'event.save','program_event',rows[0].id,{ title:payload.title });
      return send(res, 200, { event:rows[0] });
    }
    if (action === 'recording_save') {
      const videoId = youtubeId(body.youtube_url);
      if (!safe(body.title, 160)) return send(res, 400, { error:'Judul rekaman wajib diisi' });
      if (!videoId) return send(res, 400, { error:'Link YouTube tidak valid. Gunakan link video youtu.be atau youtube.com.' });
      const now = new Date().toISOString();
      const payload = {
        title:safe(body.title,160), event_type:'other', starts_at:body.recorded_at || now, ends_at:null,
        location:`LMS · ${safe(body.session_name,110) || 'Rekaman Program'}`, meeting_link:`https://www.youtube.com/watch?v=${videoId}`,
        description:safe(body.description,1500) || null, visibility:'all', cohort_id:null,
        created_by:auth.user.id, updated_at:now
      };
      let rows;
      if (body.id) {
        const current = await adminFetch(`/rest/v1/program_events?id=eq.${encodeURIComponent(body.id)}&event_type=eq.other&select=id,location`);
        if (current[0] && !String(current[0].location || '').startsWith('LMS · ')) return send(res, 404, { error:'Rekaman tidak ditemukan' });
        if (!current[0]) return send(res, 404, { error:'Rekaman tidak ditemukan' });
        rows = await adminFetch(`/rest/v1/program_events?id=eq.${encodeURIComponent(body.id)}`, { method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload) });
      } else rows = await adminFetch('/rest/v1/program_events', { method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload) });
      await audit(auth.user.id,'recording.save','program_event',rows[0].id,{ title:payload.title,youtube_id:videoId });
      return send(res, body.id ? 200 : 201, { recording:Object.assign({}, rows[0], { youtube_id:videoId }) });
    }
    if (action === 'recording_delete') {
      if (!body.id) return send(res, 400, { error:'Rekaman wajib dipilih' });
      const current = await adminFetch(`/rest/v1/program_events?id=eq.${encodeURIComponent(body.id)}&event_type=eq.other&select=id,title,location`);
      if (current[0] && !String(current[0].location || '').startsWith('LMS · ')) return send(res, 404, { error:'Rekaman tidak ditemukan' });
      if (!current[0]) return send(res, 404, { error:'Rekaman tidak ditemukan' });
      await adminFetch(`/rest/v1/program_events?id=eq.${encodeURIComponent(body.id)}`, { method:'DELETE',headers:{Prefer:'return=minimal'} });
      await audit(auth.user.id,'recording.delete','program_event',body.id,{ title:current[0].title });
      return send(res, 200, { ok:true });
    }
    if (action === 'attendance_create') {
      const token = crypto.randomBytes(18).toString('base64url');
      const payload = { event_id:body.event_id || null,title:safe(body.title,160),opens_at:body.opens_at,closes_at:body.closes_at,status:'open',token_hash:hash(token),created_by:auth.user.id };
      if (!payload.title || !payload.opens_at || !payload.closes_at) return send(res, 400, { error:'Data sesi presensi belum lengkap' });
      const rows = await adminFetch('/rest/v1/attendance_sessions', { method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload) });
      await audit(auth.user.id,'attendance.create','attendance_session',rows[0].id,{ title:payload.title });
      return send(res, 201, { session:rows[0], token, check_in_url:`https://ftg-fellowship.vercel.app/attendance.html?token=${encodeURIComponent(token)}` });
    }
    if (action === 'attendance_mark') {
      if (!body.session_id || !body.mentee_id || !['present','late','excused','absent'].includes(body.status)) return send(res, 400, { error:'Data presensi tidak valid' });
      const payload = { session_id:body.session_id,mentee_id:body.mentee_id,status:body.status,checked_in_at:body.status==='absent'?null:new Date().toISOString(),method:'manual',note:safe(body.note,500)||null,recorded_by:auth.user.id,updated_at:new Date().toISOString() };
      const rows = await adminFetch('/rest/v1/attendance_records?on_conflict=session_id,mentee_id', { method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload) });
      const level = await adminFetch('/rest/v1/rpc/recalculate_participant_discipline', { method:'POST',body:JSON.stringify({ target:body.mentee_id }) });
      if (body.status === 'absent') {
        const notice={ user_id:body.mentee_id,type:'attendance_warning',title:'Ketidakhadiran tercatat',body:`Status peringatan diperbarui ke level ${level}. Hubungi panitia bila ada kekeliruan.`,href:'mentee-dashboard.html',delivery:{in_app:'sent',email:'queued'} };
        const notices=await adminFetch('/rest/v1/notifications', { method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(notice) });
        const participant=(await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(body.mentee_id)}&select=id,email,full_name`))[0];
        await deliverEmail(participant,notice,notices[0]&&notices[0].id);
        const tier=Number(level)||0;
        await adminFetch('/rest/v1/discipline_actions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({mentee_id:body.mentee_id,action:tier===1?'warning_1':tier===2?'warning_2':'lock',from_level:Math.max(0,tier-1),to_level:tier,reason:safe(body.note,500)||`Tidak hadir pada ${payload.session_id}`,actor_id:auth.user.id})});
      }
      await audit(auth.user.id,'attendance.mark','attendance_record',rows[0].id,{ status:body.status,warning_level:level });
      return send(res, 200, { record:rows[0], warning_level:level });
    }
    if (action === 'certificate_issue') {
      const check = await eligibility(body.mentee_id);
      if (!check) return send(res, 404, { error:'Mentee tidak ditemukan' });
      const existing = await adminFetch(`/rest/v1/certificates?mentee_id=eq.${encodeURIComponent(body.mentee_id)}&revoked_at=is.null&select=*&order=issued_at.desc&limit=1`);
      if (existing[0]) return send(res, 200, { certificate:existing[0], already_issued:true });
      if (!check.metrics.eligible && body.force !== true) return send(res, 400, { error:'Mentee belum memenuhi syarat kelulusan', eligibility:check.metrics });
      const year = new Date().getFullYear();
      const countRows = await adminFetch('/rest/v1/certificates?select=id');
      const number = `FTG-GI/${year}/${String(countRows.length + 1).padStart(4,'0')}`;
      const rows = await adminFetch('/rest/v1/certificates', { method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({ mentee_id:check.profile.id,cohort_id:check.profile.cohort_id,certificate_number:number,recipient_name:check.profile.full_name,program_name:check.settings.program_name || 'Future Builders Fellowship',issued_by:auth.user.id,eligibility_snapshot:check.metrics }) });
      await adminFetch(`/rest/v1/profiles?id=eq.${check.profile.id}`, { method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ status:'graduated',graduation_eligible:true,updated_at:new Date().toISOString() }) });
      await audit(auth.user.id,'certificate.issue','certificate',rows[0].id,{ number,mentee_id:check.profile.id });
      const notice={type:'certificate',title:'Sertifikat fellowship tersedia',body:`Sertifikat ${number} sudah dapat dilihat dan diverifikasi.`,href:`certificate.html?code=${rows[0].verification_code}`};
      const notices=await adminFetch('/rest/v1/notifications',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(Object.assign({user_id:check.profile.id,delivery:{in_app:'sent',email:'queued'}},notice))});
      await deliverEmail(check.profile,notice,notices[0]&&notices[0].id);
      return send(res, 201, { certificate:rows[0] });
    }
    return send(res, 400, { error:'Aksi operasional tidak dikenal' });
  } catch (error) { return send(res, 500, { error:error.message }); }
};
