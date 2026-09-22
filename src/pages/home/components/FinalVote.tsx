import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type FinalResult = { suggestion_id: number; nombre: string; total_votos: number };

export default function FinalVote() {
  const { user } = useAuth();
  const [results, setResults] = useState<FinalResult[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: resultsError } = await supabase.rpc('get_final_vote_results');
      if (resultsError) throw resultsError;
      setResults((data ?? []) as FinalResult[]);
      if (user) {
        const { data: ownVote, error: ownVoteError } = await supabase.rpc('get_my_final_vote');
        if (ownVoteError) throw ownVoteError;
        setMyVote(ownVote?.suggestion_id ?? null);
      } else setMyVote(null);
    } catch (loadError) {
      console.error('Error cargando votación final:', loadError);
      setError('No pudimos cargar la votación final.');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel('final-votes-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'final_votes' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'food_suggestions' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const submit = async () => {
    if (!user || !selected || myVote) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('final_votes').insert({ suggestion_id: selected, user_id: user.id });
    if (insertError) {
      setError(insertError.code === '23505' ? 'Ya registraste tu voto final.' : 'No pudimos guardar tu voto.');
    } else {
      setMyVote(selected);
      setResults((current) => current.map((result) => result.suggestion_id === selected ? { ...result, total_votos: result.total_votos + 1 } : result));
    }
    setSaving(false);
  };

  const maxVotes = Math.max(1, ...results.map((result) => result.total_votos));

  return (
    <section id="votacion-final" className="mt-14">
      <div className="mb-6 text-center"><span className="text-xs font-bold uppercase tracking-[0.15em] text-accent-700">Decisión de la comunidad</span><h3 className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Votación final</h3><p className="mt-2 text-sm text-foreground-600">Elige una sola opción entre los alimentos finalistas.</p></div>
      {loading ? <p className="py-8 text-center text-sm text-foreground-500">Cargando votación…</p> : error && !results.length ? <p className="py-8 text-center text-sm text-accent-700">{error}</p> : results.length === 0 ? <p className="rounded-xl bg-background-100 p-6 text-center text-sm text-foreground-600">La votación final aún no está abierta.</p> : <div className="rounded-2xl border border-background-200/70 bg-background-50 p-5 md:p-7"><div className="space-y-5">{results.map((result) => <label key={result.suggestion_id} className="block cursor-pointer"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-semibold text-foreground-900"><input type="radio" name="final-food-vote" checked={selected === result.suggestion_id || myVote === result.suggestion_id} disabled={!user || Boolean(myVote)} onChange={() => setSelected(result.suggestion_id)} className="accent-primary-600" />{result.nombre}</span><span className="font-bold text-accent-700">{result.total_votos}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background-200"><div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${(result.total_votos / maxVotes) * 100}%` }} /></div></label>)}</div><button type="button" disabled={!user || !selected || Boolean(myVote) || saving} onClick={() => void submit()} className="mt-6 rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Guardando…' : myVote ? 'Voto registrado' : user ? 'Confirmar voto' : 'Inicia sesión para votar'}</button>{error && <p className="mt-3 text-sm text-accent-700">{error}</p>}</div>}
    </section>
  );
}
