import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { MenuCategory, MenuItem } from '@/mocks/menu';
import DishCard from './DishCard';

type RecommendationRow = MenuItem & {
  category_id: string;
  category_title: string;
  category_subtitle: string;
  category_image: string;
  purchased_quantity: number | string;
};

export default function PersonalRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setRecommendations([]);
      return () => {
        active = false;
      };
    }

    const loadRecommendations = async () => {
      const { data, error } = await supabase.rpc('get_recomendaciones_usuario', { p_user_id: user.id });
      if (error) {
        console.error('Error cargando recomendaciones personales:', error);
        return;
      }
      if (active) setRecommendations((data ?? []) as RecommendationRow[]);
    };

    void loadRecommendations();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || recommendations.length === 0) return null;

  const categories = new Map<string, MenuCategory>();
  for (const item of recommendations) {
    const category = categories.get(item.category_id) ?? {
      id: item.category_id,
      title: item.category_title,
      subtitle: item.category_subtitle,
      image: item.category_image,
      items: [],
    };
    category.items.push(item);
    categories.set(item.category_id, category);
  }

  return (
    <section className="w-full bg-background-50 px-4 py-16 md:px-6 md:py-20" aria-labelledby="personal-recommendations-title">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Para ti</p>
          <h2 id="personal-recommendations-title" className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Basado en tus compras</h2>
          <p className="mt-2 text-sm text-foreground-600">Platillos que has disfrutado recientemente.</p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {[...categories.values()].map((category) => <DishCard key={category.id} category={category} />)}
        </div>
      </div>
    </section>
  );
}
