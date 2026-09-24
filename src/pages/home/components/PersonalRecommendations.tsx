import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { MEMBERSHIP_LEVELS, membershipProgress, normalizeMembershipLevel } from '@/components/membership';
import { formatPrice } from '@/utils/price';
import DishQuickList, { type QuickDish } from './DishQuickList';

const MAX_ITEMS = 3;

type Recommended = QuickDish;

type Source = 'personal' | 'populares';

const SUBTITLE: Record<Source, string> = {
  personal: 'Lo que más pides últimamente.',
  populares: 'Lo más pedido en CocinArte en los últimos 30 días.',
};

async function loadPersonal(userId: string): Promise<Recommended[]> {
  const { data, error } = await supabase.rpc('get_recomendaciones_usuario', { p_user_id: userId });
  if (error) console.error('Error cargando recomendaciones personales:', error);
  return ((data ?? []) as Recommended[]).slice(0, MAX_ITEMS);
}

async function loadBestsellers(): Promise<Recommended[]> {
  const { data, error } = await supabase.rpc('get_productos_mas_vendidos', { p_limite: MAX_ITEMS });
  if (error) console.error('Error cargando más vendidos:', error);
  return ((data ?? []) as Recommended[]).slice(0, MAX_ITEMS);
}

function MembershipStrip({ level: rawLevel, spend }: { level: string | null | undefined; spend: number }) {
  const level = normalizeMembershipLevel(rawLevel);
  const visual = MEMBERSHIP_LEVELS[level];
  const { next, remaining, percent } = membershipProgress(level, spend);

  return (
    <div className="mb-6 rounded-2xl border border-background-200/70 bg-background-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${visual.badgeClassName}`}>
          {visual.icon && <i className={visual.icon} aria-hidden="true" />}
          {visual.label}
        </span>
        <span className="text-xs text-foreground-600">
          {next ? `Te faltan ${formatPrice(Math.ceil(remaining))} para ${next.label}` : '¡Nivel máximo este mes!'}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"
        role="progressbar"
        aria-label={next ? `Progreso hacia ${next.label}` : 'Nivel máximo'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className={`h-full rounded-full ${visual.progressClassName}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// Solo con sesión: recomendación por frecuencia propia → más vendidos. Para anónimos, el clima
// y los más vendidos ya los muestra "Hoy en el campus" (CampusWeather), justo arriba.
export default function PersonalRecommendations() {
  const { user, profile } = useAuth();
  const [picks, setPicks] = useState<Recommended[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setPicks([]);
      setSource(null);
      return;
    }
    let active = true;

    const load = async () => {
      let result = await loadPersonal(userId);
      let from: Source = 'personal';
      if (result.length === 0) {
        result = await loadBestsellers();
        from = 'populares';
      }
      if (!active) return;
      setPicks(result);
      setSource(from);
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  if (!user || picks.length === 0 || !source) return null;

  const subtitle = SUBTITLE[source];

  return (
    <section className="w-full bg-background-50 px-4 py-12 md:px-6 md:py-16" aria-labelledby="para-ti-title">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Para ti</p>
        <h2 id="para-ti-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950 md:text-3xl">
          Tus recomendados
        </h2>
        {subtitle && <p className="mt-1 text-sm text-foreground-600">{subtitle}</p>}

        <div className="mt-6">
          {profile && (
            <MembershipStrip level={profile.membership_level} spend={Math.max(0, Number(profile.membership_current_spend ?? 0))} />
          )}

          <DishQuickList items={picks} />
        </div>
      </div>
    </section>
  );
}
