const { send, adminFetch, method } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) return send(res, 401, { error: 'Cron tidak valid' });
  try {
    const settings = (await adminFetch('/rest/v1/program_settings?id=eq.1&select=reminder_days,timezone'))[0] || { reminder_days: [3, 1, 0] };
    const assignments = await adminFetch('/rest/v1/assignments?status=eq.published&deadline=not.is.null&select=id,title,deadline,assignment_targets(mentee_id),submissions(mentee_id,status)');
    const now = new Date(); now.setUTCHours(0, 0, 0, 0);
    const notices = [];
    for (const task of assignments || []) {
      const due = new Date(task.deadline); due.setUTCHours(0, 0, 0, 0);
      const days = Math.round((due - now) / 86400000);
      if (!(settings.reminder_days || []).includes(days)) continue;
      for (const target of task.assignment_targets || []) {
        const done = (task.submissions || []).some(s => s.mentee_id === target.mentee_id && ['submitted', 'under_review', 'approved'].includes(s.status));
        if (done) continue;
        const marker = `deadline:${task.id}:${days}`;
        const exists = await adminFetch(`/rest/v1/notifications?user_id=eq.${target.mentee_id}&type=eq.${encodeURIComponent(marker)}&select=id&limit=1`);
        if (!exists.length) notices.push({ user_id: target.mentee_id, type: marker, title: days === 0 ? 'Deadline hari ini' : `Deadline ${days} hari lagi`, body: task.title, href: 'mentee-dashboard.html#tugas', delivery: { in_app: 'sent', email: 'not_configured' } });
      }
    }
    if (notices.length) await adminFetch('/rest/v1/notifications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(notices) });
    await adminFetch('/rest/v1/integration_status?on_conflict=service', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ service: 'reminders', status: 'healthy', detail: `${notices.length} notifikasi dikirim`, checked_at: new Date().toISOString() }) });
    return send(res, 200, { ok: true, sent: notices.length });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
