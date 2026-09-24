import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Hamburger3D from './components/Hamburger3D';
import MenuSection from './components/MenuSection';
import ValuesSection from './components/ValuesSection';
import ReviewsSection from './components/ReviewsSection';
import Footer from './components/Footer';
import CafeteriaStatus from './components/CafeteriaStatus';
import SuggestFood from './components/SuggestFood';
import SuggestionsList from './components/SuggestionsList';
import FinalVote from './components/FinalVote';
import FunFactWidget from './components/FunFactWidget';
import PersonalRecommendations from './components/PersonalRecommendations';
import CampusWeather from './components/CampusWeather';
import { track } from '@/lib/analytics';

export default function Home() {
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // view_menu: una vez por visita, cuando al menos 25% del menú entra en pantalla.
  useEffect(() => {
    const el = menuRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          track('view_menu');
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hash = window.location.hash || location.hash;
    if (!hash) return;

    const scrollToHash = () => {
      const el = document.querySelector(hash);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    };

    // Intentos progresivos: algunos elementos tardan en renderizarse
    const t1 = window.setTimeout(scrollToHash, 100);
    const t2 = window.setTimeout(scrollToHash, 400);
    const t3 = window.setTimeout(scrollToHash, 800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [location.hash, location.pathname, location.key]);

  return (
    <main className="relative min-h-screen bg-background-50">
      <Navbar />
      <Hero />
      <CafeteriaStatus />
      <FunFactWidget />
      <Hamburger3D />
      <CampusWeather />
      <PersonalRecommendations />
      <div ref={menuRef}>
        <MenuSection />
      </div>
      <ValuesSection />
      <section id="propuestas" className="w-full bg-background-100 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SuggestFood />
          <SuggestionsList />
          <FinalVote />
        </div>
      </section>
      <ReviewsSection />
      <Footer />
    </main>
  );
}