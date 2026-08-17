const { send, adminFetch, currentUser, requireRole, method, SUPABASE_URL, PUBLISHABLE } = require('./_lib');
const googleLogin = require('./_google-login');
const { deliverEmail } = require('./_email');

function clean(value, max) { return String(value || '').trim().slice(0, max); }
function initials(name) { return clean(name, 120).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
const MENTOR_EXPERTISE = ['Career Development','CV & LinkedIn','Interview Skills','Salary Negotiation','Personal Branding','Entrepreneurship','Business Model','Marketing','Product Development','Finance & Fundraising','Leadership','Mental Health','Tech & Digital','Creative Industry','Social Impact'];
const MENTOR_TRACKS = ['Career Path','Entrepreneur Path'];
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
  const path = (requestedRole === 'mentor' ? MENTOR_TRACKS : ['Career Path','Entrepreneur Path']).includes(body.path) ? body.path : '';
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
  const rows = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,status,path`);
  const profile = rows && rows[0];
  if (!profile || profile.role !== 'mentor') return send(res, 403, { error:'Akun ini bukan mentor' });
  if (mentorApplicationComplete(user.user_metadata && user.user_metadata.mentor_application)) return send(res, 200, { complete:true });
  await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ status:'invited', onboarding_completed:false, path:MENTOR_TRACKS.includes(profile.path)?profile.path:'Career Path', updated_at:new Date().toISOString() }) });
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
  } else if (profile.role === 'mentor') {
    path = clean(req.body && req.body.path, 40);
    if (!MENTOR_TRACKS.includes(path)) return send(res, 400, { error:'Track Mentor tidak valid' });
    if (path !== profile.path) {
      const assigned = await adminFetch(`/rest/v1/profiles?role=eq.mentee&mentor_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      if (assigned && assigned.length) return send(res, 409, { error:'Track tidak dapat diubah karena masih memiliki mentee. Hubungi Fasil untuk memindahkan pairing.' });
    }
  }
  const prefs = req.body && req.body.notification_preferences || {};
  const bio = clean(req.body && req.body.bio, 500);
  let avatarUrl = clean(user.user_metadata && user.user_metadata.avatar_url, 1000);
  const avatarData = String(req.body && req.body.avatar_data || '');
  if (avatarData) avatarUrl = await uploadProfilePhoto(user.id, avatarData);
  if (req.body && req.body.remove_avatar === true) { await deleteProfilePhoto(user.id); avatarUrl = ''; }
  const notificationPreferences = {
    in_app:true,
    email:prefs.email !== false,
    deadline:prefs.deadline !== false,
    review:prefs.review !== false,
    session:prefs.session !== false,
    profile_bio:bio,
    avatar_url:avatarUrl
  };
  const patch = { full_name:fullName, initials:initials(fullName), path, notification_preferences:notificationPreferences, updated_at:new Date().toISOString() };
  const updated = await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method:'PATCH', headers:{ Prefer:'return=representation' }, body:JSON.stringify(patch) });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body:JSON.stringify({ user_metadata:Object.assign({}, user.user_metadata || {}, { full_name:fullName, initials:patch.initials, path, bio, avatar_url:avatarUrl }) }) });
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:user.id, action:'profile.self_update', entity_type:'profile', entity_id:user.id, detail:{ full_name:fullName, path, bio_updated:true, avatar_updated:Boolean(avatarData || (req.body && req.body.remove_avatar)) } }) }).catch(() => null);
  return send(res, 200, { profile:Object.assign({}, updated && updated[0], { bio, avatar_url:avatarUrl }) });
}

async function uploadProfilePhoto(userId, dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Format foto profil tidak didukung');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Ukuran foto profil maksimal 2MB');
  const headers = { apikey:process.env.SUPABASE_SECRET_KEY, Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}` };
  const bucketUrl = `${process.env.SUPABASE_URL}/storage/v1/bucket/profile-photos`;
  let bucket = await fetch(bucketUrl, { headers });
  if (!bucket.ok) {
    bucket = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, { method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, headers), body:JSON.stringify({ id:'profile-photos', name:'profile-photos', public:true, file_size_limit:2097152, allowed_mime_types:['image/jpeg','image/png','image/webp'] }) });
  }
  if (!bucket.ok) throw new Error('Penyimpanan foto profil belum tersedia');
  const objectPath = `${userId}/avatar.jpg`;
  const upload = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-photos/${objectPath}`, { method:'POST', headers:Object.assign({ 'Content-Type':match[1], 'x-upsert':'true' }, headers), body:bytes });
  if (!upload.ok) throw new Error('Foto profil gagal diunggah');
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/profile-photos/${objectPath}?v=${Date.now()}`;
}

async function deleteProfilePhoto(userId) {
  const headers = { apikey:process.env.SUPABASE_SECRET_KEY, Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}` };
  await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/profile-photos/${userId}/avatar.jpg`, { method:'DELETE', headers }).catch(() => null);
}

async function updateOwnPassword(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error:'Sesi pengguna tidak valid atau berakhir' });
  const password = String(req.body && req.body.password || '');
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return send(res, 400, { error:'Password minimal 8 karakter serta berisi huruf besar, huruf kecil, dan angka' });
  await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body:JSON.stringify({ password, user_metadata:Object.assign({}, user.user_metadata || {}, { has_password:true }) }) });
  await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ actor_id:user.id, action:'profile.password_update', entity_type:'profile', entity_id:user.id, detail:{ self_service:true } }) }).catch(() => null);
  return send(res, 200, { ok:true });
}

function safeHttps(value) { const input=clean(value,1200);if(!input)return'';try{const url=new URL(input);return url.protocol==='https:'?url.toString():'';}catch(_){return'';} }
async function uploadAnnouncementImage(id, dataUrl) {
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl||''));
  if(!match)throw new Error('Format poster harus JPG, PNG, atau WebP');
  const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>4*1024*1024)throw new Error('Ukuran poster maksimal 4MB');
  const headers={apikey:process.env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}`};
  let bucket=await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket/program-assets`,{headers});
  if(!bucket.ok)bucket=await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},headers),body:JSON.stringify({id:'program-assets',name:'program-assets',public:true,file_size_limit:4194304,allowed_mime_types:['image/jpeg','image/png','image/webp']})});
  if(!bucket.ok)throw new Error('Penyimpanan poster program belum tersedia');
  const ext=match[1]==='image/png'?'png':match[1]==='image/webp'?'webp':'jpg',objectPath=`announcements/${id}.${ext}`;
  const upload=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/program-assets/${objectPath}`,{method:'POST',headers:Object.assign({'Content-Type':match[1],'x-upsert':'true'},headers),body:bytes});
  if(!upload.ok)throw new Error('Poster gagal diunggah');
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/program-assets/${objectPath}?v=${Date.now()}`;
}
async function programFlags() { const rows=await adminFetch('/rest/v1/program_settings?id=eq.1&select=feature_flags');return rows&&rows[0]&&rows[0].feature_flags||{}; }
async function saveProgramFlags(flags, actorId) { await adminFetch('/rest/v1/program_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({feature_flags:flags,updated_by:actorId,updated_at:new Date().toISOString()})}); }
function cleanAnnouncement(source, existing) {
  source=source||{};existing=existing||{};const id=clean(source.id||existing.id||crypto.randomUUID(),80).replace(/[^a-zA-Z0-9_-]/g,'');
  const item={id,title:clean(source.title,140),body:clean(source.body,1200),image_url:safeHttps(source.image_url||existing.image_url),cta_url:safeHttps(source.cta_url||source.link_url||existing.cta_url||existing.link_url),cta_label:clean(source.cta_label,40),starts_at:clean(source.starts_at||source.start_at,40)||null,ends_at:clean(source.ends_at||source.end_at,40)||null,is_active:source.is_active!==false,priority:Math.max(0,Math.min(999,Number(source.priority)||0)),updated_at:new Date().toISOString()};
  if(!item.title)throw new Error('Judul informasi wajib diisi');
  if(item.starts_at&&item.ends_at&&new Date(item.ends_at)<=new Date(item.starts_at))throw new Error('Waktu selesai harus setelah waktu mulai');
  return item;
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    if (req.body && req.body.action === 'google_login') return googleLogin(req, res);
    if (req.body && req.body.action === 'complete_google_profile') return completeGoogleProfile(req, res);
    if (req.body && req.body.action === 'prepare_incomplete_mentor') return prepareIncompleteMentor(req, res);
    if (req.body && req.body.action === 'profile_context') return profileContext(req, res);
    if (req.body && req.body.action === 'profile_update') return updateOwnProfile(req, res);
    if (req.body && req.body.action === 'profile_password') return updateOwnPassword(req, res);
    if (req.body && req.body.action === 'announcements_list') {
      const user=await currentUser(req);if(!user)return send(res,401,{error:'Sesi tidak valid'});
      const rows=await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,status`),profile=rows&&rows[0];if(!profile||profile.status!=='active')return send(res,403,{error:'Profil tidak aktif'});
      const flags=await programFlags(),all=Array.isArray(flags.announcements)?flags.announcements:[],now=Date.now();
      const announcements=profile.role==='admin'&&req.body.admin===true?all:all.filter(item=>item.is_active!==false&&(!(item.starts_at||item.start_at)||new Date(item.starts_at||item.start_at).getTime()<=now)&&(!(item.ends_at||item.end_at)||new Date(item.ends_at||item.end_at).getTime()>=now));
      return send(res,200,{announcements:announcements.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)||new Date(b.updated_at)-new Date(a.updated_at))});
    }
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    const body = req.body || {};
    if(body.action==='pairings_data'){
      const profiles=await adminFetch('/rest/v1/profiles?role=in.(mentee,mentor)&select=id,email,full_name,role,status,path,initials,mentee_number,mentor_id&order=role.desc,path.asc,full_name.asc');
      return send(res,200,{mentees:(profiles||[]).filter(row=>row.role==='mentee'&&row.status==='active'),mentors:(profiles||[]).filter(row=>row.role==='mentor'&&row.status==='active')});
    }
    if(body.action==='pairings_save'){
      const profiles=await adminFetch('/rest/v1/profiles?role=in.(mentee,mentor)&status=eq.active&select=id,full_name,role,path,mentor_id'),mentees=new Map((profiles||[]).filter(row=>row.role==='mentee').map(row=>[row.id,row])),mentors=new Map((profiles||[]).filter(row=>row.role==='mentor').map(row=>[row.id,row]));
      let changed=0;for(const pair of Array.isArray(body.pairings)?body.pairings.slice(0,1000):[]){const mentee=mentees.get(String(pair.mentee_id||'')),mentor=pair.mentor_id?mentors.get(String(pair.mentor_id)):null;if(!mentee)continue;if(mentor&&mentor.path!==mentee.path)return send(res,400,{error:`Track ${mentor.full_name} tidak cocok dengan ${mentee.full_name}`});const mentorId=mentor?mentor.id:null;if((mentee.mentor_id||null)!==mentorId){await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(mentee.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({mentor_id:mentorId,updated_at:new Date().toISOString()})});changed++;}}
      await adminFetch('/rest/v1/audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:auth.user.id,action:'pairing.manual_save',entity_type:'profile',detail:{changed}})}).catch(()=>null);return send(res,200,{ok:true,changed});
    }
    if(body.action==='pairings_auto'){
      const profiles=await adminFetch('/rest/v1/profiles?role=in.(mentee,mentor)&status=eq.active&select=id,full_name,role,path,mentor_id&order=created_at.asc'),mentees=(profiles||[]).filter(row=>row.role==='mentee'&&!row.mentor_id),mentors=(profiles||[]).filter(row=>row.role==='mentor'),loads={};(profiles||[]).filter(row=>row.role==='mentee'&&row.mentor_id).forEach(row=>loads[row.mentor_id]=(loads[row.mentor_id]||0)+1);let paired=0;
      for(const mentee of mentees){const eligible=mentors.filter(mentor=>mentor.path===mentee.path).sort((a,b)=>(loads[a.id]||0)-(loads[b.id]||0)||a.full_name.localeCompare(b.full_name));if(!eligible.length)continue;const mentor=eligible[0];await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(mentee.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({mentor_id:mentor.id,updated_at:new Date().toISOString()})});loads[mentor.id]=(loads[mentor.id]||0)+1;paired++;}
      await adminFetch('/rest/v1/audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:auth.user.id,action:'pairing.auto_balance',entity_type:'profile',detail:{paired}})}).catch(()=>null);return send(res,200,{ok:true,paired});
    }
    if(body.action==='announcement_save'){
      const source=body.announcement&&typeof body.announcement==='object'?body.announcement:{},flags=await programFlags(),rows=Array.isArray(flags.announcements)?flags.announcements.slice():[],index=rows.findIndex(row=>row.id===source.id),existing=index>-1?rows[index]:null,item=cleanAnnouncement(source,existing);
      if(body.image_data)item.image_url=await uploadAnnouncementImage(item.id,body.image_data);
      if(!item.body&&!item.image_url)return send(res,400,{error:'Isi informasi atau poster wajib ditambahkan'});
      if(index>-1)rows[index]=item;else rows.push(item);flags.announcements=rows.slice(-50);await saveProgramFlags(flags,auth.user.id);
      await adminFetch('/rest/v1/audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:auth.user.id,action:'announcement.save',entity_type:'program_settings',entity_id:item.id,detail:{title:item.title,is_active:item.is_active}})}).catch(()=>null);
      return send(res,200,{ok:true,announcement:item,announcements:flags.announcements});
    }
    if(body.action==='announcement_delete'){
      const announcementId=clean(body.id,80),flags=await programFlags(),rows=Array.isArray(flags.announcements)?flags.announcements:[],existing=rows.find(row=>row.id===announcementId);flags.announcements=rows.filter(row=>row.id!==announcementId);await saveProgramFlags(flags,auth.user.id);
      if(existing&&existing.image_url){const match=/\/program-assets\/(announcements\/[^?]+)/.exec(existing.image_url);if(match)await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/program-assets/${match[1]}`,{method:'DELETE',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}`}}).catch(()=>null);}
      await adminFetch('/rest/v1/audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:auth.user.id,action:'announcement.delete',entity_type:'program_settings',entity_id:announcementId,detail:{title:existing&&existing.title}})}).catch(()=>null);
      return send(res,200,{ok:true,announcements:flags.announcements});
    }
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
      const currentSettings = await adminFetch('/rest/v1/program_settings?id=eq.1&select=feature_flags');
      const currentFlags = currentSettings && currentSettings[0] && currentSettings[0].feature_flags || {};
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
        feature_flags: Object.assign({}, currentFlags, body.feature_flags && typeof body.feature_flags === 'object' ? body.feature_flags : {}),
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
