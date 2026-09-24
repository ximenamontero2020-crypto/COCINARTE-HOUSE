import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home/page";
import Checkout from "@/pages/checkout/page";
import AuthPage from "@/pages/auth/page";
import CallbackPage from "@/pages/auth/CallbackPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import AuthGuard from "@/components/feature/AuthGuard";
import CafeteriaStatusPage from "@/pages/staff/CafeteriaStatusPage";
import AccountPage from "@/pages/account/page";
import FunFactsPage from "@/pages/staff/FunFactsPage";
import AlmacenPage from "@/pages/staff/AlmacenPage";
import StaffLayout from "@/components/feature/StaffLayout";
import CorteCajaPage from "@/pages/staff/CorteCajaPage";
import StaffLoginPage from "@/pages/staff/StaffLoginPage";
import StaffHubPage from "@/pages/staff/StaffHubPage";
import AuditoriaPage from "@/pages/staff/AuditoriaPage";
import InsightsPage from "@/pages/staff/InsightsPage";
import ProveedoresPage from "@/pages/staff/ProveedoresPage";

// Lazy: Recharts solo se descarga al abrir /staff/pareto.
const ParetoPage = lazy(() => import("@/pages/staff/ParetoPage"));

const routes: RouteObject[] = [
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/auth/callback",
    element: <CallbackPage />,
  },
  {
    path: "/auth/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/",
    element: <Home />,
  },
  {
    // Fuera de StaffLayout: es la única ruta /staff/* sin guard de rol.
    path: "/staff/login",
    element: <StaffLoginPage />,
  },
  {
    path: "/staff",
    element: <StaffLayout />,
    children: [
      {
        index: true,
        element: <StaffHubPage />,
      },
      {
        path: "cafeteria-status",
        element: <CafeteriaStatusPage />,
      },
      {
        path: "fun-facts",
        element: <FunFactsPage />,
      },
      {
        path: "almacen",
        element: <AlmacenPage />,
      },
      {
        path: "corte-caja",
        element: <CorteCajaPage />,
      },
      {
        path: "proveedores",
        element: <ProveedoresPage />,
      },
      {
        path: "pareto",
        element: (
          <Suspense fallback={<div className="p-8 text-center text-sm text-foreground-600">Cargando…</div>}>
            <ParetoPage />
          </Suspense>
        ),
      },
      {
        path: "insights",
        element: <InsightsPage />,
      },
      {
        path: "auditoria",
        element: <AuditoriaPage />,
      },
    ],
  },
  {
    path: "/checkout",
    // TODO(guest): create_comanda exige auth.uid(). Si se decide permitir pedidos
    // sin cuenta, hace falta una RPC para invitados (sin user_id, con límite de uso)
    // antes de quitar este AuthGuard.
    element: (
      <AuthGuard>
        <Checkout />
      </AuthGuard>
    ),
  },
  {
    path: "/account",
    element: (
      <AuthGuard>
        <AccountPage />
      </AuthGuard>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;