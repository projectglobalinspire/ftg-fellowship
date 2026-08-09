const { send, adminFetch, requireRole, method } = require('./_lib');

const xml = value => String(value == null ? '' : value).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
const cell = value => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${xml(value)}</Data></Cell>`;
const sheet = (name, rows) => `<Worksheet ss:Name="${xml(name.slice(0,31))}"><Table>${rows.map(r=>`<Row>${r.map(cell).join('')}</Row>`).join('')}</Table></Worksheet>`;

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    const [profiles, assignments, submissions, attendance, sessions] = await Promise.all([
      adminFetch('/rest/v1/profiles?select=id,email,full_name,role,status,warning_level,absence_count,google_email,mentor_id'),
      adminFetch('/rest/v1/assignments?select=id,title,deadline,status'),
      adminFetch('/rest/v1/submissions?select=id,assignment_id,mentee_id,status,submitted_at,reviews(score,decision,updated_at,reviewer_id)'),
      adminFetch('/rest/v1/attendance_records?select=mentee_id,status,checked_in_at,attendance_sessions(title,opens_at)'),
      adminFetch('/rest/v1/mentor_sessions?select=mentor_id,mentee_id,status,scheduled_at,completed_at')
    ]);
    const mentees=profiles.filter(p=>p.role==='mentee'), mentors=profiles.filter(p=>p.role==='mentor');
    const rows = [['Nama','Email','Status','Tugas diberikan','Tugas dikumpulkan','Tugas disetujui','Rata-rata nilai','Kehadiran','Peringatan','Google Drive','Sesi mentor selesai','Risiko']];
    const scoreRows=[['Mentee','Tugas','Status','Nilai','Keputusan','Dikumpulkan','Direview']];
    const attendanceRows=[['Mentee','Kegiatan','Waktu kegiatan','Status','Check-in']];
    const submissionRows=[['Mentee','Tugas','Deadline','Status','Waktu pengumpulan','Terlambat']];
    const riskRows=[['Mentee','Email','Status','Level peringatan','Risiko']];
    for (const p of mentees) {
      const subs = submissions.filter(s=>s.mentee_id===p.id), scores=subs.flatMap(s=>s.reviews||[]).map(r=>+r.score).filter(Number.isFinite);
      const att=attendance.filter(a=>a.mentee_id===p.id),present=att.filter(a=>['present','late','excused'].includes(a.status)).length;
      const completed=sessions.filter(s=>s.mentee_id===p.id&&s.status==='completed').length;
      const submitted=subs.filter(s=>s.submitted_at).length,approved=subs.filter(s=>s.status==='approved').length;
      const risk=[];if(p.warning_level>=2)risk.push('Kehadiran');if(submitted<assignments.length)risk.push('Tugas');if(!p.google_email)risk.push('Drive');if(scores.length&&scores.reduce((a,b)=>a+b,0)/scores.length<75)risk.push('Nilai');
      rows.push([p.full_name,p.email,p.status,assignments.length,submitted,approved,scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):'',att.length?`${Math.round(present/att.length*100)}%`:'100%',p.warning_level,p.google_email?'Terhubung':'Belum',completed,risk.join(', ')||'Aman']);
      if(risk.length)riskRows.push([p.full_name,p.email,p.status,p.warning_level,risk.join(', ')]);
      for(const s of subs){const task=assignments.find(a=>a.id===s.assignment_id)||{};const review=(s.reviews||[])[0]||{};scoreRows.push([p.full_name,task.title||s.assignment_id,s.status,review.score==null?'':review.score,review.decision||'',s.submitted_at||'',review.updated_at||'']);submissionRows.push([p.full_name,task.title||s.assignment_id,task.deadline||'',s.status,s.submitted_at||'',s.submitted_at&&task.deadline&&new Date(s.submitted_at)>new Date(task.deadline)?'Ya':'Tidak']);}
      for(const a of att)attendanceRows.push([p.full_name,(a.attendance_sessions||{}).title||'',(a.attendance_sessions||{}).opens_at||'',a.status,a.checked_in_at||'']);
    }
    const mentorRows=[['Mentor','Email','Mentee binaan','Sesi dijadwalkan','Sesi selesai','Review diberikan']];
    for(const m of mentors){const ms=sessions.filter(s=>s.mentor_id===m.id),assigned=mentees.filter(p=>p.mentor_id===m.id).length,reviews=submissions.flatMap(s=>s.reviews||[]).filter(r=>r.reviewer_id===m.id).length;mentorRows.push([m.full_name,m.email,assigned,ms.length,ms.filter(s=>s.status==='completed').length,reviews]);}
    const format=String(req.query.format||'xls');
    if(format==='json') return send(res,200,{rows,generated_at:new Date().toISOString()});
    if(format==='html'){
      res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Laporan Akhir FTG</title><style>body{font-family:Arial;padding:28px;color:#1e293b}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#1a5f4f;color:#fff}@media print{button{display:none}}</style></head><body><button onclick="print()">Simpan sebagai PDF</button><h1>Laporan Akhir FTG Fellowship</h1><p>Dibuat ${new Date().toLocaleString('id-ID')}</p><table><thead><tr>${rows[0].map(x=>`<th>${xml(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(x=>`<td>${xml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);return;
    }
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet('Laporan Akhir',rows)}${sheet('Rekap Nilai',scoreRows)}${sheet('Kehadiran',attendanceRows)}${sheet('Status Pengumpulan',submissionRows)}${sheet('Aktivitas Mentor',mentorRows)}${sheet('Peserta Berisiko',riskRows)}</Workbook>`;
    res.statusCode=200;res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="laporan-ftg-fellowship.xls"');res.end(workbook);
  } catch(error){return send(res,500,{error:error.message});}
};
