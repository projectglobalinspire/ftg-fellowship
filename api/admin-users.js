const { send, adminFetch, requireRole, method } = require('./_lib');
const { deliverEmail } = require('./_email');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const auth = await requireRole(req, res, ['admin']);
    if (!auth) return;
    if (req.method === 'GET') {
      const page = Math.max(1, +(req.query.page || 1));
      const users = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
      const profiles = await adminFetch('/rest/v1/profiles?select=*&order=created_at.desc');
      return send(res, 200, { users: users.users || users, profiles });
    }
    const body = req.body || {};
    if (req.method === 'POST') {
      if (!body.email || !body.full_name || !['mentee', 'mentor', 'admin'].includes(body.role)) return send(res, 400, { error: 'Email, nama, dan role wajib valid' });
      const password = body.password || `${crypto.randomUUID().slice(0, 10)}Aa1!`;
      const user = await adminFetch('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: body.email.toLowerCase(), password, email_confirm: body.email_confirm !== false, user_metadata: { full_name: body.full_name, role: body.role, initials: body.initials || '', path: body.path || '', mentee_number: body.mentee_number || null } }) });
      if (body.mentor_id || body.cohort_id) await adminFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ mentor_id: body.mentor_id || null, cohort_id: body.cohort_id || null }) });
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.create', entity_type: 'profile', entity_id: user.id, detail: { email: body.email, role: body.role } }) });
      return send(res, 201, { user, temporary_password: body.password ? undefined : password });
    }
    const id = body.id || req.query.id;
    if (!id) return send(res, 400, { error: 'ID pengguna wajib ada' });
    if (req.method === 'PATCH') {
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
      if (body.status && !['active', 'suspended', 'graduated', 'dropped'].includes(body.status)) return send(res, 400, { error: 'Status akun tidak valid' });
      if (Object.keys(profilePatch).length) await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(profilePatch) });
      const authPatch = {};
      if (body.email) authPatch.email = body.email;
      if (body.password) authPatch.password = body.password;
      if (body.status) authPatch.ban_duration = ['suspended', 'dropped'].includes(body.status) ? '876000h' : 'none';
      if (Object.keys(authPatch).length) await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(authPatch) });
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.update', entity_type: 'profile', entity_id: id, detail: profilePatch }) });
      return send(res, 200, { ok: true });
    }
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}?should_soft_delete=true`, { method: 'DELETE' });
    await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.soft_delete', entity_type: 'profile', entity_id: id }) });
    return send(res, 200, { ok: true, recoverable: false });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
