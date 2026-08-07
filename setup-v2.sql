-- ============================================================
-- FTG Fellowship v2 — 5 akun mentee + akun panitia
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

alter table public.ftg_users add column if not exists mentee_id int;
update public.ftg_users set mentee_id = 1 where email = 'arya@ftg.id';

insert into public.ftg_users (email, password, name, role, initials, path, mentee_id) values
  ('siti@ftg.id',    'siti2026',    'Siti Aisyah',     'mentee', 'SA', 'Entrepreneur Path', 2),
  ('rizky@ftg.id',   'rizky2026',   'Muhammad Rizky',  'mentee', 'MR', 'Career Path',       3),
  ('dina@ftg.id',    'dina2026',    'Dina Fitriani',   'mentee', 'DF', 'Entrepreneur Path', 4),
  ('bagas@ftg.id',   'bagas2026',   'Bagas Nugroho',   'mentee', 'BN', 'Career Path',       5),
  ('panitia@ftg.id', 'panitia2026', 'Panitia FTG',     'admin',  'PF', 'Committee',         null)
on conflict (email) do update set
  password = excluded.password, name = excluded.name, role = excluded.role,
  initials = excluded.initials, path = excluded.path, mentee_id = excluded.mentee_id;

select email, name, role, mentee_id from public.ftg_users order by role, mentee_id;
