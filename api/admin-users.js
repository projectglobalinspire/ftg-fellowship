const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail } = require('./_email');

const MENTOR_TRACKS = ['Career Path', 'Entrepreneur Path'];
const MENTOR_EXPERTISE = ['Career Development','CV & LinkedIn','Interview Skills','Salary Negotiation','Personal Branding','Entrepreneurship','Business Model','Marketing','Product Development','Finance & Fundraising','Leadership','Mental Health','Tech & Digital','Creative Industry','Social Impact'];
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const safeUrl = value => { const input=clean(value,500);if(!input)return'';try{const url=new URL(input);return ['http:','https:'].includes(url.protocol)?url.toString():'';}catch(_){return'';} };
const initials = name => clean(name,120).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();

function mentorApplicationComplete(application) {
  return Boolean(application && application.commitment_confirmed && application.phone && application.job_title && application.company_or_institution && application.years_of_experience && Array.isArray(application.expertise_tags) && application.expertise_tags.length && String(application.bio || '').length >= 40 && application.availability_hours && application.mentoring_format && String(application.motivation || '').length >= 60);
}

function normalizeMentorApplication(source) {
  source=source&&typeof source==='object'?source:{};
  const tags=Array.isArray(source.expertise_tags)?[...new Set(source.expertise_tags.filter(tag=>MENTOR_EXPERTISE.includes(tag)))].slice(0,5):[];
  const data={ phone:clean(source.phone,24).replace(/[\s-]/g,''),linkedin_url:safeUrl(source.linkedin_url),job_title:clean(source.job_title,120),company_or_institution:clean(source.company_or_institution,160),years_of_experience:clean(source.years_of_experience,12),expertise_tags:tags,bio:clean(source.bio,600),availability_hours:clean(source.availability_hours,12),mentoring_format:clean(source.mentoring_format,12),motivation:clean(source.motivation,1000),commitment_confirmed:source.commitment_confirmed===true,submitted_at:source.submitted_at||new Date().toISOString(),completed_by_fasil:true };
  if(!mentorApplicationComplete(data)||!/^(?:\+62|62|0)8\d{8,12}$/.test(data.phone)||!['1-3','4-6','7-10','10+'].includes(data.years_of_experience)||!['2-4','4-6','6+'].includes(data.availability_hours)||!['online','offline','hybrid'].includes(data.mentoring_format))throw new Error('Profil profesional Mentor belum lengkap atau belum valid');
  return data;
}

async function pairUnassignedByTrack(track, mentorId, actorId) {
  if(!MENTOR_TRACKS.includes(track)||!mentorId)return 0;
  const mentees=await adminFetch(`/rest/v1/profiles?role=eq.mentee&status=eq.active&path=eq.${encodeURIComponent(track)}&mentor_id=is.null&select=id`);
  for(const mentee of mentees||[])await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(mentee.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({mentor_id:mentorId,updated_at:new Date().toISOString()})});
  if((mentees||[]).length)await adminFetch('/rest/v1/audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:actorId,action:'pairing.auto_track',entity_type:'profile',entity_id:mentorId,detail:{track,mentees:(mentees||[]).map(row=>row.id)}})}).catch(()=>null);
  return (mentees||[]).length;
}

async function nextMenteeNumber() {
  const rows = await adminFetch('/rest/v1/profiles?role=eq.mentee&select=mentee_number');
  return (rows || []).reduce((max, row) => Math.max(max, Number(row.mentee_number) || 0), 0) + 1;
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    if (req.method === 'GET') {
      const page = Math.max(1, +(req.query.page || 1));
      const users = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
      const authUsers = users.users || users;
      const profiles = await adminFetch('/rest/v1/profiles?select=*&order=created_at.desc');
      const hydratedProfiles = (profiles || []).map(profile => {
        const account = (authUsers || []).find(user => user.id === profile.id) || {};
        const metadata = account.user_metadata || {};
        const preferences = profile.notification_preferences || {};
        return Object.assign({}, profile, { bio:metadata.bio || preferences.profile_bio || '', avatar_url:metadata.avatar_url || preferences.avatar_url || '' });
      });
      return send(res, 200, { users: authUsers, profiles:hydratedProfiles });
    }
    const body = req.body || {};
    if (req.method === 'POST') {
      if (!body.email || !body.full_name || !['mentee', 'mentor', 'admin'].includes(body.role)) return send(res, 400, { error: 'Email, nama, dan role wajib valid' });
      const accountEmail = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail) || accountEmail.length > 254) return send(res, 400, { error:'Format email akun tidak valid' });
      if (body.password && String(body.password).length < 8) return send(res, 400, { error:'Password sementara minimal 8 karakter' });
      const password = body.password || `${crypto.randomUUID().slice(0, 10)}Aa1!`;
      const menteeNumber = body.role === 'mentee' ? (Number(body.mentee_number) || await nextMenteeNumber()) : null;
      const mentorTrack=body.role==='mentor'&&MENTOR_TRACKS.includes(body.path)?body.path:null;
      const mentorApplication=body.role==='mentor'?normalizeMentorApplication(body.mentor_application):null;
      if(body.role==='mentor'&&!mentorTrack)return send(res,400,{error:'Track Mentor wajib Career Path atau Entrepreneur Path'});
      const metadata={full_name:clean(body.full_name,120),role:body.role,requested_role:body.role,initials:body.initials||initials(body.full_name),path:body.path||'',mentee_number:menteeNumber,profile_completed:true,registration_decision:'approved',registration_decided_at:new Date().toISOString(),created_by_fasil:true};
      if(mentorApplication)metadata.mentor_application=mentorApplication;
      const user = await adminFetch('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: accountEmail, password, email_confirm: body.email_confirm !== false, user_metadata:metadata }) });
      const profilePatch={mentor_id:body.mentor_id||null,cohort_id:body.cohort_id||null,mentee_number:menteeNumber,full_name:clean(body.full_name,120),initials:metadata.initials,path:body.path||'',status:'active',onboarding_completed:true,updated_at:new Date().toISOString()};
      if(body.role==='mentor')Object.assign(profilePatch,{role:'mentor',mentor_id:null,mentee_number:null,notification_preferences:{in_app:true,email:true,deadline:true,review:true,session:true,profile_bio:mentorApplication.bio}});
      await adminFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(profilePatch) });
      const paired=body.role==='mentor'&&body.auto_pair!==false?await pairUnassignedByTrack(mentorTrack,user.id,auth.user.id):0;
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: body.role==='mentor'?'mentor.create_approved':'user.create', entity_type: 'profile', entity_id: user.id, detail: { email: accountEmail, role: body.role, track:mentorTrack, paired } }) });
      return send(res, 201, { user, approved:true, paired, temporary_password: body.password ? undefined : password });
    }
    const id = body.id || req.query.id;
    if (!id) return send(res, 400, { error: 'ID pengguna wajib ada' });
    if (req.method === 'PATCH') {
      if(body.action==='admin_mentor_profile'){
        const track=MENTOR_TRACKS.includes(body.path)?body.path:'';
        if(!track)return send(res,400,{error:'Track Mentor wajib dipilih'});
        const application=normalizeMentorApplication(body.mentor_application);
        const rows=await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,status,path,notification_preferences`),profile=rows&&rows[0];
        if(!profile)return send(res,404,{error:'Profil Mentor tidak ditemukan'});
        const listed=await adminFetch('/auth/v1/admin/users?page=1&per_page=1000'),authUser=(listed.users||listed||[]).find(user=>user.id===id);
        if(!authUser)return send(res,404,{error:'Akun login Mentor tidak ditemukan'});
        const fullName=clean(body.full_name||profile.full_name,120),email=clean(body.email||profile.email,254).toLowerCase();
        if(fullName.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,400,{error:'Nama dan email Mentor wajib valid'});
        const prefs=Object.assign({},profile.notification_preferences||{},{in_app:true,email:true,deadline:true,review:true,session:true,profile_bio:application.bio});
        await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({email,email_confirm:true,user_metadata:Object.assign({},authUser.user_metadata||{},{full_name:fullName,initials:initials(fullName),path:track,role:'mentor',requested_role:'mentor',profile_completed:true,registration_decision:'approved',registration_decided_at:new Date().toISOString(),mentor_application:application,completed_by_fasil:true})})});
        let unpaired=0;
        if(profile.path!==track){const assigned=await adminFetch(`/rest/v1/profiles?role=eq.mentee&mentor_id=eq.${encodeURIComponent(id)}&select=id,path`);for(const mentee of assigned||[]){if(mentee.path!==track){await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(mentee.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({mentor_id:null,updated_at:new Date().toISOString()})});unpaired++;}}}
        const updated=await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({email,full_name:fullName,initials:initials(fullName),role:'mentor',status:'active',path:track,mentee_number:null,mentor_id:null,onboarding_completed:true,notification_preferences:prefs,updated_at:new Date().toISOString()})});
        const paired=body.auto_pair!==false?await pairUnassignedByTrack(track,id,auth.user.id):0;
        await adminFetch('/rest/v1/audit_logs',{method:'POST',body:JSON.stringify({actor_id:auth.user.id,action:'mentor.profile_admin_complete',entity_type:'profile',entity_id:id,detail:{track,paired,unpaired}})});
        return send(res,200,{ok:true,approved:true,paired,unpaired,profile:updated&&updated[0]});
      }
      if (['approve_registration', 'reject_registration'].includes(body.action)) {
        const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,status,path,mentee_number`);
        const applicant = rows && rows[0];
        if (!applicant || applicant.status !== 'invited') return send(res, 409, { error: 'Pendaftaran ini sudah diproses' });
        const listed = await adminFetch('/auth/v1/admin/users?page=1&per_page=1000');
        const authUser = (listed.users || listed || []).find(user => user.id === id);
        const metadata = authUser && authUser.user_metadata || {};
        const requestedRole = ['mentee', 'mentor'].includes(metadata.requested_role) ? metadata.requested_role : 'mentee';
        if (body.action === 'approve_registration' && requestedRole === 'mentor') {
          const application = metadata.mentor_application;
          if (!mentorApplicationComplete(application)) return send(res, 400, { error: 'Form calon mentor belum lengkap' });
        }
        const approved = body.action === 'approve_registration';
        const mentorTrack=MENTOR_TRACKS.includes(applicant.path)?applicant.path:'Career Path';
        const patch = approved
          ? { status:'active', role:requestedRole, path:requestedRole === 'mentor' ? mentorTrack : applicant.path, updated_at:new Date().toISOString() }
          : { status:'suspended', discipline_note:String(body.note || 'Pendaftaran belum dapat disetujui').slice(0,1000), updated_at:new Date().toISOString() };
        if (approved && requestedRole === 'mentee' && !applicant.mentee_number) patch.mentee_number = await nextMenteeNumber();
        await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify(patch) });
        await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify({ ban_duration:approved ? 'none' : '876000h', user_metadata:Object.assign({}, metadata, { role:approved ? requestedRole : metadata.role, profile_completed:approved, registration_decision:approved ? 'approved' : 'rejected', registration_decided_at:new Date().toISOString() }) }) });
        const paired=approved&&requestedRole==='mentor'?await pairUnassignedByTrack(mentorTrack,id,auth.user.id):0;
        const notification = { type:'registration', title:approved ? 'Pendaftaran disetujui' : 'Pendaftaran belum disetujui', body:approved ? `Akses ${requestedRole === 'mentor' ? 'mentor' : 'mentee'} kamu sudah aktif.` : patch.discipline_note, href:approved ? (requestedRole === 'mentor' ? 'mentor-dashboard.html' : 'mentee-dashboard.html') : 'login.html' };
        const notices = await adminFetch('/rest/v1/notifications', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(Object.assign({ user_id:id, delivery:{ in_app:'sent', email:'queued' } }, notification)) }).catch(() => []);
        const delivery = await deliverEmail(applicant, notification, notices[0] && notices[0].id).catch(error => ({ status:'failed', reason:error.message }));
        if (notices[0]) await adminFetch(`/rest/v1/notifications?id=eq.${encodeURIComponent(notices[0].id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:delivery.status } }) }).catch(() => null);
        await adminFetch('/rest/v1/audit_logs', { method:'POST', body:JSON.stringify({ actor_id:auth.user.id, action:approved ? 'registration.approve' : 'registration.reject', entity_type:'profile', entity_id:id, detail:{ requested_role:requestedRole, reason:approved ? null : patch.discipline_note } }) });
        return send(res, 200, { ok:true, status:patch.status, role:approved ? requestedRole : applicant.role, paired });
      }
      if (body.action && ['record_absence', 'correct_absence', 'lock', 'unlock', 'drop', 'restore'].includes(body.action)) {
        const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,status,absence_count,warning_level,discipline_note`);
        const participant = rows && rows[0];
        if (!participant || participant.role !== 'mentee') return send(res, 404, { error: 'Mentee tidak ditemukan' });
        const currentAbsences = Math.max(0, Number(participant.absence_count || 0));
        const currentLevel = Math.max(0, Number(participant.warning_level || 0));
        const profilePatch = {
          discipline_note: String(body.note || participant.discipline_note || '').slice(0, 1000),
          discipline_updated_at: new Date().toISOString(),
          discipline_updated_by: auth.user.id,
          updated_at: new Date().toISOString()
        };
        let notification = null;
        if (body.action === 'record_absence') {
          profilePatch.absence_count = Math.min(99, currentAbsences + 1);
          profilePatch.warning_level = Math.min(3, profilePatch.absence_count);
          if (profilePatch.warning_level >= 3) profilePatch.status = 'suspended';
          notification = { type: 'attendance_warning', title: profilePatch.warning_level >= 3 ? 'Akun terkunci karena ketidakhadiran' : `Peringatan ${profilePatch.warning_level}`, body: `Ketidakhadiran kamu tercatat ${profilePatch.absence_count} kali. ${profilePatch.warning_level >= 3 ? 'Akun dikunci; hubungi panitia.' : 'Hubungi panitia bila ada kekeliruan.'}`, href: profilePatch.warning_level >= 3 ? 'login.html' : 'mentee-dashboard.html' };
        } else if (body.action === 'correct_absence') {
          profilePatch.absence_count = Math.max(0, currentAbsences - 1);
          profilePatch.warning_level = Math.min(2, profilePatch.absence_count);
        } else if (body.action === 'lock') {
          profilePatch.status = 'suspended';
          profilePatch.warning_level = 3;
          notification = { type: 'account_locked', title: 'Akun dikunci panitia', body: profilePatch.discipline_note || 'Hubungi panitia untuk informasi lebih lanjut.', href: 'login.html' };
        } else if (body.action === 'unlock' || body.action === 'restore') {
          profilePatch.status = 'active';
          profilePatch.warning_level = Math.min(2, currentAbsences);
          notification = { type: 'account_restored', title: 'Akun kembali aktif', body: 'Kamu sudah dapat mengikuti kegiatan fellowship kembali.', href: 'mentee-dashboard.html' };
        } else if (body.action === 'drop') {
          if (currentAbsences < 3) return send(res, 400, { error: 'Status gugur hanya dapat diberikan setelah 3 kali tidak hadir' });
          if (body.confirmation !== 'GUGUR') return send(res, 400, { error: 'Konfirmasi GUGUR tidak valid' });
          profilePatch.status = 'dropped';
          profilePatch.warning_level = 4;
          notification = { type: 'participant_dropped', title: 'Status kepesertaan: gugur', body: profilePatch.discipline_note || 'Tercatat tidak mengikuti kegiatan sebanyak 3 kali.', href: 'login.html' };
        }
        const updated = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(profilePatch) });
        if (profilePatch.status) {
          await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ ban_duration: profilePatch.status === 'active' ? 'none' : '876000h' }) });
        }
        if (notification) {
          const notices = await adminFetch('/rest/v1/notifications', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(Object.assign({ user_id: id, delivery: { in_app: 'sent', email:'queued' } }, notification)) });
          await deliverEmail(participant, notification, notices[0] && notices[0].id);
        }
        const actionMap = { record_absence:profilePatch.warning_level === 1?'warning_1':profilePatch.warning_level === 2?'warning_2':'lock', correct_absence:'note', lock:'lock', unlock:'unlock', drop:'drop', restore:'restore' };
        await adminFetch('/rest/v1/discipline_actions', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ mentee_id:id, action:actionMap[body.action], from_level:currentLevel, to_level:profilePatch.warning_level === undefined ? currentLevel : profilePatch.warning_level, reason:String(body.note || `Tindakan ${body.action} oleh panitia`).slice(0,1000), actor_id:auth.user.id }) });
        await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: `discipline.${body.action}`, entity_type: 'profile', entity_id: id, detail: profilePatch }) });
        return send(res, 200, { ok: true, profile: updated && updated[0] });
      }
      const profilePatch = {};
      ['full_name', 'role', 'status', 'path', 'mentor_id', 'cohort_id', 'mentee_number', 'absence_count', 'discipline_note'].forEach(k => { if (body[k] !== undefined) profilePatch[k] = body[k]; });
      if (body.status && !['invited', 'active', 'suspended', 'graduated', 'dropped'].includes(body.status)) return send(res, 400, { error: 'Status akun tidak valid' });
      const authPatch = {};
      const currentRows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,status,path,mentee_number`);
      const currentProfile = currentRows && currentRows[0];
      const listed = await adminFetch('/auth/v1/admin/users?page=1&per_page=1000');
      const currentAuthUser = (listed.users || listed || []).find(user => user.id === id);
      const currentMetadata = currentAuthUser && currentAuthUser.user_metadata || {};
      const mentorProfileRequired = body.role === 'mentor' && !mentorApplicationComplete(currentMetadata.mentor_application);
      const notifyMentorRequirement = mentorProfileRequired && (currentProfile.role !== 'mentor' || currentProfile.status !== 'invited' || currentMetadata.requested_role !== 'mentor');
      if (mentorProfileRequired) {
        profilePatch.role = 'mentor'; profilePatch.status = 'invited'; profilePatch.path = MENTOR_TRACKS.includes(body.path) ? body.path : (MENTOR_TRACKS.includes(currentProfile.path) ? currentProfile.path : 'Career Path'); profilePatch.onboarding_completed = false; profilePatch.mentee_number = null; profilePatch.mentor_id = null;
        authPatch.user_metadata = Object.assign({}, currentMetadata, { requested_role:'mentor', registration_decision:'pending', role:'mentee', profile_completed:false });
      } else if (body.role === 'mentor') {
        profilePatch.mentee_number = null; profilePatch.mentor_id = null;
        authPatch.user_metadata = Object.assign({}, currentMetadata, { requested_role:'mentor', role:'mentor', profile_completed:true, registration_decision:profilePatch.status === 'active' || body.status === 'active' ? 'approved' : currentMetadata.registration_decision });
      } else if (body.role && body.role !== 'mentor' && currentProfile && currentProfile.role !== body.role) {
        if (body.role === 'mentee') profilePatch.mentee_number = currentProfile.mentee_number || await nextMenteeNumber();
        authPatch.user_metadata = Object.assign({}, currentMetadata, { requested_role:body.role, role:body.role });
      }
      if (body.email) {
        const normalizedEmail = String(body.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) return send(res, 400, { error:'Email akun tidak valid' });
        authPatch.email = normalizedEmail;
        authPatch.email_confirm = true;
        profilePatch.email = normalizedEmail;
      }
      if (body.password) authPatch.password = body.password;
      if (body.status) authPatch.ban_duration = ['suspended', 'dropped'].includes(profilePatch.status || body.status) ? '876000h' : 'none';
      if (Object.keys(authPatch).length) await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(authPatch) });
      if (Object.keys(profilePatch).length) await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(profilePatch) });
      if (notifyMentorRequirement && currentProfile.email) {
        const notification = { type:'registration', title:'Lengkapi profil Mentor', body:'Akses dashboard Mentor akan dibuka setelah formulir profesional dilengkapi dan disetujui Fasil.', href:'profile-setup.html' };
        const notices = await adminFetch('/rest/v1/notifications', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(Object.assign({ user_id:id, delivery:{ in_app:'sent', email:'queued' } }, notification)) }).catch(() => []);
        const delivery = await deliverEmail(currentProfile, notification, notices[0] && notices[0].id).catch(error => ({ status:'failed', reason:error.message }));
        if (notices[0]) await adminFetch(`/rest/v1/notifications?id=eq.${encodeURIComponent(notices[0].id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:delivery.status } }) }).catch(() => null);
      }
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.update', entity_type: 'profile', entity_id: id, detail: profilePatch }) });
      return send(res, 200, { ok: true, mentor_profile_required: mentorProfileRequired });
    }
    if (id === auth.user.id) return send(res, 400, { error:'Fasil tidak dapat menghapus akunnya sendiri' });
    const deleteRows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,status`);
    const deleteTarget = deleteRows && deleteRows[0];
    if (!deleteTarget) return send(res, 404, { error:'Akun yang akan dihapus tidak ditemukan' });
    if (deleteTarget.role === 'admin') {
      const admins = await adminFetch('/rest/v1/profiles?role=eq.admin&status=eq.active&select=id');
      if ((admins || []).length <= 1) return send(res, 400, { error:'Fasil aktif terakhir tidak boleh dihapus' });
    }
    await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.soft_delete', entity_type: 'profile', entity_id: id, detail:{ email:deleteTarget.email, full_name:deleteTarget.full_name, role:deleteTarget.role } }) });
    const detach = (table, column) => adminFetch(`/rest/v1/${table}?${column}=eq.${encodeURIComponent(id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ [column]:null }) }).catch(() => null);
    await Promise.all([
      detach('profiles','mentor_id'), detach('profiles','discipline_updated_by'), detach('program_settings','updated_by'),
      detach('assignments','created_by'), detach('reviews','reviewer_id'), detach('review_history','reviewer_id'),
      detach('task_discussions','author_id'), detach('audit_logs','actor_id'), detach('error_logs','user_id'),
      detach('backup_snapshots','created_by'), detach('program_events','created_by'), detach('attendance_sessions','created_by'),
      detach('attendance_records','recorded_by'), detach('discipline_actions','actor_id'), detach('certificates','issued_by')
    ]);
    await adminFetch(`/rest/v1/mentor_sessions?or=(mentor_id.eq.${encodeURIComponent(id)},mentee_id.eq.${encodeURIComponent(id)})`, { method:'DELETE', headers:{ Prefer:'return=minimal' } }).catch(() => null);
    await adminFetch(`/rest/v1/mentor_notes?or=(mentor_id.eq.${encodeURIComponent(id)},mentee_id.eq.${encodeURIComponent(id)})`, { method:'DELETE', headers:{ Prefer:'return=minimal' } }).catch(() => null);
    await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-photos/${id}/avatar.jpg`, { method:'DELETE', headers:{ apikey:process.env.SUPABASE_SECRET_KEY, Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => null);
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}?should_soft_delete=true`, { method: 'DELETE' });
    return send(res, 200, { ok: true, recoverable: false });
  } catch (error) {
    const message = String(error && error.message || 'Permintaan gagal');
    if (/already|registered|exist|duplicate/i.test(message)) return send(res, 409, { error:'Email ini sudah terdaftar. Gunakan email lain atau kelola akun yang sudah ada.' });
    return send(res, 500, { error: message });
  }
};
