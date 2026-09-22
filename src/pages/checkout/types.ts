export type PaymentMethod = 'tarjeta' | 'cafeteria';

export type OrderInfo = {
  orderNumber: string;
  method: PaymentMethod;
  total: number;
};