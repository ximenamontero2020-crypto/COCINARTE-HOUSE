export type PaymentMethod = 'caja' | 'cafeteria';

export type OrderInfo = {
  orderNumber: string;
  method: PaymentMethod;
  total: number;
};
