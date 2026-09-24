-- Small key/value settings editable by staff. First use: WhatsApp Business
-- contact button on the public site.
--   whatsapp_e164     digits only, with country code (e.g. 52 + 10 digits); '' = hide the button
--   whatsapp_greeting prefilled message for wa.me

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_whatsapp_e164_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_whatsapp_e164_check
  CHECK (key <> 'whatsapp_e164' OR value = '' OR value ~ '^[1-9][0-9]{7,14}$');

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_whatsapp_greeting_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_whatsapp_greeting_check
  CHECK (key <> 'whatsapp_greeting' OR char_length(value) <= 300);

INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp_e164', ''),
  ('whatsapp_greeting', '¡Hola, COCINARTE HOUSE! Tengo una pregunta.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only keys meant for the public site are readable without a staff role, so
-- future private settings do not leak by default.
DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (key IN ('whatsapp_e164', 'whatsapp_greeting') OR public.is_staff());

DROP POLICY IF EXISTS "app_settings_staff_write" ON public.app_settings;
CREATE POLICY "app_settings_staff_write"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

NOTIFY pgrst, 'reload schema';
