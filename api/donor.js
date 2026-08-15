const crypto = require('crypto');
const { send, adminFetch, requireRole, method } = require('./_lib');

const SECRET = process.env.DONOR_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY;
const nowIso = () => new Date().toISOString();
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const number = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(min, Number(value) || 0));
const id = value => clean(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const b64 = value => Buffer.from(value).toString('base64url');
const signingSecret = () => { if (!SECRET) throw new Error('Konfigurasi keamanan portal donor belum tersedia'); return SECRET; };
const sign = value => crypto.createHmac('sha256', signingSecret()).update(value).digest('base64url');
const codeHash = code => crypto.createHmac('sha256', signingSecret()).update(String(code || '').trim()).digest('hex');

function donorToken(donor) {
  const payload = b64(JSON.stringify({ id:donor.id, email:donor.email, exp:Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload)}`;
}
function verifyDonor(req) {
  const raw = clean(req.headers.authorization, 500).replace(/^Donor\s+/i, '');
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || signature !== sign(payload)) return null;
  try { const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); return data.exp > Date.now() ? data : null; } catch (_) { return null; }
}

function defaultPortal(programName) {
  return {
    version:1,
    updated_at:nowIso(),
    programs:[{
      id:'fbf-2026', code:'FBF', name:programName || 'Future Builders Fellowship', name_en:'Future Builders Fellowship',
      status:'active', data_status:'draft', source:'ftg', period:'Januari–Juni 2026', period_en:'January–June 2026', location:'Indonesia',
      summary:'Program pengembangan pemuda melalui Design Thinking, mentoring karier, dan jalur kewirausahaan.',
      summary_en:'A youth development program combining Design Thinking, career mentoring, and entrepreneurship pathways.',
      sdgs:['SDG 4','SDG 8','SDG 10'], beneficiary_target:24,
      finance:{ currency:'IDR', contribution:100000000, spent:82000000, social_value:470000000, status:'draft', verified:false, note:'Angka awal dari rancangan donor; Fasil wajib memverifikasi sebelum publikasi.', note_en:'Initial dashboard figures; Fasil verification is required before publication.' },
      impact:{ beneficiaries:24, active_rate:92, average_progress:76, completion_rate:78, employed_or_business:9, jobs:6, businesses:3, volunteer_hours:360 },
      sroi:{ ratio:4.7, methodology:'Social Value International / SROI Network Standard', period:'Jan–Jun 2026', verified:false, sources:[{label:'Peningkatan pendapatan',label_en:'Income uplift',value:210000000},{label:'Kesiapan kerja',label_en:'Employment readiness',value:135000000},{label:'Usaha baru',label_en:'New ventures',value:85000000},{label:'Nilai relawan mentor',label_en:'Mentor volunteer value',value:40000000}], trend:[3.1,3.8,4.3,4.7] },
      csr:{ pillars:[
        {key:'people',title:'People Development',title_en:'People Development',score:92,detail:'Pengembangan kapasitas dan retensi peserta.',detail_en:'Participant capacity development and retention.'},
        {key:'prosperity',title:'Economic Empowerment',title_en:'Economic Empowerment',score:78,detail:'Kesiapan kerja dan pertumbuhan usaha.',detail_en:'Employment readiness and venture growth.'},
        {key:'planet',title:'Environmental Responsibility',title_en:'Environmental Responsibility',score:64,detail:'Aktivitas digital dan efisiensi sumber daya.',detail_en:'Digital delivery and resource efficiency.'},
        {key:'peace',title:'Good Governance',title_en:'Good Governance',score:86,detail:'Akuntabilitas, perlindungan, dan audit.',detail_en:'Accountability, safeguarding, and audit.'},
        {key:'partnership',title:'Partnership',title_en:'Partnership',score:88,detail:'Kolaborasi donor, mentor, dan komunitas.',detail_en:'Donor, mentor, and community collaboration.'}
      ]},
      esg:{ environment:64, social:90, governance:86, total:80, framework:'GRI Standards & ISO 26000', verified:false },
      beneficiaries:[], reports:[]
    }],
    donors:[], ratings:[], messages:[]
  };
}

async function loadState() {
  const rows = await adminFetch('/rest/v1/program_settings?id=eq.1&select=program_name,feature_flags');
  const settings = rows && rows[0] || {};
  const flags = settings.feature_flags && typeof settings.feature_flags === 'object' ? settings.feature_flags : {};
  const portal = flags.donor_portal && typeof flags.donor_portal === 'object' ? flags.donor_portal : defaultPortal(settings.program_name);
  portal.programs = Array.isArray(portal.programs) ? portal.programs : [];
  portal.donors = Array.isArray(portal.donors) ? portal.donors : [];
  portal.ratings = Array.isArray(portal.ratings) ? portal.ratings : [];
  portal.messages = Array.isArray(portal.messages) ? portal.messages : [];
  return { portal, flags };
}
async function saveState(state, actorId, action) {
  const programIds=new Set(state.portal.programs.map(program=>program.id));
  const donorIds=new Set(state.portal.donors.map(donor=>donor.id));
  state.portal.ratings=state.portal.ratings.filter(row=>programIds.has(row.program_id)&&donorIds.has(row.donor_id));
  state.portal.messages=state.portal.messages.filter(row=>programIds.has(row.program_id)&&donorIds.has(row.donor_id));
  state.portal.updated_at = nowIso();
  const feature_flags = Object.assign({}, state.flags, { donor_portal:state.portal });
  await adminFetch('/rest/v1/program_settings?id=eq.1', { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ feature_flags, updated_by:actorId || null, updated_at:nowIso() }) });
  if (actorId) await adminFetch('/rest/v1/audit_logs', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ actor_id:actorId, action, entity_type:'donor_portal', detail:{ updated_at:state.portal.updated_at } }) }).catch(() => null);
}

function sanitizeProgram(input, existing={}) {
  const programId = id(input.id || existing.id || input.code || input.name) || `program-${Date.now()}`;
  const pillars = Array.isArray(input.csr && input.csr.pillars) ? input.csr.pillars.slice(0,5).map((p,index)=>({ key:id(p.key)||`pillar-${index+1}`, title:clean(p.title,80), title_en:clean(p.title_en,80), score:number(p.score,0,100), detail:clean(p.detail,500), detail_en:clean(p.detail_en,500) })) : (existing.csr && existing.csr.pillars || []);
  return {
    id:programId, code:clean(input.code || existing.code || programId,20).toUpperCase(), name:clean(input.name || existing.name,120), name_en:clean(input.name_en || input.name || existing.name_en,120),
    status:['draft','active','completed','archived'].includes(input.status)?input.status:(existing.status||'draft'), data_status:['draft','verified','audited'].includes(input.data_status)?input.data_status:(existing.data_status||'draft'), source:input.source==='ftg'?'ftg':'manual',
    period:clean(input.period,80), period_en:clean(input.period_en,80), location:clean(input.location,120), summary:clean(input.summary,1500), summary_en:clean(input.summary_en,1500), sdgs:Array.isArray(input.sdgs)?input.sdgs.slice(0,10).map(x=>clean(x,30)):[], beneficiary_target:number(input.beneficiary_target,0,10000000),
    finance:{ currency:clean(input.finance&&input.finance.currency||'IDR',8).toUpperCase(), contribution:number(input.finance&&input.finance.contribution), spent:number(input.finance&&input.finance.spent), social_value:number(input.finance&&input.finance.social_value), status:['draft','verified','audited'].includes(input.finance&&input.finance.status)?input.finance.status:((input.finance&&input.finance.verified)?'verified':(existing.finance&&existing.finance.status)||'draft'), verified:(input.finance&&input.finance.status)?input.finance.status!=='draft':Boolean(input.finance&&input.finance.verified), note:clean(input.finance&&input.finance.note,800), note_en:clean(input.finance&&input.finance.note_en,800) },
    impact:{ beneficiaries:number(input.impact&&input.impact.beneficiaries,0,10000000), active_rate:number(input.impact&&input.impact.active_rate,0,100), average_progress:number(input.impact&&input.impact.average_progress,0,100), completion_rate:number(input.impact&&input.impact.completion_rate,0,100), employed_or_business:number(input.impact&&input.impact.employed_or_business,0,10000000), jobs:number(input.impact&&input.impact.jobs,0,10000000), businesses:number(input.impact&&input.impact.businesses,0,10000000), volunteer_hours:number(input.impact&&input.impact.volunteer_hours,0,100000000) },
    sroi:{ ratio:number(input.sroi&&input.sroi.ratio,0,10000), methodology:clean(input.sroi&&input.sroi.methodology,300), period:clean(input.sroi&&input.sroi.period,80), verified:Boolean(input.sroi&&input.sroi.verified), sources:Array.isArray(input.sroi&&input.sroi.sources)?input.sroi.sources.slice(0,20).map(s=>({label:clean(s.label,100),label_en:clean(s.label_en,100),value:number(s.value)})):[], trend:Array.isArray(input.sroi&&input.sroi.trend)?input.sroi.trend.slice(0,12).map(x=>number(x,0,10000)):[] },
    csr:{ pillars }, esg:{ environment:number(input.esg&&input.esg.environment,0,100), social:number(input.esg&&input.esg.social,0,100), governance:number(input.esg&&input.esg.governance,0,100), total:number(input.esg&&input.esg.total,0,100), framework:clean(input.esg&&input.esg.framework,200), verified:Boolean(input.esg&&input.esg.verified) },
    beneficiaries:Array.isArray(input.beneficiaries)?input.beneficiaries.slice(0,500).map((b,index)=>({id:id(b.id)||`${programId}-beneficiary-${index+1}`,name:clean(b.name,120),initials:clean(b.initials,4),path:clean(b.path,80),status:clean(b.status,30)||'active',progress:number(b.progress,0,100),outcome:clean(b.outcome,500),bio:clean(b.bio,800),avatar_url:/^https:\/\//.test(String(b.avatar_url||''))?clean(b.avatar_url,1000):'',profile_id:/^[0-9a-f-]{36}$/i.test(String(b.profile_id||''))?b.profile_id:null,public_consent:Boolean(b.public_consent)})):[],
    reports:Array.isArray(input.reports)?input.reports.slice(0,100).map((r,index)=>({id:id(r.id)||`${programId}-report-${index+1}`,title:clean(r.title,160),title_en:clean(r.title_en,160),type:clean(r.type,40),period:clean(r.period,80),url:/^https:\/\//.test(String(r.url||''))?clean(r.url,1200):'',verified:Boolean(r.verified)})):[]
  };
}

async function hydratePrograms(programs) {
  const manualRecipients = programs.flatMap(program => (program.beneficiaries || []).map(person => ({
    id:person.profile_id || person.id, name:person.name, role:'mentee', path:person.path,
    initials:person.initials, avatar_url:person.avatar_url, program_id:program.id
  }))).filter(person => person.id && person.name);
  if (!programs.some(p => p.source === 'ftg')) return { programs, recipients:manualRecipients };
  const [profiles, assignments, targets, submissions, reviews, attendance, sessions] = await Promise.all([
    adminFetch('/rest/v1/profiles?status=eq.active&select=id,full_name,role,initials,path,mentee_number,notification_preferences,last_active_at,updated_at'),
    adminFetch('/rest/v1/assignments?select=id,status,deadline,created_at,updated_at'),
    adminFetch('/rest/v1/assignment_targets?select=assignment_id,mentee_id,assigned_at'),
    adminFetch('/rest/v1/submissions?select=id,assignment_id,mentee_id,status,submitted_at,updated_at'),
    adminFetch('/rest/v1/reviews?select=submission_id,score,decision,created_at,updated_at'),
    adminFetch('/rest/v1/attendance_records?select=mentee_id,status,checked_in_at,created_at'),
    adminFetch('/rest/v1/mentor_sessions?select=mentee_id,status,scheduled_at,completed_at,updated_at')
  ]).catch(() => [[],[],[],[],[],[],[]]);
  const safeProfiles=(profiles||[]).map(p=>{const prefs=p.notification_preferences||{};return {id:p.id,name:p.full_name,role:p.role,initials:p.initials,path:p.path,bio:clean(prefs.profile_bio,800),avatar_url:clean(prefs.avatar_url,1000),last_active_at:p.last_active_at,public_consent:prefs.donor_public===true};});
  const mentees=safeProfiles.filter(p=>p.role==='mentee'),menteeIds=new Set(mentees.map(p=>p.id)),published=(assignments||[]).filter(a=>a.status==='published'),publishedIds=new Set(published.map(a=>a.id));
  const liveSubmissions=(submissions||[]).filter(s=>menteeIds.has(s.mentee_id)&&publishedIds.has(s.assignment_id)&&s.submitted_at),submissionIds=new Set(liveSubmissions.map(s=>s.id));
  const liveReviews=(reviews||[]).filter(r=>submissionIds.has(r.submission_id)),reviewBySubmission=new Map(liveReviews.map(r=>[r.submission_id,r]));
  const validTargets=(targets||[]).filter(row=>menteeIds.has(row.mentee_id)&&publishedIds.has(row.assignment_id)),expectedPairs=new Set(validTargets.map(row=>`${row.assignment_id}:${row.mentee_id}`));
  liveSubmissions.forEach(row=>expectedPairs.add(`${row.assignment_id}:${row.mentee_id}`));
  const expectedSubmissions=expectedPairs.size||(published.length*mentees.length);
  const activityMentees=new Set(mentees.filter(p=>p.last_active_at&&Date.now()-new Date(p.last_active_at).getTime()<14*86400000).map(p=>p.id));
  liveSubmissions.filter(s=>Date.now()-new Date(s.updated_at||s.submitted_at).getTime()<14*86400000).forEach(s=>activityMentees.add(s.mentee_id));
  const pathCounts={};mentees.forEach(p=>{const key=clean(p.path||'Belum ditentukan',80);pathCounts[key]=(pathCounts[key]||0)+1;});
  const attendanceRows=(attendance||[]).filter(row=>menteeIds.has(row.mentee_id)),presentRows=attendanceRows.filter(row=>row.status==='present'||row.status==='late');
  const scores=liveReviews.map(r=>number(r.score,0,100)),turnarounds=liveSubmissions.map(s=>{const review=reviewBySubmission.get(s.id);return review&&review.updated_at&&s.submitted_at?Math.max(0,(new Date(review.updated_at)-new Date(s.submitted_at))/3600000):null;}).filter(v=>v!==null&&Number.isFinite(v));
  const assignmentById=new Map(published.map(a=>[a.id,a])),onTime=liveSubmissions.filter(s=>{const a=assignmentById.get(s.assignment_id);return !a||!a.deadline||new Date(s.submitted_at)<=new Date(a.deadline);}).length;
  const weekMs=7*86400000,weekStart=new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const activityTrend=Array.from({length:6},(_,index)=>{const start=new Date(weekStart.getTime()-(5-index)*weekMs),end=new Date(start.getTime()+weekMs);return{label:`W${index+1}`,value:liveSubmissions.filter(s=>{const at=new Date(s.submitted_at);return at>=start&&at<end;}).length,start:start.toISOString().slice(0,10)};});
  const hydrated=programs.map(program=>{if(program.source!=='ftg')return program;const copy=JSON.parse(JSON.stringify(program)),submittedCount=liveSubmissions.length,reviewedCount=liveReviews.length,approvedCount=liveReviews.filter(r=>r.decision==='approved').length,revisionCount=liveReviews.filter(r=>r.decision==='revision').length,completion=expectedSubmissions?Math.round(submittedCount/expectedSubmissions*100):0;copy.impact.beneficiaries=mentees.length||copy.impact.beneficiaries;copy.impact.active_rate=mentees.length?Math.round(activityMentees.size/mentees.length*100):copy.impact.active_rate;copy.impact.completion_rate=Math.min(100,completion);copy.impact.average_progress=Math.min(100,completion);copy.analytics={source:'live_lms',synced_at:new Date().toISOString(),assignments:{published:published.length,expected:expectedSubmissions,submitted:submittedCount,reviewed:reviewedCount,approved:approvedCount,revision:revisionCount,pending_review:Math.max(0,submittedCount-reviewedCount),on_time_rate:submittedCount?Math.round(onTime/submittedCount*100):0},quality:{average_score:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0,review_turnaround_hours:turnarounds.length?Math.round(turnarounds.reduce((a,b)=>a+b,0)/turnarounds.length):0},engagement:{active_14d:activityMentees.size,attendance_rate:attendanceRows.length?Math.round(presentRows.length/attendanceRows.length*100):0,attendance_records:attendanceRows.length,mentoring_completed:(sessions||[]).filter(s=>menteeIds.has(s.mentee_id)&&s.status==='completed').length,mentoring_scheduled:(sessions||[]).filter(s=>menteeIds.has(s.mentee_id)&&s.status==='scheduled').length},paths:Object.entries(pathCounts).map(([label,value])=>({label,value})),activity_trend:activityTrend};copy.beneficiaries=mentees.map((p,index)=>{const assigned=validTargets.filter(t=>t.mentee_id===p.id).length||published.length,done=liveSubmissions.filter(s=>s.mentee_id===p.id).length;return{id:`ftg-${p.id}`,profile_id:p.id,name:p.name,initials:p.initials,path:p.path,status:activityMentees.has(p.id)?'active':'inactive',progress:assigned?Math.min(100,Math.round(done/assigned*100)):0,outcome:'',bio:p.bio,avatar_url:p.avatar_url,public_consent:p.public_consent};});return copy;});
  const recipients=safeProfiles.filter(p=>p.role==='mentee'||p.role==='mentor').map(p=>({id:p.id,name:p.name,role:p.role,path:p.path,initials:p.initials,avatar_url:p.avatar_url}));
  manualRecipients.forEach(person=>{if(!recipients.some(existing=>existing.id===person.id))recipients.push(person);});
  return { programs:hydrated, recipients };
}

function publicProgram(program) {
  const copy=JSON.parse(JSON.stringify(program));
  copy.beneficiaries=(copy.beneficiaries||[]).map((person,index)=>{
    const consent=person.public_consent===true;
    return { id:`${String(copy.code || 'program').toLowerCase()}-participant-${index+1}`, name:consent?person.name:`Peserta ${copy.code || 'Program'} ${String(index+1).padStart(2,'0')}`, initials:consent?person.initials:`P${index+1}`, path:person.path, status:person.status, progress:person.progress, outcome:consent?person.outcome:'', bio:consent?person.bio:'', avatar_url:consent?person.avatar_url:'', public_consent:consent };
  });
  return copy;
}

module.exports = async function handler(req,res) {
  if(!method(req,res,['GET','POST']))return;
  try {
    const state=await loadState(),body=req.body||{};
    if(req.method==='POST'&&body.action==='login'){
      const email=clean(body.email,254).toLowerCase(),donor=state.portal.donors.find(d=>d.active!==false&&d.email===email&&d.code_hash===codeHash(body.code));
      if(!donor)return send(res,401,{error:'Email atau kode akses donor tidak sesuai'});
      return send(res,200,{token:donorToken(donor),donor:{id:donor.id,organization:donor.organization,contact_name:donor.contact_name,email:donor.email,program_ids:donor.program_ids||[]}});
    }
    const adminRequested=req.query&&String(req.query.admin||'')==='1';
    if(adminRequested){
      const auth=await requireRole(req,res,['admin']);if(!auth)return;
      if(req.method==='GET')return send(res,200,{portal:Object.assign({},state.portal,{donors:state.portal.donors.map(d=>Object.assign({},d,{code_hash:undefined}))})});
      if(body.action==='admin_program_save'){
        const existing=state.portal.programs.find(p=>p.id===id(body.program&&body.program.id));const saved=sanitizeProgram(body.program||{},existing||{});if(!saved.name)return send(res,400,{error:'Nama program wajib diisi'});const index=state.portal.programs.findIndex(p=>p.id===saved.id);if(index>-1)state.portal.programs[index]=saved;else state.portal.programs.push(saved);await saveState(state,auth.user.id,'donor.program_save');return send(res,200,{ok:true,program:saved});
      }
      if(body.action==='admin_program_delete'){
        const programId=id(body.id);state.portal.programs=state.portal.programs.filter(p=>p.id!==programId);state.portal.donors.forEach(d=>{d.program_ids=(d.program_ids||[]).filter(x=>x!==programId);});await saveState(state,auth.user.id,'donor.program_delete');return send(res,200,{ok:true});
      }
      if(body.action==='admin_donor_create'){
        const email=clean(body.email,254).toLowerCase(),organization=clean(body.organization,160),code=clean(body.code,80)||crypto.randomBytes(6).toString('base64url');if(!organization||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,400,{error:'Organisasi dan email donor valid wajib diisi'});if(state.portal.donors.some(d=>d.email===email))return send(res,409,{error:'Email donor sudah terdaftar'});const donor={id:crypto.randomUUID(),organization,contact_name:clean(body.contact_name,120),email,code_hash:codeHash(code),program_ids:Array.isArray(body.program_ids)?body.program_ids.filter(x=>state.portal.programs.some(p=>p.id===x)):[],active:true,created_at:nowIso()};state.portal.donors.push(donor);await saveState(state,auth.user.id,'donor.access_create');return send(res,201,{ok:true,donor:{id:donor.id,organization,email,program_ids:donor.program_ids},access_code:code});
      }
      if(body.action==='admin_donor_delete'){
        state.portal.donors=state.portal.donors.filter(d=>d.id!==clean(body.id,80));await saveState(state,auth.user.id,'donor.access_delete');return send(res,200,{ok:true});
      }
      return send(res,400,{error:'Aksi admin donor tidak dikenali'});
    }
    if(req.method==='GET'){
      const hydrated=await hydratePrograms(state.portal.programs.filter(program=>program.status==='active'||program.status==='completed'));
      return send(res,200,{programs:hydrated.programs.map(publicProgram),updated_at:new Date().toISOString(),public:true,refresh_seconds:60});
    }
    const token=verifyDonor(req);if(!token)return send(res,401,{error:'Sesi donor tidak valid atau sudah berakhir'});
    const donor=state.portal.donors.find(d=>d.id===token.id&&d.email===token.email&&d.active!==false);if(!donor)return send(res,403,{error:'Akses donor sudah dinonaktifkan'});
    const hydrated=await hydratePrograms(state.portal.programs.filter(p=>(donor.program_ids||[]).includes(p.id)&&p.status!=='archived'));
    if(body.action==='rating'){
      const programId=id(body.program_id),score=number(body.score,1,5);if(!(donor.program_ids||[]).includes(programId))return send(res,403,{error:'Program tidak tersedia untuk donor ini'});state.portal.ratings=state.portal.ratings.filter(r=>!(r.donor_id===donor.id&&r.program_id===programId));state.portal.ratings.push({id:crypto.randomUUID(),donor_id:donor.id,program_id:programId,score,comment:clean(body.comment,1000),created_at:nowIso()});await saveState(state,null,'donor.rating');return send(res,201,{ok:true});
    }
    if(body.action==='message'){
      const programId=id(body.program_id),recipientId=clean(body.recipient_id,80),message=clean(body.message,1200);if(!(donor.program_ids||[]).includes(programId)||!message)return send(res,400,{error:'Program, penerima, dan pesan wajib valid'});const recipient=hydrated.recipients.find(r=>r.id===recipientId)||(hydrated.programs.flatMap(p=>p.beneficiaries||[]).find(r=>r.profile_id===recipientId||r.id===recipientId));if(!recipient)return send(res,404,{error:'Penerima pesan tidak ditemukan'});const row={id:crypto.randomUUID(),donor_id:donor.id,program_id:programId,recipient_id:recipientId,recipient_name:recipient.name,recipient_role:recipient.role||'mentee',message,created_at:nowIso()};state.portal.messages.push(row);state.portal.messages=state.portal.messages.slice(-1000);await saveState(state,null,'donor.message');if(/^[0-9a-f-]{36}$/i.test(recipientId))await adminFetch('/rest/v1/notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:recipientId,type:'donor_message',title:`Pesan dari ${donor.organization}`,body:message,href:recipient.role==='mentor'?'mentor-dashboard.html':'mentee-dashboard.html',delivery:{in_app:'sent'}})}).catch(()=>null);return send(res,201,{ok:true,message:row});
    }
    return send(res,400,{error:'Aksi donor tidak dikenali'});
  }catch(error){return send(res,500,{error:error.message});}
};
