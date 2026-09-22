import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import CartList from './components/CartList';
import PaymentMethods from './components/PaymentMethods';
import SuccessScreen from './components/SuccessScreen';
import type { OrderInfo } from '@/pages/checkout/types';
import { guardarComanda } from '@/utils/orders';
export default function Checkout() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderInfo | null>(null);

  const handleSuccess = async (info: OrderInfo) => {
    try {
      await guardarComanda(info, items);
    } catch (err) {
      console.error('No se pudo guardar el pedido:', err);
    }
    setOrder(info);
    clear();
  };

  const goToMenu = () => {
    navigate('/#menu');
    setTimeout(() => {
      const el = document.querySelector('#menu');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background-100">
      <header className="sticky top-0 z-40 bg-background-50/90 backdrop-blur-xl border-b border-background-200/70">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-500 text-background-50">
              <img
                src="https://static.readdy.ai/image/b443135844d971a5ec2a9ef47dead5a2/b2f2a4a276ed34e9f864736fe1afd2e1.png"
                alt="CocinArte"
                className="w-6 h-6 object-contain"
              />
            </span>
            <span className="font-heading font-extrabold text-lg text-foreground-950 whitespace-nowrap">
              COCINARTE <span className="text-accent-500">HOUSE</span>
            </span>
          </Link>
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              goToMenu();
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground-600 hover:text-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            Volver al menú
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-10 md:py-14">
        {order ? (
          <SuccessScreen order={order} />
        ) : items.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16">
            <span className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-background-100 text-foreground-400 text-3xl">
              <i className="ri-shopping-bag-3-line"></i>
            </span>
            <h1 className="mt-6 font-heading font-bold text-2xl text-foreground-950">
              Tu carrito está vacío
            </h1>
            <p className="mt-2 text-sm text-foreground-500">
              Agrega algunos platillos del menú y vuelve para completar tu pedido.
            </p>
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault();
                goToMenu();
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 text-background-50 font-semibold text-sm px-6 py-3 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              Explorar el menú
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold px-4 py-1.5 whitespace-nowrap">
                <i className="ri-shopping-bag-3-fill"></i>
                Checkout
              </span>
              <h1 className="mt-4 font-heading font-extrabold text-3xl md:text-4xl text-foreground-950">
                Completa tu pedido
              </h1>
                            <p className="mt-2 text-foreground-600 text-sm md:text-base">
                Revisa tu pedido y elige tu método de pago.
              </p>
            </div>
          
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3">
                <CartList />
              </div>
              <div className="lg:col-span-2">
                <PaymentMethods onSuccess={handleSuccess} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}