-- Stream profile identity/status updates to authenticated dashboards.
-- Duplicate-safe for environments where profiles was already published.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

