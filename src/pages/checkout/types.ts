/**
 * - 'cafeteria': Tarjeta CocinArte, el servidor cobra el saldo al crear la comanda.
 * - 'pasarela': pasarela de pago PROTOTIPO. No cobra, no llama a Supabase y nunca
 *   crea pedidos ni los manda a cocina (create_comanda también la rechaza).
 * - 'caja': efectivo al recoger, SOLO si ningún producto requiere preparación. Si algo
 *   que se prepara se paga al recoger y el cliente no llega, la comida se prepara y se
 *   desperdicia; el efectivo es pago contra entrega solo para productos listos.
 */
export type PaymentMethod = 'cafeteria' | 'pasarela' | 'caja';

export type OrderInfo =
  | {
      method: 'cafeteria' | 'caja';
      orderNumber: string;
      total: number;
    }
  | {
      // Demostración: no hay número de pedido de BD porque no se creó nada.
      method: 'pasarela';
      reference: string;
      total: number;
    };
