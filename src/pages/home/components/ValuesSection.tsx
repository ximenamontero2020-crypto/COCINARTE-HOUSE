import CommunityPosts from './CommunityPosts';

const values = [
  {
    icon: 'ri-flashlight-fill',
    title: 'Buffet rápido',
    description:
      'Entra, elige y sigue con tu día. Servimos rápido para que aproveches cada minuto de tu descanso.',
  },
  {
    icon: 'ri-leaf-fill',
    title: 'Ingredientes de alta calidad',
    description:
      'Frutas y verduras frescas, panes artesanales y café de especialidad, seleccionados con cariño.',
  },
  {
    icon: 'ri-heart-3-fill',
    title: 'El mejor ambiente',
    description:
      'Un espacio pensado para estudiar, convivir y recargar energía con tus amigos del campus.',
  },
];

export default function ValuesSection() {
  return (
    <section id="valores" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-50">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 text-accent-800 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
            <i className="ri-heart-3-fill"></i>
            Nuestros valores
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground-950">
            Más que comida, <span className="text-accent-600">una experiencia</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl bg-background-100 border border-background-200/70 p-8 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 text-2xl">
                <i className={v.icon}></i>
              </span>
              <h3 className="mt-5 font-heading font-bold text-lg text-foreground-950">
                {v.title}
              </h3>
              <p className="mt-3 text-sm text-foreground-600 leading-relaxed">{v.description}</p>
            </div>
          ))}
        </div>

        <CommunityPosts />
      </div>
    </section>
  );
}