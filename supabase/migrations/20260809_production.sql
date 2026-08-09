-- FTG Fellowship production foundation (idempotent, non-destructive).
create extension if not exists pgcrypto;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('draft','active','completed','archived')),
  start_date date, end_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('mentee','mentor','admin')),
  initials text, path text, cohort_id uuid references public.cohorts(id),
  mentor_id uuid references public.profiles(id), mentee_number int,
  status text not null default 'active' check (status in ('invited','active','suspended','graduated')),
  google_email text, google_connected_at timestamptz,
  notification_preferences jsonb not null default '{"in_app":true,"email":true,"deadline":true,"review":true,"session":true}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.program_settings (
  id int primary key default 1 check (id = 1),
  program_name text not null default 'Future Builders Fellowship',
  current_month int not null default 1, current_week int not null default 1,
  passing_score int not null default 75,
  reminder_days int[] not null default '{3,1,0}', timezone text not null default 'Asia/Makassar',
  drive_root_folder text not null default 'FTG Fellowship 2026',
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id text primary key default gen_random_uuid()::text, cohort_id uuid references public.cohorts(id),
  title text not null, description text not null, deadline timestamptz, points int not null default 0,
  reference_link text, checklist jsonb not null default '[]', rubric jsonb not null default '[]',
  status text not null default 'published' check (status in ('draft','published','archived')),
  is_template boolean not null default false,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.assignment_targets (
  assignment_id text references public.assignments(id) on delete cascade,
  mentee_id uuid references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(), primary key (assignment_id, mentee_id)
);

create table if not exists public.submissions (
  id text primary key default gen_random_uuid()::text, assignment_id text references public.assignments(id) on delete cascade,
  mentee_id uuid references public.profiles(id) on delete cascade,
  text_content text, link_url text, files jsonb not null default '[]', checklist_state jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','under_review','revision','approved','late')),
  submitted_at timestamptz, updated_at timestamptz not null default now(), unique (assignment_id, mentee_id)
);

create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(), submission_id text references public.submissions(id) on delete cascade,
  version_number int not null, text_content text, link_url text, files jsonb not null default '[]',
  created_at timestamptz not null default now(), unique (submission_id, version_number)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), submission_id text unique references public.submissions(id) on delete cascade,
  reviewer_id uuid references public.profiles(id), score int check (score between 0 and 100),
  decision text not null check (decision in ('approved','revision')),
  feedback text not null, rubric_scores jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.task_discussions (
  id uuid primary key default gen_random_uuid(), submission_id text references public.submissions(id) on delete cascade,
  author_id uuid references public.profiles(id), message text not null, created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
  type text not null default 'info', title text not null, body text not null, href text,
  read_at timestamptz, delivery jsonb not null default '{"in_app":"pending"}', created_at timestamptz not null default now()
);

create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(), mentor_id uuid references public.profiles(id), mentee_id uuid references public.profiles(id),
  scheduled_at timestamptz not null, duration_minutes int not null default 45, topic text, meeting_link text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  shared_summary text, action_items jsonb not null default '[]', attendance jsonb not null default '{}',
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.mentor_notes (
  id uuid primary key default gen_random_uuid(), mentor_id uuid references public.profiles(id), mentee_id uuid references public.profiles(id),
  note text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
  action text not null, entity_type text, entity_id text, detail jsonb not null default '{}',
  ip_hash text, created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id bigint generated always as identity primary key, user_id uuid references public.profiles(id),
  level text not null default 'error', source text, message text not null, context jsonb not null default '{}',
  resolved_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.integration_status (
  service text primary key, status text not null default 'unknown', detail text,
  checked_at timestamptz not null default now()
);

create table if not exists public.backup_snapshots (
  id uuid primary key default gen_random_uuid(), created_by uuid references public.profiles(id),
  label text not null, payload jsonb not null, created_at timestamptz not null default now()
);

insert into public.cohorts (name,status,start_date,end_date)
select 'FTG Fellowship 2026','active','2026-08-01','2026-10-31'
where not exists (select 1 from public.cohorts);
insert into public.program_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.current_role() returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_role() = 'admin', false) $$;
create or replace function public.can_access_mentee(target uuid) returns boolean language sql stable security definer set search_path=public
as $$ select auth.uid() = target or public.is_admin() or exists(select 1 from public.profiles p where p.id=target and p.mentor_id=auth.uid()) $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$
declare c uuid;
begin
  select id into c from public.cohorts where status='active' order by created_at limit 1;
  insert into public.profiles(id,email,full_name,role,initials,path,cohort_id,mentee_number,status)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','mentee'),new.raw_user_meta_data->>'initials',
    new.raw_user_meta_data->>'path',c,nullif(new.raw_user_meta_data->>'mentee_number','')::int,'active')
  on conflict(id) do update set email=excluded.email, full_name=excluded.full_name, updated_at=now();
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();

alter table public.cohorts enable row level security;
alter table public.profiles enable row level security;
alter table public.program_settings enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.reviews enable row level security;
alter table public.task_discussions enable row level security;
alter table public.notifications enable row level security;
alter table public.mentor_sessions enable row level security;
alter table public.mentor_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.error_logs enable row level security;
alter table public.integration_status enable row level security;
alter table public.backup_snapshots enable row level security;

do $$ begin
  create policy "cohorts authenticated read" on public.cohorts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "cohorts admin write" on public.cohorts for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "profiles scoped read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin() or mentor_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "profiles self update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "profiles admin write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "settings authenticated read" on public.program_settings for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "settings admin write" on public.program_settings for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "assignments scoped read" on public.assignments for select to authenticated using (public.current_role() in ('mentor','admin') or exists(select 1 from public.assignment_targets t where t.assignment_id=id and t.mentee_id=auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "assignments staff write" on public.assignments for all to authenticated using (public.current_role() in ('mentor','admin')) with check (public.current_role() in ('mentor','admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "targets scoped read" on public.assignment_targets for select to authenticated using (mentee_id=auth.uid() or public.current_role() in ('mentor','admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "targets staff write" on public.assignment_targets for all to authenticated using (public.current_role() in ('mentor','admin')) with check (public.current_role() in ('mentor','admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "submissions scoped read" on public.submissions for select to authenticated using (public.can_access_mentee(mentee_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "submissions mentee write" on public.submissions for all to authenticated using (mentee_id=auth.uid()) with check (mentee_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "submissions staff update" on public.submissions for update to authenticated using (public.current_role() in ('mentor','admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "versions scoped" on public.submission_versions for select to authenticated using (exists(select 1 from public.submissions s where s.id=submission_id and public.can_access_mentee(s.mentee_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "versions mentee insert" on public.submission_versions for insert to authenticated with check (exists(select 1 from public.submissions s where s.id=submission_id and s.mentee_id=auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "reviews scoped read" on public.reviews for select to authenticated using (exists(select 1 from public.submissions s where s.id=submission_id and public.can_access_mentee(s.mentee_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "reviews staff write" on public.reviews for all to authenticated using (public.current_role() in ('mentor','admin')) with check (public.current_role() in ('mentor','admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "discussion scoped read" on public.task_discussions for select to authenticated using (exists(select 1 from public.submissions s where s.id=submission_id and public.can_access_mentee(s.mentee_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "discussion scoped insert" on public.task_discussions for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.submissions s where s.id=submission_id and public.can_access_mentee(s.mentee_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "notifications own read" on public.notifications for select to authenticated using (user_id=auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "notifications own update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "sessions scoped read" on public.mentor_sessions for select to authenticated using (mentor_id=auth.uid() or mentee_id=auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "sessions mentor write" on public.mentor_sessions for all to authenticated using (mentor_id=auth.uid() or public.is_admin()) with check (mentor_id=auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "notes mentor private" on public.mentor_notes for all to authenticated using (mentor_id=auth.uid() or public.is_admin()) with check (mentor_id=auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "audit authenticated insert" on public.audit_logs for insert to authenticated with check (actor_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "errors own insert" on public.error_logs for insert to authenticated with check (user_id=auth.uid() or user_id is null); exception when duplicate_object then null; end $$;
do $$ begin create policy "errors admin read" on public.error_logs for select to authenticated using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "integration authenticated read" on public.integration_status for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "integration admin write" on public.integration_status for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "backups admin only" on public.backup_snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_mentee(uuid) to authenticated;
revoke update on public.profiles from authenticated;
grant update (notification_preferences,onboarding_completed,google_email,google_connected_at,updated_at) on public.profiles to authenticated;

do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.submissions; exception when duplicate_object then null; end $$;
