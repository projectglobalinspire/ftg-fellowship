-- Tampilkan sambutan baru satu kali pada login berikutnya untuk akun peserta
-- dan mentor yang sudah dibuat sebelum pengalaman onboarding ini diperbarui.
update public.profiles
set onboarding_completed = false,
    updated_at = now()
where role in ('mentee', 'mentor');
