import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ShareSuggestion from './ShareSuggestion';

/** Badge "Comunidad lo pide" a partir de este número de votos. */
const COMMUNITY_VOTES = 10;
/** "Trending": las TRENDING_TOP más votadas, siempre que tengan al menos TRENDING_MIN_VOTES. */
const TRENDING_TOP = 3;
const TRENDING_MIN_VOTES = 3;

type Suggestion = {
  id: number;
  user_id: string;
  nombre: string;
  descripcion: string;
  imagen_url: string | null;
  status: 'pendiente' | 'en_prueba';
  created_at: string;
};
type VoteCount = { suggestion_id: number; nombre: string; total_votos: number };

export default function SuggestionsList() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: rowsError }, { data: voteRows, error: countError }] = await Promise.all([
        supabase.from('food_suggestions').select('id, user_id, nombre, descripcion, imagen_url, status, created_at').in('status', ['pendiente', 'en_prueba']).order('created_at', { ascending: false }),
        supabase.rpc('get_suggestion_vote_counts'),
      ]);
      if (rowsError) throw rowsError;
      if (countError) throw countError;
      const nextCounts: Record<number, number> = {};
      ((voteRows ?? []) as VoteCount[]).forEach((row) => { nextCounts[row.suggestion_id] = row.total_votos; });
      setSuggestions((rows ?? []) as Suggestion[]);
      setCounts(nextCounts);

      if (user && rows?.length) {
        const { data: ownVotes, error: ownVotesError } = await supabase.from('suggestion_votes').select('suggestion_id').eq('user_id', user.id).in('suggestion_id', rows.map((row) => row.id));
        if (ownVotesError) throw ownVotesError;
        setVoted(new Set((ownVotes ?? []).map((row) => row.suggestion_id)));
      } else {
        setVoted(new Set());
      }
    } catch (loadError) {
      console.error('Error cargando propuestas:', loadError);
      setError('No pudimos cargar las propuestas.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Enlace compartido (#propuesta-{id}): la lista carga después del scroll inicial de la landing,
  // así que aquí se hace el scroll una vez que la propuesta existe en el DOM.
  const [scrolledToHash, setScrolledToHash] = useState(false);
  useEffect(() => {
    if (loading || scrolledToHash || !window.location.hash.startsWith('#propuesta-')) return;
    const el = document.querySelector(window.location.hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrolledToHash(true);
  }, [loading, scrolledToHash]);

  // Más votadas primero; empate: la más reciente.
  const ranked = [...suggestions].sort(
    (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || b.created_at.localeCompare(a.created_at),
  );
  const trendingIds = new Set(
    ranked.filter((suggestion) => (counts[suggestion.id] ?? 0) >= TRENDING_MIN_VOTES).slice(0, TRENDING_TOP).map((suggestion) => suggestion.id),
  );

  useEffect(() => {
    const channel = supabase.channel('food-suggestions-list').on('postgres_changes', { event: '*', schema: 'public', table: 'suggestion_votes' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'food_suggestions' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const vote = async (suggestion: Suggestion) => {
    if (!user || suggestion.user_id === user.id || voted.has(suggestion.id)) return;
    setVotingId(suggestion.id);
    setError(null);
    const { error: insertError } = await supabase.from('suggestion_votes').insert({ suggestion_id: suggestion.id, user_id: user.id });
    if (insertError) {
      if (insertError.code === '23505') setError('Ya registraste que te interesa esta propuesta.');
      else setError('No pudimos registrar tu voto.');
    } else {
      setVoted((current) => new Set(current).add(suggestion.id));
      setCounts((current) => ({ ...current, [suggestion.id]: (current[suggestion.id] ?? 0) + 1 }));
    }
    setVotingId(null);
  };

  return (
    <section id="propuestas-menu" className="mt-12">
      <div className="mb-6 text-center"><span className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Menú de la comunidad</span><h3 className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Propuestas que podrían llegar</h3><p className="mt-2 text-sm text-foreground-600">Descubre ideas y vota por las que te gustaría probar.</p></div>
      {loading ? <p className="py-8 text-center text-sm text-foreground-500">Cargando propuestas…</p> : error && !suggestions.length ? <p className="py-8 text-center text-sm text-accent-700">{error}</p> : suggestions.length === 0 ? <p className="rounded-xl bg-background-100 p-6 text-center text-sm text-foreground-600">Aún no hay propuestas activas.</p> : <div className="grid gap-5 md:grid-cols-2">{ranked.map((suggestion) => { const canVote = Boolean(user && user.id !== suggestion.user_id && !voted.has(suggestion.id)); const votes = counts[suggestion.id] ?? 0; const isOwn = suggestion.user_id === user?.id; const highlighted = window.location.hash === `#propuesta-${suggestion.id}`; return <article key={suggestion.id} id={`propuesta-${suggestion.id}`} className={`scroll-mt-28 overflow-hidden rounded-2xl border bg-background-50 ${highlighted ? 'border-primary-400 ring-2 ring-primary-200' : 'border-background-200/70'}`}>{suggestion.imagen_url && <img src={suggestion.imagen_url} alt={suggestion.nombre} className="h-44 w-full object-cover" />}<div className="p-5"><div className="flex items-start justify-between gap-3"><h4 className="font-heading text-lg font-bold text-foreground-950">{suggestion.nombre}</h4><span className="rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-bold uppercase text-primary-800">{suggestion.status === 'en_prueba' ? 'En prueba' : 'Pendiente'}</span></div>{(trendingIds.has(suggestion.id) || votes >= COMMUNITY_VOTES) && <div className="mt-2 flex flex-wrap gap-1.5">{trendingIds.has(suggestion.id) && <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-800"><i className="ri-fire-fill" aria-hidden="true" />Trending</span>}{votes >= COMMUNITY_VOTES && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800"><i className="ri-group-fill" aria-hidden="true" />Comunidad lo pide</span>}</div>}<p className="mt-2 text-sm leading-relaxed text-foreground-600">{suggestion.descripcion}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-sm font-bold text-accent-700">{votes} {votes === 1 ? 'interesado' : 'interesados'}</span><button type="button" disabled={!canVote || votingId === suggestion.id} onClick={() => void vote(suggestion)} className="rounded-md bg-primary-500 px-3 py-2 text-xs font-bold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-45">{votingId === suggestion.id ? 'Guardando…' : voted.has(suggestion.id) ? 'Te interesa' : isOwn ? 'Tu propuesta' : user ? 'Me interesa' : 'Inicia sesión para votar'}</button></div>{isOwn && <ShareSuggestion id={suggestion.id} nombre={suggestion.nombre} compact />}</div></article>; })}</div>}
      {error && suggestions.length > 0 && <p className="mt-3 text-center text-sm text-accent-700">{error}</p>}
    </section>
  );
}
