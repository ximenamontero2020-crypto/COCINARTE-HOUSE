import { BrowserRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import BackgroundMusic from "./components/BackgroundMusic";
import ChatbotWidget from "./components/ChatbotWidget";
import WhatsAppFab from "./components/WhatsAppFab";

function PublicChatbot() {
  const { pathname } = useLocation();
  const isStaffRoute = pathname === '/staff' || pathname.startsWith('/staff/');

  return isStaffRoute ? null : <ChatbotWidget />;
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <AuthProvider>
          <CartProvider>
            <BackgroundMusic />
            <AppRoutes />
            <PublicChatbot />
            <WhatsAppFab />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
