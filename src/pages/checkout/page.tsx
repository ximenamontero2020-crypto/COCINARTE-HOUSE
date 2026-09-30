import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import CartList from './components/CartList';
import PaymentMethods from './components/PaymentMethods';
import SuccessScreen from './components/SuccessScreen';
import GuestDetails from './components/GuestDetails';
import { datosInvitadoValidos } from './guest';
import type { OrderInfo } from '@/pages/checkout/types';
import { crearComanda, crearComandaInvitado, type DatosInvitado } from '@/utils/orders';
import { useAuth } from '@/context/AuthContext';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

export default function Checkout() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const { session, loading: authLoading } = useAuth();
  const isGuest = !authLoading && !session;
  // Datos del invitado solo en memoria: no se guardan en el navegador.
  const [guest, setGuest] = useState<DatosInvitado>({ nombre: '', email: '' });

  // Si la RPC falla, el error sube al panel de pago y no se confirma nada.
  // Invitado: create_guest_comanda (siempre 'caja'); con sesión: create_comanda / tarjeta.
  const handleConfirm = async (method: 'cafeteria' | 'caja') => {
    const comanda = isGuest ? await crearComandaInvitado(items, guest) : await crearComanda(items, method);
    track('place_order', { method, guest: isGuest, value: comanda.total, item_count: items.reduce((n, i) => n + i.quantity, 0) });
    setOrder({ orderNumber: comanda.numero_pedido, method, total: comanda.total, guestName: isGuest ? guest.nombre.trim() : undefined });
    clear();
  };

  // Pasarela prototipo: solo pantalla de demostración. No llama create_comanda, no escribe en
  // Supabase, no manda nada a cocina y no vacía el carrito (el pedido real sigue pendiente).
  const handleMockPaid = (reference: string) => {
    setOrder({ method: 'pasarela', reference, total: items.reduce((s, i) => s + i.priceValue * i.quantity, 0) });
  };

  // Efectivo solo si ningún producto requiere preparación (ver PaymentMethod en types.ts).
  // Se relee de menu_items: el carrito puede traer el dato viejo o venir de una recomendación
  // que no lo incluye. Mientras carga o si falla, el efectivo queda bloqueado.
  const itemIds = items.map((i) => i.menuItemId).filter((id): id is number => id !== undefined);
  const idsKey = [...new Set(itemIds)].sort((a, b) => a - b).join(',');
  const [cashFlags, setCashFlags] = useState<Map<number, boolean>>(new Map());
  useEffect(() => {
    if (!idsKey) return;
    let active = true;
    void supabase
      .from('menu_items')
      .select('id, pago_en_caja_permitido')
      .in('id', idsKey.split(',').map(Number))
      .then(({ data, error }) => {
        if (error) console.error('Error leyendo pago en efectivo:', error);
        if (active) setCashFlags(new Map((data ?? []).map((r) => [r.id as number, r.pago_en_caja_permitido === true])));
      });
    return () => {
      active = false;
    };
  }, [idsKey]);
  const cashAllowed =
    items.length > 0 && items.every((i) => i.menuItemId !== undefined && cashFlags.get(i.menuItemId) === true);

  // Una vez por visita al checkout, solo si hay algo en el carrito.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || order || items.length === 0) return;
    checkoutTracked.current = true;
    track('begin_checkout', {
      item_count: items.reduce((n, i) => n + i.quantity, 0),
      value: items.reduce((s, i) => s + i.priceValue * i.quantity, 0),
    });
  }, [items, order]);

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
          <Link to="/" className="flex min-w-0 items-center gap-2 cursor-pointer">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-background-50">
              <img
                src="https://static.readdy.ai/image/b443135844d971a5ec2a9ef47dead5a2/b2f2a4a276ed34e9f864736fe1afd2e1.png"
                alt="CocinArte"
                className="w-6 h-6 object-contain"
              />
            </span>
            <span className="font-heading font-extrabold text-base sm:text-lg text-foreground-950 whitespace-nowrap max-[359px]:text-sm max-[359px]:leading-none">
              COCINARTE <span className="text-accent-500 max-[359px]:block">HOUSE</span>
            </span>
          </Link>
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              goToMenu();
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-foreground-600 hover:text-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            Volver al menú
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] md:py-14">
        {order ? (
          <SuccessScreen order={order} isGuest={isGuest} />
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
              <div className="lg:col-span-2 space-y-5">
                {authLoading ? (
                  <p className="text-sm text-foreground-500">Cargando…</p>
                ) : (
                  <>
                    {isGuest && <GuestDetails value={guest} onChange={setGuest} />}
                    <PaymentMethods
                      onConfirm={handleConfirm}
                      onMockPaid={handleMockPaid}
                      cashAllowed={cashAllowed}
                      isGuest={isGuest}
                      guestReady={datosInvitadoValidos(guest)}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}