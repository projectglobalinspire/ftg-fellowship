-- Follow-up hardening after the structured production migration.
-- The legacy state remains available only to signed-in users during the migration window.
revoke all on table public.ftg_state from public, anon;
grant select, update on table public.ftg_state to authenticated;
revoke all on table public.ftg_users from public, anon, authenticated;
alter table public.ftg_state enable row level security;
alter table public.ftg_users enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='ftg_state'
  loop execute format('drop policy if exists %I on public.ftg_state', p.policyname); end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='ftg_users'
  loop execute format('drop policy if exists %I on public.ftg_users', p.policyname); end loop;
end $$;
create policy "legacy state authenticated" on public.ftg_state for all to authenticated using (true) with check (true);

drop policy if exists "assignments staff write" on public.assignments;
create policy "assignments owner write" on public.assignments for all to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or (public.current_role() = 'mentor' and created_by = auth.uid()));

drop policy if exists "assignments scoped read" on public.assignments;
create or replace function public.can_read_assignment(target text) returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('mentor','admin'))
    or exists(select 1 from public.assignment_targets t where t.assignment_id=target and t.mentee_id=auth.uid())
$$;
grant execute on function public.can_read_assignment(text) to authenticated;
create policy "assignments scoped read" on public.assignments for select to authenticated using (public.can_read_assignment(id));

drop policy if exists "targets staff write" on public.assignment_targets;
drop policy if exists "targets owner write" on public.assignment_targets;
drop policy if exists "targets owner insert" on public.assignment_targets;
drop policy if exists "targets owner update" on public.assignment_targets;
drop policy if exists "targets owner delete" on public.assignment_targets;

create or replace function public.owns_assignment(target text) returns boolean
language sql stable security definer set search_path=public
as $$ select public.is_admin() or exists(select 1 from public.assignments a where a.id=target and a.created_by=auth.uid()) $$;
grant execute on function public.owns_assignment(text) to authenticated;

create policy "targets owner insert" on public.assignment_targets for insert to authenticated
  with check (public.owns_assignment(assignment_id));
create policy "targets owner update" on public.assignment_targets for update to authenticated
  using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));
create policy "targets owner delete" on public.assignment_targets for delete to authenticated
  using (public.owns_assignment(assignment_id));

drop policy if exists "reviews staff write" on public.reviews;
create policy "reviews paired mentor write" on public.reviews for all to authenticated
  using (public.is_admin() or reviewer_id=auth.uid())
  with check (public.is_admin() or (reviewer_id=auth.uid() and exists(
    select 1 from public.submissions s join public.profiles p on p.id=s.mentee_id
    where s.id=submission_id and p.mentor_id=auth.uid()
  )));

drop policy if exists "notifications staff insert" on public.notifications;
create or replace function public.can_notify_user(target uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select public.is_admin() or exists(select 1 from public.profiles p where p.id=target and p.mentor_id=auth.uid()) $$;
grant execute on function public.can_notify_user(uuid) to authenticated;
create policy "notifications staff insert" on public.notifications for insert to authenticated
  with check (public.can_notify_user(user_id));

create index if not exists assignments_deadline_idx on public.assignments(status, deadline);
create index if not exists submissions_mentee_status_idx on public.submissions(mentee_id, status);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists profiles_mentor_idx on public.profiles(mentor_id) where mentor_id is not null;

create or replace function public.my_mentor_google_email() returns text
language sql stable security definer set search_path=public
as $$
  select mentor.google_email from public.profiles me
  join public.profiles mentor on mentor.id=me.mentor_id
  where me.id=auth.uid() and me.role='mentee'
$$;
grant execute on function public.my_mentor_google_email() to authenticated;
