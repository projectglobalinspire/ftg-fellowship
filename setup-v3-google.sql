-- FTG Fellowship v3 — tautkan akun Google ke akun program.
-- Jalankan sekali di Supabase SQL Editor.

alter table public.ftg_users
  add column if not exists google_email text,
  add column if not exists google_connected_at timestamptz;

create index if not exists ftg_users_google_email_idx
  on public.ftg_users (google_email)
  where google_email is not null;

select email, name, role, google_email, google_connected_at
from public.ftg_users
order by role, mentee_id nulls last;
