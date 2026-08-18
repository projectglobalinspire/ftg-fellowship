-- Passwords are managed exclusively by Supabase Auth.
-- Remove the obsolete plaintext-capable column if a legacy installation still
-- has it. CASCADE removes legacy views that depended on the unsafe column.

do $$
begin
  if to_regclass('public.ftg_users') is not null then
    revoke all on table public.ftg_users from public, anon, authenticated;
    alter table public.ftg_users drop column if exists password cascade;
  end if;
end
$$;

-- The old single-row JSON state contains cross-user data and must not be
-- readable or writable by ordinary participants.
do $$
declare policy_row record;
begin
  if to_regclass('public.ftg_state') is not null then
    revoke all on table public.ftg_state from public, anon, authenticated;
    grant select, update on table public.ftg_state to authenticated;
    alter table public.ftg_state enable row level security;
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'ftg_state'
    loop
      execute format('drop policy if exists %I on public.ftg_state', policy_row.policyname);
    end loop;
    create policy "legacy state fasil only" on public.ftg_state
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end
$$;
