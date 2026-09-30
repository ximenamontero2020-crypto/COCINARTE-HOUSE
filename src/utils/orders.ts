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
 * Con 'caja' el servidor rechaza productos que requieren preparación.
 */
export async function crearComanda(items: CartItem[], metodo: PaymentMethod): Promise<ComandaCreada> {
	// La pasarela es un prototipo: nunca crea pedidos (create_comanda también la rechaza).
	if (metodo === 'pasarela') {
		throw new Error('La pasarela de pago es un prototipo y no puede crear pedidos.');
	}
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

	return toComandaCreada(data);
}

export type DatosInvitado = { nombre: string; email: string };

/**
 * Pedido sin cuenta con la RPC create_guest_comanda: siempre 'caja' (efectivo al recoger) y
 * solo productos listos. El servidor valida nombre, correo, precios y el límite de pedidos.
 */
export async function crearComandaInvitado(items: CartItem[], invitado: DatosInvitado): Promise<ComandaCreada> {
	if (items.some((item) => item.menuItemId === undefined)) {
		throw new Error('Algún platillo no se puede pedir en línea. Recarga el menú e inténtalo de nuevo.');
	}

	const p_items = items.map((item) => ({ menu_item_id: item.menuItemId, cantidad: item.quantity }));
	const { data, error } = await supabase.rpc('create_guest_comanda', {
		p_items,
		p_nombre: invitado.nombre.trim(),
		p_email: invitado.email.trim() || null,
	});

	if (error) {
		console.error('Error creando comanda de invitado:', error);
		throw new Error(error.message || 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
	}

	return toComandaCreada(data);
}

function toComandaCreada(data: { id: number | string; numero_pedido: string; total: number | string; saldo: number | string | null }): ComandaCreada {
	return {
		id: data.id,
		numero_pedido: data.numero_pedido,
		total: Number(data.total),
		saldo: data.saldo === null ? null : Number(data.saldo),
	};
}
