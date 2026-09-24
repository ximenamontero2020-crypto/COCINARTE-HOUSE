-- Staff marca qué productos se pueden pagar en efectivo (no requieren preparación).
-- Depende de 20260924000009_payment_methods_cash_rule.sql (columna pago_en_caja_permitido)
-- y de public.is_staff() / public.staff_audit_log.
--
-- Solo por RPC: el cliente nunca recibe UPDATE directo sobre menu_items, así que un
-- customer no puede habilitarse el efectivo a sí mismo. Cada cambio queda en la auditoría.

CREATE OR REPLACE FUNCTION public.staff_set_pago_en_caja(p_menu_item_id bigint, p_permitido boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Solo el staff puede cambiar el pago en efectivo' USING ERRCODE = '42501';
  END IF;
  IF p_permitido IS NULL THEN
    RAISE EXCEPTION 'Valor no válido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.menu_items
  SET pago_en_caja_permitido = p_permitido
  WHERE id = p_menu_item_id
  RETURNING name INTO v_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.staff_audit_log (actor_id, action, entity, entity_id, meta)
  VALUES (auth.uid(), 'set_pago_en_caja', 'menu_items', p_menu_item_id::text,
          jsonb_build_object('name', v_name, 'pago_en_caja_permitido', p_permitido));

  RETURN jsonb_build_object('id', p_menu_item_id, 'pago_en_caja_permitido', p_permitido);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_pago_en_caja(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_pago_en_caja(bigint, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
