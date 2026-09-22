-- Keep registered user contact data available to the order notification function.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles AS profiles
SET email = users.email
FROM auth.users AS users
WHERE profiles.id = users.id
  AND (profiles.email IS NULL OR profiles.email = '');

UPDATE public.profiles
SET nombre = COALESCE(nombre, name),
    name = COALESCE(name, nombre)
WHERE nombre IS NULL OR name IS NULL;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comandas_user_id_idx ON public.comandas(user_id);

-- Existing installations use a text status column, so 'listo' is immediately valid.
-- If the column has a CHECK constraint, preserve every existing value and add 'listo'.
DO $$
DECLARE
  constraint_name text;
  allowed_values text;
BEGIN
  SELECT con.conname,
         pg_get_constraintdef(con.oid)
  INTO constraint_name, allowed_values
  FROM pg_constraint AS con
  JOIN pg_attribute AS att
    ON att.attrelid = con.conrelid
   AND att.attname = 'estado'
  WHERE con.conrelid = 'public.comandas'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%estado%'
  LIMIT 1;

  IF constraint_name IS NOT NULL AND allowed_values NOT ILIKE '%listo%' THEN
    EXECUTE format('ALTER TABLE public.comandas DROP CONSTRAINT %I', constraint_name);
    EXECUTE format(
      'ALTER TABLE public.comandas ADD CONSTRAINT %I CHECK (%s OR estado = ''listo'')',
      constraint_name,
      regexp_replace(allowed_values, '^CHECK \((.*)\)$', '\1')
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
