const { send, serverError, adminFetch, method } = require('./_lib');
const { deliverEmail } = require('./_email');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  const expected = process.env.CRON_SECRET;
  if (!expected) return send(res, 503, { error:'Layanan pengingat belum dikonfigurasi' });
  if (req.headers.authorization !== `Bearer ${expected}`) return send(res, 401, { error: 'Cron tidak valid' });
  try {
    const settings = (await adminFetch('/rest/v1/program_settings?id=eq.1&select=reminder_days,timezone'))[0] || { reminder_days: [3, 1, 0] };
    const assignments = await adminFetch('/rest/v1/assignments?status=eq.published&deadline=not.is.null&select=id,title,deadline,assignment_targets(mentee_id),submissions(mentee_id,status)');
    const now = new Date(); now.setUTCHours(0, 0, 0, 0);
    const notices = [];
    for (const task of assignments || []) {
      const due = new Date(task.deadline); due.setUTCHours(0, 0, 0, 0);
      const days = Math.round((due - now) / 86400000);
      const isReminder = (settings.reminder_days || []).includes(days);
      const isLate = days < 0;
      if (!isReminder && !isLate) continue;
      for (const target of task.assignment_targets || []) {
        const done = (task.submissions || []).some(s => s.mentee_id === target.mentee_id && ['submitted', 'under_review', 'approved'].includes(s.status));
        if (done) continue;
        const marker = isLate ? `late:${task.id}` : `deadline:${task.id}:${days}`;
        const exists = await adminFetch(`/rest/v1/notifications?user_id=eq.${target.mentee_id}&type=eq.${encodeURIComponent(marker)}&select=id&limit=1`);
        if (!exists.length) notices.push({ user_id: target.mentee_id, type: marker, title: isLate ? 'Tugas terlambat' : (days === 0 ? 'Deadline hari ini' : `Deadline ${days} hari lagi`), body: isLate ? `${task.title} terlambat ${Math.abs(days)} hari. Segera kumpulkan atau hubungi mentor.` : task.title, href: 'mentee-dashboard.html#tugas', delivery: { in_app: 'sent', email: 'queued' } });
      }
    }
    let inserted = [];
    if (notices.length) inserted = await adminFetch('/rest/v1/notifications', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(notices) });
    const userIds = [...new Set(inserted.map(n => n.user_id))];
    const profiles = userIds.length ? await adminFetch(`/rest/v1/profiles?id=in.(${userIds.map(encodeURIComponent).join(',')})&select=id,email,notification_preferences`) : [];
    let emailed = 0;
    for (const notice of inserted) {
      const profile = profiles.find(p => p.id === notice.user_id);
      if (profile && (!profile.notification_preferences || profile.notification_preferences.email !== false)) {
        const result = await deliverEmail(profile, notice, notice.id);
        if (result.status === 'sent') emailed++;
        await adminFetch(`/rest/v1/notifications?id=eq.${notice.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ delivery:{ in_app:'sent', email:result.status } }) });
      }
    }
    await adminFetch('/rest/v1/integration_status?on_conflict=service', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ service: 'reminders', status: 'healthy', detail: `${notices.length} notifikasi dikirim`, checked_at: new Date().toISOString() }) });
    return send(res, 200, { ok: true, sent: notices.length, emailed });
  } catch (error) { return serverError(req, res, error); }
};
