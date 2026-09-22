import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isStaffEmail } from '@/config/staff';
import { supabase } from '@/lib/supabase';

type FunFact = {
  id: string;
  content: string;
  category: string | null;
  active: boolean;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  tip: 'Tip',
  dato_curioso: 'Dato curioso',
  funcionalidad: 'Funcionalidad',
};

export default function FunFactsPage() {
  const { user, loading: authLoading } = useAuth();
  const [facts, setFacts] = useState<FunFact[]>([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fun_facts')
      .select('id, content, category, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('No se pudieron cargar los datos curiosos.');
      console.error('Error cargando datos curiosos:', error);
    } else {
      setFacts((data ?? []) as FunFact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user && isStaffEmail(user.email)) void loadFacts();
  }, [authLoading, user]);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background-50 text-sm text-foreground-600">Cargando…</div>;
  }

  if (!user || !isStaffEmail(user.email)) return <Navigate to="/" replace />;

  const addFact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    const trimmedCategory = category.trim();
    if (!trimmedContent) return;

    setSaving(true);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await supabase.from('fun_facts').insert({
      content: trimmedContent,
      category: trimmedCategory || null,
    });

    if (error) {
      setErrorMessage('No se pudo guardar el dato curioso.');
      console.error('Error guardando dato curioso:', error);
    } else {
      setContent('');
      setCategory('');
      setMessage('Dato curioso agregado.');
      await loadFacts();
    }
    setSaving(false);
  };

  const toggleFact = async (fact: FunFact) => {
    setBusyId(fact.id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await supabase.from('fun_facts').update({ active: !fact.active }).eq('id', fact.id);

    if (error) {
      setErrorMessage('No se pudo cambiar el estado del dato.');
      console.error('Error actualizando dato curioso:', error);
    } else {
      setFacts((currentFacts) => currentFacts.map((currentFact) => (
        currentFact.id === fact.id ? { ...currentFact, active: !fact.active } : currentFact
      )));
    }
    setBusyId(null);
  };

  const deleteFact = async (fact: FunFact) => {
    if (!window.confirm('¿Eliminar este dato curioso?')) return;

    setBusyId(fact.id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await supabase.from('fun_facts').delete().eq('id', fact.id);

    if (error) {
      setErrorMessage('No se pudo eliminar el dato.');
      console.error('Error eliminando dato curioso:', error);
    } else {
      setFacts((currentFacts) => currentFacts.filter((currentFact) => currentFact.id !== fact.id));
      setMessage('Dato curioso eliminado.');
    }
    setBusyId(null);
  };

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Panel de staff</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950 md:text-4xl">Datos curiosos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-600">Administra los mensajes que aparecen en la sección “¿Sabías que...?” de la página principal.</p>
        </header>

        <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="new-fact-title">
          <h2 id="new-fact-title" className="font-heading text-xl font-extrabold text-foreground-950">Agregar un dato</h2>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void addFact(event)}>
            <label className="grid gap-2 text-sm font-semibold text-foreground-800">
              Texto
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Ej. Puedes consultar el menú del día desde la página principal."
                rows={3}
                required
                className="w-full resize-y rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 font-normal text-foreground-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </label>
            <label className="grid max-w-sm gap-2 text-sm font-semibold text-foreground-800">
              Categoría <span className="font-normal text-foreground-500">(opcional)</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 font-normal text-foreground-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              >
                <option value="">Sin categoría</option>
                <option value="tip">Tip</option>
                <option value="dato_curioso">Dato curioso</option>
                <option value="funcionalidad">Funcionalidad</option>
              </select>
            </label>
            <div>
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-add-line'} />
                {saving ? 'Guardando…' : 'Agregar dato'}
              </button>
            </div>
          </form>
        </section>

        {(message || errorMessage) && (
          <p className={`mt-4 text-sm font-semibold ${errorMessage ? 'text-red-700' : 'text-primary-700'}`} role="status">
            {errorMessage ?? message}
          </p>
        )}

        <section className="mt-10" aria-labelledby="facts-list-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Contenido</p>
              <h2 id="facts-list-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Todos los datos</h2>
            </div>
            <span className="text-sm text-foreground-600">{facts.length} {facts.length === 1 ? 'dato' : 'datos'}</span>
          </div>

          {loading ? (
            <p className="mt-5 rounded-xl border border-background-200 bg-background-100 p-5 text-sm text-foreground-600">Cargando datos…</p>
          ) : facts.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-background-300 bg-background-100 p-8 text-center text-sm text-foreground-600">Todavía no hay datos curiosos.</p>
          ) : (
            <div className="mt-5 grid gap-3">
              {facts.map((fact) => (
                <article key={fact.id} className={`rounded-xl border bg-background-100 p-5 transition-opacity ${fact.active ? 'border-background-200' : 'border-background-200 opacity-65'}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${fact.active ? 'bg-primary-100 text-primary-800' : 'bg-background-200 text-foreground-600'}`}>
                          {fact.active ? 'Activo' : 'Inactivo'}
                        </span>
                        {fact.category && <span className="text-xs font-semibold text-accent-800">{categoryLabels[fact.category] ?? fact.category}</span>}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-foreground-800">{fact.content}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === fact.id}
                        onClick={() => void toggleFact(fact)}
                        className="inline-flex items-center gap-2 rounded-lg border border-background-300 px-3 py-2 text-xs font-bold text-foreground-700 transition hover:bg-background-200 disabled:opacity-50"
                      >
                        <i className={fact.active ? 'ri-eye-off-line' : 'ri-eye-line'} />
                        {fact.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === fact.id}
                        onClick={() => void deleteFact(fact)}
                        aria-label="Eliminar dato curioso"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
