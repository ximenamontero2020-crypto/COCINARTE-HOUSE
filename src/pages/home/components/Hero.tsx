import { AnimWordCurtainReveal } from '@readdy/anim/header/word-curtain-reveal/react';

export default function Hero() {
  return (
    <section id="hero" className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage:
            "url('https://storage.helloreaddy.io/project_files/651dc592-6ced-4611-8403-19a57914a6fa/67160e6f-1aad-47cd-9f4b-5fb4dc117557_compressed_WhatsApp-Image-2026-09-05-at-5.03.28-PM.webp')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 via-40% to-black/30"></div>

      <div className="relative z-10 w-full h-full min-h-screen px-4 md:px-6 pt-2 pb-1 flex flex-col items-center justify-between text-center">
        <div className="pt-8 md:pt-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-background-50/10 backdrop-blur-md border border-background-50/15 text-background-50 text-xs md:text-sm font-medium px-4 py-2 mb-4 animate-pop-in whitespace-nowrap">
            <i className="ri-map-pin-2-fill text-accent-400"></i>
            Campus Tecmilenio · Tu punto de encuentro
          </span>

          <AnimWordCurtainReveal stagger={90} duration={850}>
            <h1 className="font-heading font-extrabold text-2xl md:text-4xl text-background-50/90 leading-tight max-w-3xl mx-auto animate-pop-in drop-shadow-lg">
              Bienvenidos a la evolución del sabor:
            </h1>
          </AnimWordCurtainReveal>
        </div>

        <div className="pb-2 md:pb-3 flex flex-col items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-pop-in">
            <a
              href="#hamburguesa-3d"
              className="inline-flex items-center gap-2 rounded-full bg-primary-500/80 text-background-50 font-semibold text-sm md:text-base px-8 py-4 whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors backdrop-blur-sm"
            >
              <i className="ri-box-3-fill"></i>
              Explorar Hamburguesa 3D
            </a>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 rounded-full bg-accent-500/80 text-foreground-950 font-semibold text-sm md:text-base px-8 py-4 whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors backdrop-blur-sm"
            >
              <i className="ri-vip-crown-fill"></i>
              Pide y Gana un descuento
            </a>
          </div>

          <div className="flex items-center gap-8 md:gap-12 text-background-50/90">
            {[
              { n: '20+', l: 'Platillos' },
              { n: '100%', l: 'Fresco' },
              { n: '10+', l: 'Recompensas' },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="font-heading font-extrabold text-2xl md:text-3xl text-accent-400 drop-shadow">
                  {s.n}
                </div>
                <div className="text-sm md:text-base mt-1 text-background-50 font-medium">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}