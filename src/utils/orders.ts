import type { CartItem } from '@/context/CartContext';
import type { PaymentMethod } from '@/pages/checkout/types';
import { supabase } from '@/lib/supabase';

export type ComandaCreada = {
	id: number | string;
	numero_pedido: string;
	total: number;
	saldo: number | null;
};

/**
 * Crea la comanda con la RPC create_comanda. Solo se envían ids y cantidades:
 * el servidor lee los precios de menu_items, calcula el total, asigna el
 * número de pedido y, con 'cafeteria', cobra el saldo en la misma transacción.
 */
export async function crearComanda(items: CartItem[], metodo: PaymentMethod): Promise<ComandaCreada> {
	if (items.some((item) => item.menuItemId === undefined)) {
		throw new Error('Algún platillo no se puede pedir en línea. Recarga el menú e inténtalo de nuevo.');
	}

	const p_items = items.map((item) => ({ menu_item_id: item.menuItemId, cantidad: item.quantity }));
	// Tarjeta CocinArte: solo pay_with_cocinarte_card (saldo real, débito y comanda en una transacción).
	const { data, error } =
		metodo === 'cafeteria'
			? await supabase.rpc('pay_with_cocinarte_card', { p_items })
			: await supabase.rpc('create_comanda', { p_items, p_metodo_pago: metodo });

	if (error) {
		console.error('Error creando comanda:', error);
		throw new Error(error.message || 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
	}

	return {
		id: data.id,
		numero_pedido: data.numero_pedido,
		total: Number(data.total),
		saldo: data.saldo === null ? null : Number(data.saldo),
	};
}
