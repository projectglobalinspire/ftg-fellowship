-- Deprecated legacy Google-account migration.
-- Google connection fields now belong to public.profiles and are maintained by
-- the production migrations. Apply supabase/migrations in filename order.

select 'Legacy setup disabled. Apply the production migrations.' as notice;
