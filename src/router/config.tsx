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
    path: "/staff",
    element: <StaffLayout />,
    children: [
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
    ],
  },
  {
    path: "/checkout",
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