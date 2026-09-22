import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Review = {
  id: number;
  author_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stars({
  value,
  size = 'text-xl',
}: {
  value: number;
  size?: string;
}) {
  return (
    <span className="flex items-center gap-0.5 text-accent-500">
      {[1, 2, 3, 4, 5].map((i) => (
        <i
          key={i}
          className={`${i <= value ? 'ri-star-fill' : 'ri-star-line'} ${size} ${
            i <= value ? '' : 'text-foreground-300'
          }`}
        ></i>
      ))}
    </span>
  );
}

export default function ReviewsSection() {
  const { user, profile } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, author_name, rating, comment, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReviews(data ?? []);
    } catch {
      setLoadError('No pudimos cargar las reseñas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(false);

    if (rating === 0) {
      setSubmitError('Selecciona una puntuación con las estrellas.');
      return;
    }
    if (!comment.trim()) {
      setSubmitError('Escribe un comentario para tu reseña.');
      return;
    }

    setSubmitting(true);
    try {
      const metadataName =
        typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : '';
      const finalName = (profile?.name?.trim() || metadataName.trim() || name.trim() || 'Anónimo').slice(
        0,
        60,
      );
      const { error } = await supabase.from('reviews').insert({
        user_id: user?.id ?? null,
        author_name: finalName,
        rating,
        comment: comment.trim().slice(0, 500),
      });
      if (error) throw error;

      setSubmitSuccess(true);
      setRating(0);
      setHoverRating(0);
      setComment('');
      setName('');
      await loadReviews();
    } catch {
      setSubmitError('No pudimos guardar tu reseña. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="resenas" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 text-accent-800 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
            <i className="ri-star-fill"></i>
            Reseñas
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground-950">
            Lo que dice la <span className="text-accent-600">comunidad</span>
          </h2>
          <p className="mt-3 text-sm md:text-base text-foreground-600 max-w-2xl mx-auto">
            Cuéntanos qué te pareció tu experiencia. Tu opinión sincera nos ayuda a mejorar cada día.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Resumen de calificación */}
          <div className="lg:col-span-2 rounded-2xl bg-background-50 border border-background-200/70 p-8 flex flex-col items-center justify-center text-center">
            <div className="font-heading font-extrabold text-6xl text-foreground-950">
              {average > 0 ? average.toFixed(1) : '—'}
            </div>
            <div className="mt-3 flex items-center justify-center">
              <Stars value={Math.round(average)} size="text-2xl" />
            </div>
            <p className="mt-3 text-sm text-foreground-600">
              {reviews.length > 0
                ? `Basado en ${reviews.length} ${reviews.length === 1 ? 'reseña' : 'reseñas'}`
                : 'Aún no hay reseñas'}
            </p>
          </div>

          {/* Formulario de reseña */}
          <div className="lg:col-span-3 rounded-2xl bg-background-50 border border-background-200/70 p-6 md:p-8">
            <h3 className="font-heading font-bold text-lg text-foreground-950">
              Deja tu reseña
            </h3>
            <p className="mt-1 text-sm text-foreground-600">
              Califica tu experiencia de 1 a 5 estrellas.
            </p>

            <div className="mt-5">
              <span className="block text-sm font-medium text-foreground-800 mb-2">
                Tu puntuación
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
                    className={`w-11 h-11 flex items-center justify-center rounded-md cursor-pointer transition-transform hover:scale-110 ${
                      i <= (hoverRating || rating) ? 'text-accent-500' : 'text-foreground-300'
                    }`}
                  >
                    <i className={`${i <= (hoverRating || rating) ? 'ri-star-fill' : 'ri-star-line'} text-3xl`}></i>
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-3 text-sm font-semibold text-foreground-700 whitespace-nowrap">
                    {rating} / 5
                  </span>
                )}
              </div>
            </div>

            {!user && (
              <div className="mt-5">
                <label htmlFor="review-name" className="block text-sm font-medium text-foreground-800 mb-1.5">
                  Tu nombre
                </label>
                <input
                  id="review-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mariana"
                  maxLength={60}
                  className="w-full rounded-md border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                />
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="review-comment" className="block text-sm font-medium text-foreground-800 mb-1.5">
                Tu comentario
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Cuéntanos qué pediste, qué tal el sabor, el ambiente, el servicio…"
                maxLength={500}
                rows={4}
                className="w-full rounded-md border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 resize-none"
              />
              <p className="mt-1 text-xs text-foreground-400 text-right">{comment.length}/500</p>
            </div>

            {submitError && (
              <p className="mt-3 text-sm text-accent-700 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {submitError}
              </p>
            )}
            {submitSuccess && (
              <p className="mt-3 text-sm text-primary-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                ¡Gracias por tu reseña! Ya aparece abajo.
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary-500 text-background-50 px-6 py-3 text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Enviando…
                </>
              ) : (
                <>
                  <i className="ri-send-plane-2-fill"></i>
                  Publicar reseña
                </>
              )}
            </button>
          </div>
        </div>

        {/* Listado de reseñas */}
        {loading ? (
          <div className="py-12 text-center">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
          </div>
        ) : loadError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-foreground-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadReviews()}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-500 text-background-50 px-5 py-2.5 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i>
              Reintentar
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground-500">
            Aún no hay reseñas. ¡Sé el primero en compartir tu opinión!
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl bg-background-50 border border-background-200/70 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                    {(review.author_name ?? 'A').charAt(0).toUpperCase()}
                  </span>
                  <Stars value={review.rating} size="text-base" />
                </div>
                <p className="mt-4 text-sm text-foreground-800 leading-relaxed">
                  {review.comment}
                </p>
                <p className="mt-4 text-xs text-foreground-500 flex items-center gap-1.5">
                  <i className="ri-time-line"></i>
                  {review.author_name} · {formatDate(review.created_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}