import type { CartItem } from '@/context/CartContext';
import type { OrderInfo } from '@/pages/checkout/types';
import { supabase } from '@/lib/supabase';

export async function guardarComanda(order: OrderInfo, items: CartItem[]) {
	const productos = items.map((item) => ({
		...(item.menuItemId !== undefined ? { menu_item_id: item.menuItemId } : {}),
		nombre: item.name,
		cantidad: item.quantity,
		precio: item.priceValue,
	}));
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { error } = await supabase.from('comandas').insert({
		cliente: null,
		productos,
		total: order.total,
		estado: 'pendiente',
		numero_pedido: order.orderNumber,
		metodo_pago: order.method,
		user_id: user?.id ?? null,
	});

	if (error) {
		console.error('Error guardando comanda en Supabase:', error);
		throw error;
	}
}
