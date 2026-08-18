-- Deprecated legacy bootstrap.
-- Do not create users or store passwords in public tables. Create accounts
-- through the Fasil dashboard or Supabase Auth, then apply migrations from
-- supabase/migrations in filename order.

select 'Legacy setup disabled. Use Supabase Auth and the Fasil dashboard.' as notice;
