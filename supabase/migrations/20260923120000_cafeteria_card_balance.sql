-- Per-account cafeteria card (monedas) on profiles + RPCs for recharge/spend.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS card_balance numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_card_balance_nonnegative'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_card_balance_nonnegative
      CHECK (card_balance >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_card_number_unique
  ON public.profiles (card_number)
  WHERE card_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_cafeteria_card_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  digits text;
  candidate text;
BEGIN
  LOOP
    digits := lpad((floor(random() * 1e12))::bigint::text, 12, '0');
    candidate := 'COC '
      || substr(digits, 1, 4) || '-'
      || substr(digits, 5, 4) || '-'
      || substr(digits, 9, 4);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE card_number = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_for_auth_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  meta jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = uid;

  INSERT INTO public.profiles (id, email, name, phone)
  SELECT
    u.id,
    u.email,
    COALESCE(meta->>'name', meta->>'full_name'),
    COALESCE(u.phone, meta->>'phone')
  FROM auth.users AS u
  WHERE u.id = uid
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles
  SET
    card_number = COALESCE(card_number, public.generate_cafeteria_card_number()),
    updated_at = now()
  WHERE id = uid
    AND card_number IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.recharge_cafeteria_card(p_amount numeric)
RETURNS TABLE (card_number text, card_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  PERFORM public.ensure_profile_for_auth_user();

  UPDATE public.profiles AS p
  SET
    card_balance = p.card_balance + p_amount,
    updated_at = now()
  WHERE p.id = uid;

  RETURN QUERY
  SELECT p.card_number, p.card_balance
  FROM public.profiles AS p
  WHERE p.id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_cafeteria_card(p_amount numeric)
RETURNS TABLE (card_number text, card_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  current_balance numeric(12, 2);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  PERFORM public.ensure_profile_for_auth_user();

  SELECT p.card_balance INTO current_balance
  FROM public.profiles AS p
  WHERE p.id = uid
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.profiles AS p
  SET
    card_balance = p.card_balance - p_amount,
    updated_at = now()
  WHERE p.id = uid;

  RETURN QUERY
  SELECT p.card_number, p.card_balance
  FROM public.profiles AS p
  WHERE p.id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recharge_cafeteria_card(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_cafeteria_card(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user_profile();

NOTIFY pgrst, 'reload schema';
