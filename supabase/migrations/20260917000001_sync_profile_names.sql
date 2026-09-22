UPDATE public.profiles
SET nombre = COALESCE(nombre, name),
    name = COALESCE(name, nombre)
WHERE nombre IS NULL OR name IS NULL;

NOTIFY pgrst, 'reload schema';
