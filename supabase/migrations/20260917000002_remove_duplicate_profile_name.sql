-- `profiles.name` is the single source of truth for the user's name.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS nombre;

NOTIFY pgrst, 'reload schema';
