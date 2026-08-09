const { send, adminFetch, requireRole, method } = require('./_lib');

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
      const profilePatch = {};
      ['full_name', 'role', 'status', 'path', 'mentor_id', 'cohort_id', 'mentee_number'].forEach(k => { if (body[k] !== undefined) profilePatch[k] = body[k]; });
      if (Object.keys(profilePatch).length) await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(profilePatch) });
      const authPatch = {};
      if (body.email) authPatch.email = body.email;
      if (body.password) authPatch.password = body.password;
      if (body.status) authPatch.ban_duration = body.status === 'suspended' ? '876000h' : 'none';
      if (Object.keys(authPatch).length) await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(authPatch) });
      await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.update', entity_type: 'profile', entity_id: id, detail: profilePatch }) });
      return send(res, 200, { ok: true });
    }
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}?should_soft_delete=true`, { method: 'DELETE' });
    await adminFetch('/rest/v1/audit_logs', { method: 'POST', body: JSON.stringify({ actor_id: auth.user.id, action: 'user.soft_delete', entity_type: 'profile', entity_id: id }) });
    return send(res, 200, { ok: true, recoverable: false });
  } catch (error) { return send(res, 500, { error: error.message }); }
};
