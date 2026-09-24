import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  cantidad_actual: number | string;
  umbral_minimo: number | string;
};

type MenuItem = {
  id: number;
  name: string;
};

type Recipe = {
  id: string;
  menu_item_id: number;
  insumo_id: string;
  cantidad_requerida: number | string;
};

const numberValue = (value: number | string) => Number(value) || 0;

export default function AlmacenPage() {
  const { user, loading: authLoading } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newQuantity, setNewQuantity] = useState('0');
  const [newThreshold, setNewThreshold] = useState('0');
  const [recipeInsumoId, setRecipeInsumoId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState('');

  const loadInsumosAndMenu = async () => {
    setLoading(true);
    const [insumosResult, menuResult] = await Promise.all([
      supabase.from('insumos').select('id, nombre, unidad, cantidad_actual, umbral_minimo').order('nombre'),
      supabase.from('menu_items').select('id, name').order('name'),
    ]);

    if (insumosResult.error || menuResult.error) {
      setErrorMessage('No se pudieron cargar los datos del almacén.');
      console.error('Error cargando almacén:', insumosResult.error ?? menuResult.error);
    } else {
      setInsumos((insumosResult.data ?? []) as Insumo[]);
      setMenuItems((menuResult.data ?? []) as MenuItem[]);
    }
    setLoading(false);
  };

  const loadRecipes = async (menuItemId: string) => {
    if (!menuItemId) {
      setRecipes([]);
      return;
    }

    setRecipesLoading(true);
    const { data, error } = await supabase
      .from('receta_platillo')
      .select('id, menu_item_id, insumo_id, cantidad_requerida')
      .eq('menu_item_id', Number(menuItemId));

    if (error) {
      setErrorMessage('No se pudo cargar la receta del platillo.');
      console.error('Error cargando receta:', error);
    } else {
      setRecipes((data ?? []) as Recipe[]);
    }
    setRecipesLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) void loadInsumosAndMenu();
  }, [authLoading, user]);

  useEffect(() => {
    void loadRecipes(selectedMenuItemId);
  }, [selectedMenuItemId]);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background-50 text-sm text-foreground-600">Cargando…</div>;
  }

  if (!user) return <Navigate to="/" replace />;

  const showSuccess = (text: string) => {
    setMessage(text);
    setErrorMessage(null);
  };

  const showError = (text: string, error: unknown) => {
    setErrorMessage(text);
    setMessage(null);
    console.error(text, error);
  };

  const addInsumo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newName.trim() || !newUnit.trim()) return;

    setSaving(true);
    const { error } = await supabase.from('insumos').insert({
      nombre: newName.trim(),
      unidad: newUnit.trim(),
      cantidad_actual: Math.max(0, Number(newQuantity) || 0),
      umbral_minimo: Math.max(0, Number(newThreshold) || 0),
    });

    if (error) {
      showError('No se pudo agregar el insumo.', error);
    } else {
      setNewName('');
      setNewUnit('');
      setNewQuantity('0');
      setNewThreshold('0');
      showSuccess('Insumo agregado.');
      await loadInsumosAndMenu();
    }
    setSaving(false);
  };

  const updateInsumo = async (insumo: Insumo, field: 'cantidad_actual' | 'umbral_minimo', value: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return;

    setBusyId(insumo.id);
    const { error } = await supabase
      .from('insumos')
      .update({ [field]: numericValue, updated_at: new Date().toISOString() })
      .eq('id', insumo.id);

    if (error) {
      showError('No se pudo actualizar el insumo.', error);
    } else {
      setInsumos((current) => current.map((item) => item.id === insumo.id ? { ...item, [field]: numericValue } : item));
      showSuccess('Insumo actualizado.');
    }
    setBusyId(null);
  };

  const deleteInsumo = async (insumo: Insumo) => {
    if (!window.confirm(`¿Eliminar ${insumo.nombre}? Las recetas asociadas también se eliminarán.`)) return;

    setBusyId(insumo.id);
    const { error } = await supabase.from('insumos').delete().eq('id', insumo.id);
    if (error) {
      showError('No se pudo eliminar el insumo.', error);
    } else {
      setInsumos((current) => current.filter((item) => item.id !== insumo.id));
      setRecipes((current) => current.filter((recipe) => recipe.insumo_id !== insumo.id));
      showSuccess('Insumo eliminado.');
    }
    setBusyId(null);
  };

  const addRecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(recipeQuantity);
    if (!selectedMenuItemId || !recipeInsumoId || !Number.isFinite(quantity) || quantity <= 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('receta_platillo')
      .insert({
        menu_item_id: Number(selectedMenuItemId),
        insumo_id: recipeInsumoId,
        cantidad_requerida: quantity,
      })
      .select('id, menu_item_id, insumo_id, cantidad_requerida')
      .single();

    if (error) {
      showError(error.code === '23505' ? 'Ese insumo ya está asignado a este platillo.' : 'No se pudo agregar el insumo a la receta.', error);
    } else {
      setRecipes((current) => [...current, data as Recipe]);
      setRecipeInsumoId('');
      setRecipeQuantity('');
      showSuccess('Insumo agregado a la receta.');
    }
    setSaving(false);
  };

  const updateRecipe = async (recipe: Recipe, value: string) => {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    setBusyId(recipe.id);
    const { error } = await supabase.from('receta_platillo').update({ cantidad_requerida: quantity }).eq('id', recipe.id);
    if (error) {
      showError('No se pudo actualizar la cantidad de la receta.', error);
    } else {
      setRecipes((current) => current.map((item) => item.id === recipe.id ? { ...item, cantidad_requerida: quantity } : item));
      showSuccess('Receta actualizada.');
    }
    setBusyId(null);
  };

  const deleteRecipe = async (recipe: Recipe) => {
    setBusyId(recipe.id);
    const { error } = await supabase.from('receta_platillo').delete().eq('id', recipe.id);
    if (error) {
      showError('No se pudo quitar el insumo de la receta.', error);
    } else {
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
      showSuccess('Insumo quitado de la receta.');
    }
    setBusyId(null);
  };

  const selectedMenuItem = menuItems.find((item) => String(item.id) === selectedMenuItemId);
  const availableInsumos = insumos.filter((insumo) => !recipes.some((recipe) => recipe.insumo_id === insumo.id));

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Panel de staff</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950 md:text-4xl">Almacén digital</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-600">Administra existencias y define cuánto descuenta cada platillo al venderse.</p>
        </header>

        {(message || errorMessage) && <p className={`mb-5 text-sm font-semibold ${errorMessage ? 'text-red-700' : 'text-primary-700'}`} role="status">{errorMessage ?? message}</p>}

        <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="stock-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Existencias</p>
              <h2 id="stock-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Gestión de insumos</h2>
            </div>
            <span className="text-sm text-foreground-600">{insumos.length} {insumos.length === 1 ? 'insumo' : 'insumos'}</span>
          </div>

          <form className="mt-6 grid gap-3 rounded-xl border border-background-200 bg-background-50 p-4 md:grid-cols-5" onSubmit={(event) => void addInsumo(event)}>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nombre del insumo" required className="rounded-lg border border-background-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
            <input value={newUnit} onChange={(event) => setNewUnit(event.target.value)} placeholder="Unidad (kg, piezas…)" required className="rounded-lg border border-background-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
            <input value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} type="number" min="0" step="any" placeholder="Cantidad inicial" className="rounded-lg border border-background-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
            <input value={newThreshold} onChange={(event) => setNewThreshold(event.target.value)} type="number" min="0" step="any" placeholder="Umbral mínimo" className="rounded-lg border border-background-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
            <button type="submit" disabled={saving || !newName.trim() || !newUnit.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"><i className="ri-add-line" />Agregar insumo</button>
          </form>

          {loading ? <p className="mt-5 text-sm text-foreground-600">Cargando almacén…</p> : insumos.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-background-300 p-8 text-center text-sm text-foreground-600">Todavía no hay insumos registrados.</p> : (
            <div className="mt-5 grid gap-3">
              {insumos.map((insumo) => {
                const quantity = numberValue(insumo.cantidad_actual);
                const threshold = numberValue(insumo.umbral_minimo);
                const lowStock = quantity <= threshold;
                return (
                  <article key={insumo.id} className={`rounded-xl border bg-background-50 p-4 ${lowStock ? 'border-red-300 bg-red-50/40' : 'border-background-200'}`}>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_150px_150px_auto] md:items-center">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-foreground-950">{insumo.nombre}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground-600">{lowStock && <i className="ri-error-warning-fill text-red-600" />} {lowStock ? 'Stock bajo' : 'Stock disponible'} · unidad: {insumo.unidad}</p>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold text-foreground-600">Cantidad actual<input type="number" min="0" step="any" defaultValue={quantity} disabled={busyId === insumo.id} onBlur={(event) => { if (event.target.value !== String(quantity)) void updateInsumo(insumo, 'cantidad_actual', event.target.value); }} className="w-full rounded-lg border border-background-300 px-3 py-2 text-sm font-normal text-foreground-900" /></label>
                      <label className="grid gap-1 text-xs font-semibold text-foreground-600">Umbral mínimo<input type="number" min="0" step="any" defaultValue={threshold} disabled={busyId === insumo.id} onBlur={(event) => { if (event.target.value !== String(threshold)) void updateInsumo(insumo, 'umbral_minimo', event.target.value); }} className="w-full rounded-lg border border-background-300 px-3 py-2 text-sm font-normal text-foreground-900" /></label>
                      <button type="button" disabled={busyId === insumo.id} onClick={() => void deleteInsumo(insumo)} aria-label={`Eliminar ${insumo.nombre}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><i className="ri-delete-bin-line" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="recipes-title">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Consumo automático</p>
            <h2 id="recipes-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Recetas por platillo</h2>
            <p className="mt-2 text-sm text-foreground-600">Cada venta descontará estas cantidades del almacén.</p>
          </div>

          <label className="mt-6 grid max-w-xl gap-2 text-sm font-semibold text-foreground-800">Platillo del menú<select value={selectedMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)} className="rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 font-normal outline-none focus:border-primary-500"><option value="">Selecciona un platillo</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>

          {selectedMenuItem && <>
            <form className="mt-5 grid gap-3 rounded-xl border border-background-200 bg-background-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={(event) => void addRecipe(event)}>
              <select value={recipeInsumoId} onChange={(event) => setRecipeInsumoId(event.target.value)} required className="rounded-lg border border-background-300 px-3 py-2.5 text-sm"><option value="">Selecciona un insumo</option>{availableInsumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.nombre} ({insumo.unidad})</option>)}</select>
              <input value={recipeQuantity} onChange={(event) => setRecipeQuantity(event.target.value)} type="number" min="0.0001" step="any" placeholder="Cantidad por unidad" required className="rounded-lg border border-background-300 px-3 py-2.5 text-sm" />
              <button type="submit" disabled={saving || !recipeInsumoId || !recipeQuantity} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"><i className="ri-add-line" />Agregar a receta</button>
            </form>

            {recipesLoading ? <p className="mt-5 text-sm text-foreground-600">Cargando receta…</p> : recipes.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-background-300 p-8 text-center text-sm text-foreground-600">{selectedMenuItem.name} todavía no tiene insumos asignados.</p> : <div className="mt-5 grid gap-3">{recipes.map((recipe) => { const insumo = insumos.find((item) => item.id === recipe.insumo_id); return <article key={recipe.id} className="flex flex-col gap-3 rounded-xl border border-background-200 bg-background-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-foreground-950">{insumo?.nombre ?? 'Insumo no encontrado'}</p><p className="text-xs text-foreground-600">{insumo?.unidad ?? 'unidad'} por platillo</p></div><div className="flex items-center gap-2"><input type="number" min="0.0001" step="any" defaultValue={numberValue(recipe.cantidad_requerida)} disabled={busyId === recipe.id} onBlur={(event) => { if (event.target.value !== String(recipe.cantidad_requerida)) void updateRecipe(recipe, event.target.value); }} className="w-32 rounded-lg border border-background-300 px-3 py-2 text-sm" /><button type="button" disabled={busyId === recipe.id} onClick={() => void deleteRecipe(recipe)} aria-label={`Quitar ${insumo?.nombre ?? 'insumo'} de la receta`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><i className="ri-delete-bin-line" /></button></div></article>; })}</div>}
          </>}
        </section>
      </div>
    </main>
  );
}
