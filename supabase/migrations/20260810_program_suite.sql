-- FTG Fellowship: calendar, attendance, discipline, certificates and durable review history.
-- Idempotent and non-destructive.
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists warning_level integer not null default 0,
  add column if not exists last_active_at timestamptz,
  add column if not exists graduation_eligible boolean not null default false;
alter table public.profiles drop constraint if exists profiles_warning_level_check;
alter table public.profiles add constraint profiles_warning_level_check check (warning_level between 0 and 4);

alter table public.program_settings
  add column if not exists active_phase text not null default 'DEFINE',
  add column if not exists completion_requirement integer not null default 80,
  add column if not exists attendance_requirement integer not null default 80,
  add column if not exists quality_requirement integer not null default 75,
  add column if not exists feature_flags jsonb not null default '{"assignments":true,"workshops":true,"journal":true,"leaderboard":true,"certificates":true}'::jsonb,
  add column if not exists kpi_weights jsonb not null default '{"completion":40,"quality":35,"engagement":25}'::jsonb,
  add column if not exists rubric_templates jsonb not null default '[{"name":"Rubrik Refleksi","criteria":[{"label":"Kedalaman analisis","weight":40,"max":100},{"label":"Keselarasan nilai","weight":25,"max":100},{"label":"Kualitas refleksi","weight":20,"max":100},{"label":"Ketepatan waktu","weight":15,"max":100}]}]'::jsonb;

create table if not exists public.review_history (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references public.submissions(id) on delete cascade,
  submission_version integer,
  reviewer_id uuid references public.profiles(id),
  score integer check (score between 0 and 100),
  decision text not null check (decision in ('approved','revision')),
  feedback text not null,
  rubric_scores jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.program_events (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in ('assignment','workshop','mentoring','opening','closing','other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  meeting_link text,
  description text,
  visibility text not null default 'all' check (visibility in ('all','mentee','mentor','admin')),
  source_type text,
  source_id text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.program_events(id) on delete set null,
  title text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  token_hash text unique not null,
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'present' check (status in ('present','late','excused','absent')),
  checked_in_at timestamptz,
  method text not null default 'qr' check (method in ('qr','manual','system')),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, mentee_id)
);

create table if not exists public.discipline_actions (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('warning_1','warning_2','lock','unlock','drop','restore','note')),
  from_level integer not null default 0,
  to_level integer not null default 0,
  reason text not null,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id),
  certificate_number text unique not null,
  verification_code text unique not null default encode(gen_random_bytes(12),'hex'),
  recipient_name text not null,
  program_name text not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  eligibility_snapshot jsonb not null default '{}',
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  recipient text not null,
  subject text not null,
  html text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  provider_id text,
  error text,
  attempts integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_history_submission_idx on public.review_history(submission_id,created_at desc);
create index if not exists events_starts_idx on public.program_events(starts_at,event_type);
create index if not exists attendance_mentee_idx on public.attendance_records(mentee_id,status);
create index if not exists discipline_mentee_idx on public.discipline_actions(mentee_id,created_at desc);
create index if not exists certificates_verify_idx on public.certificates(verification_code) where revoked_at is null;
create index if not exists email_outbox_status_idx on public.email_outbox(status,created_at);

alter table public.review_history enable row level security;
alter table public.program_events enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.discipline_actions enable row level security;
alter table public.certificates enable row level security;
alter table public.email_outbox enable row level security;

do $$ begin create policy "review history scoped read" on public.review_history for select to authenticated using (exists(select 1 from public.submissions s where s.id=submission_id and public.can_access_mentee(s.mentee_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "review history staff insert" on public.review_history for insert to authenticated with check (public.current_role() in ('mentor','admin') and reviewer_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "events authenticated read" on public.program_events for select to authenticated using (visibility='all' or visibility=public.current_role() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "events admin write" on public.program_events for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "attendance sessions read" on public.attendance_sessions for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "attendance sessions admin write" on public.attendance_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "attendance records scoped read" on public.attendance_records for select to authenticated using (mentee_id=auth.uid() or public.can_access_mentee(mentee_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "attendance records admin write" on public.attendance_records for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "discipline scoped read" on public.discipline_actions for select to authenticated using (mentee_id=auth.uid() or public.can_access_mentee(mentee_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "discipline admin write" on public.discipline_actions for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "certificates scoped read" on public.certificates for select to authenticated using (mentee_id=auth.uid() or public.can_access_mentee(mentee_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "certificates admin write" on public.certificates for all to authenticated using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "email outbox admin read" on public.email_outbox for select to authenticated using (public.is_admin()); exception when duplicate_object then null; end $$;

-- Public verification returns only non-sensitive certificate fields.
create or replace function public.verify_certificate(code text)
returns table(certificate_number text, recipient_name text, program_name text, issued_at timestamptz, valid boolean)
language sql stable security definer set search_path=public
as $$ select c.certificate_number,c.recipient_name,c.program_name,c.issued_at,(c.revoked_at is null) from public.certificates c where c.verification_code=code limit 1 $$;
grant execute on function public.verify_certificate(text) to anon,authenticated;

-- Derive tiered warning state from attendance. Status transitions stay server-only.
create or replace function public.recalculate_participant_discipline(target uuid)
returns integer language plpgsql security definer set search_path=public
as $$
declare absent_count integer; next_level integer;
begin
  select count(*) into absent_count from public.attendance_records where mentee_id=target and status='absent';
  next_level := case when absent_count >= 4 then 4 when absent_count = 3 then 3 when absent_count = 2 then 2 when absent_count = 1 then 1 else 0 end;
  update public.profiles set warning_level=next_level, absence_count=absent_count,
    status=case when next_level>=3 and status='active' then 'suspended' else status end,
    updated_at=now() where id=target;
  return next_level;
end $$;
revoke all on function public.recalculate_participant_discipline(uuid) from public,anon,authenticated;

do $$ begin alter publication supabase_realtime add table public.program_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.attendance_records; exception when duplicate_object then null; end $$;
