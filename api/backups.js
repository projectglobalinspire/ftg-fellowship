const { send, adminFetch, requireRole, method } = require('./_lib');
const tables = ['cohorts','program_settings','profiles','assignments','assignment_targets','submissions','submission_versions','reviews','review_history','task_discussions','notifications','mentor_sessions','mentor_notes','program_events','attendance_sessions','attendance_records','discipline_actions','certificates'];
const conflicts = { assignment_targets: 'assignment_id,mentee_id', submission_versions:'submission_id,version_number', attendance_records:'session_id,mentee_id' };

async function capture(createdBy, label) {
  const payload = {};
  for (const table of tables) payload[table] = await adminFetch(`/rest/v1/${table}?select=*`);
  const rows = await adminFetch('/rest/v1/backup_snapshots', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ created_by: createdBy, label, payload }) });
  return rows[0];
}
module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try { const auth = await requireRole(req, res, ['admin']); if (!auth) return;
    if (req.method === 'GET') { const rows = await adminFetch('/rest/v1/backup_snapshots?select=id,label,created_at,created_by&order=created_at.desc&limit=20'); return send(res, 200, { backups: rows }); }
    const action = (req.body || {}).action || 'create';
    if (action === 'create') return send(res, 201, { backup: await capture(auth.user.id, (req.body && req.body.label) || `Backup ${new Date().toLocaleDateString('id-ID')}`) });
    if (action === 'preview' || action === 'restore') {
      const id = String((req.body || {}).id || '');
      const rows = await adminFetch(`/rest/v1/backup_snapshots?id=eq.${encodeURIComponent(id)}&select=id,label,created_at,payload`);
      const snapshot = rows[0];
      if (!snapshot) return send(res, 404, { error: 'Backup tidak ditemukan' });
      const counts = {}; for (const table of tables) counts[table] = Array.isArray(snapshot.payload[table]) ? snapshot.payload[table].length : 0;
      if (action === 'preview') return send(res, 200, { backup: { id: snapshot.id, label: snapshot.label, created_at: snapshot.created_at }, counts });
      if ((req.body || {}).confirmation !== 'PULIHKAN') return send(res, 400, { error: 'Konfirmasi pemulihan tidak valid' });
      const safety = await capture(auth.user.id, `Otomatis sebelum restore ${new Date().toLocaleString('id-ID')}`);
      for (const table of tables) {
        const records = snapshot.payload[table]; if (!Array.isArray(records) || !records.length) continue;
        const conflict = conflicts[table] || 'id';
        await adminFetch(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(records) });
      }
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'backup.restore', entity_type: 'backup', entity_id: snapshot.id, detail: { safety_backup: safety.id, counts } }) });
      return send(res, 200, { ok: true, safety_backup: safety.id, counts });
    }
    return send(res, 400, { error: 'Aksi backup tidak dikenali' });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
