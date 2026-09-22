import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FunFact = {
  id: string;
  content: string;
  category: string | null;
};

const ROTATION_INTERVAL_MS = 18_000;
const FADE_DURATION_MS = 350;

const categoryLabels: Record<string, string> = {
  tip: 'Tip de CocinArte',
  dato_curioso: 'Dato curioso',
  funcionalidad: 'Funcionalidad',
};

function getRandomFact(facts: FunFact[], currentId?: string) {
  const availableFacts = currentId ? facts.filter((fact) => fact.id !== currentId) : facts;
  const pool = availableFacts.length > 0 ? availableFacts : facts;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function FunFactWidget() {
  const [facts, setFacts] = useState<FunFact[]>([]);
  const [currentFact, setCurrentFact] = useState<FunFact | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadFacts = async () => {
      const { data, error } = await supabase
        .from('fun_facts')
        .select('id, content, category')
        .eq('active', true);

      if (error) {
        console.error('Error cargando datos curiosos:', error);
        return;
      }

      if (!isMounted) return;
      const loadedFacts = (data ?? []) as FunFact[];
      setFacts(loadedFacts);
      setCurrentFact(getRandomFact(loadedFacts) ?? null);
    };

    void loadFacts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (facts.length < 2) return;

    const intervalId = window.setInterval(() => {
      setIsVisible(false);
      window.setTimeout(() => {
        setCurrentFact((previousFact) => getRandomFact(facts, previousFact?.id));
        setIsVisible(true);
      }, FADE_DURATION_MS);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [facts]);

  if (!currentFact) return null;

  const label = currentFact.category ? categoryLabels[currentFact.category] ?? currentFact.category : 'Para disfrutar CocinArte';

  return (
    <section className="w-full border-y border-accent-200/70 bg-accent-50 px-4 py-8 md:px-6" aria-labelledby="fun-fact-title">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-accent-300/70 bg-[#fff8e6] px-5 py-6 shadow-[0_12px_30px_rgba(122,84,24,0.12)] md:flex md:items-center md:gap-6 md:px-8 md:py-7">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-500 text-3xl text-foreground-950 shadow-sm" aria-hidden="true">
            <i className="ri-lightbulb-flash-fill" />
          </div>
          <div className={`mt-5 transition-opacity duration-300 md:mt-0 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-800">{label}</p>
            <h2 id="fun-fact-title" className="mt-2 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">
              ¿Sabías que...?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-700 md:text-base">{currentFact.content}</p>
          </div>
          <i className="ri-question-mark absolute -right-2 -top-4 text-8xl text-accent-200/60" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
