-- Disiplin peserta: ketidakhadiran, penguncian akun, dan status gugur.
alter table public.profiles
  add column if not exists absence_count integer not null default 0,
  add column if not exists discipline_note text,
  add column if not exists discipline_updated_at timestamptz,
  add column if not exists discipline_updated_by uuid references public.profiles(id);

alter table public.profiles drop constraint if exists profiles_absence_count_check;
alter table public.profiles
  add constraint profiles_absence_count_check check (absence_count between 0 and 99);

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('invited','active','suspended','graduated','dropped'));

-- Tidak ada izin pembaruan ke pengguna biasa. Semua aksi disiplin hanya melalui
-- endpoint panitia dengan service role dan audit log.
