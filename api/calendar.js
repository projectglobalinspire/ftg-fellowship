const { send, adminFetch, currentUser, method } = require('./_lib');

function esc(value) { return String(value || '').replace(/([,;\\])/g,'\\$1').replace(/\r?\n/g,'\\n'); }
function icsDate(value) { return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'); }

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const user = await currentUser(req);
    if (!user && req.query.public !== '1') return send(res, 401, { error:'Sesi tidak valid' });
    let events = await adminFetch('/rest/v1/program_events?visibility=eq.all&select=*&order=starts_at.asc');
    const assignments = await adminFetch('/rest/v1/assignments?status=eq.published&deadline=not.is.null&select=id,title,description,deadline');
    events = events.concat((assignments || []).map(a => ({ id:`assignment-${a.id}`,title:`Deadline: ${a.title}`,description:a.description,event_type:'assignment',starts_at:a.deadline,ends_at:a.deadline,location:'FTG Fellowship Dashboard' })));
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FTG GI Fellowship//Program Calendar//ID','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for (const event of events) lines.push('BEGIN:VEVENT',`UID:${esc(event.id)}@ftg-fellowship.vercel.app`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${icsDate(event.starts_at)}`,`DTEND:${icsDate(event.ends_at || new Date(new Date(event.starts_at).getTime()+3600000))}`,`SUMMARY:${esc(event.title)}`,`DESCRIPTION:${esc(event.description)}`,`LOCATION:${esc(event.location || event.meeting_link || '')}`,'END:VEVENT');
    lines.push('END:VCALENDAR');
    res.statusCode = 200;
    res.setHeader('Content-Type','text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="kalender-ftg-fellowship.ics"');
    res.end(lines.join('\r\n'));
  } catch (error) { return send(res, 500, { error:error.message }); }
};
