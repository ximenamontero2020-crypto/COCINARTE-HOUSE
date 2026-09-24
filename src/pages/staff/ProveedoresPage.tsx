import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

type Proveedor = { id: number; nombre: string; contacto_email: string | null; telefono: string | null; notas: string | null };
type Insumo = { id: string; nombre: string; unidad: string };
type Link = { insumo_id: string; proveedor_id: number; sku_ref: string | null; lead_days: number | null; preferred: boolean };
type AlertPreview = { low_count: number; recipients_count: number; provider: 'resend' | 'smtp' | null; subject: string | null; html: string | null };
type AlertLog = { day: string; result: string | null; triggered_at: string };

const EMPTY_FORM = { nombre: '', contacto_email: '', telefono: '', notas: '' };
const input = 'w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm';
const smallButton = 'rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-800 hover:bg-background-200 disabled:opacity-50';

const PROVIDER_TEXT = { resend: 'Resend', smtp: 'SMTP (Gmail)' } as const;

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null); // null = alta nueva
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newLink, setNewLink] = useState({ insumo_id: '', sku_ref: '', lead_days: '', preferred: true });
  const [preview, setPreview] = useState<AlertPreview | null>(null);

  const notify = (tone: 'ok' | 'error', text: string, error?: unknown) => {
    if (error) console.error(text, error);
    setMessage({ tone, text });
  };

  const load = useCallback(async () => {
    const [prov, ins, lnk, log] = await Promise.all([
      supabase.from('proveedores').select('id, nombre, contacto_email, telefono, notas').order('nombre'),
      supabase.from('insumos').select('id, nombre, unidad').order('nombre'),
      supabase.from('insumo_proveedor').select('insumo_id, proveedor_id, sku_ref, lead_days, preferred'),
      supabase.from('stock_alert_log').select('day, result, triggered_at').order('day', { ascending: false }).limit(5),
    ]);
    const failed = prov.error ?? ins.error ?? lnk.error ?? log.error;
    if (failed) notify('error', 'No se pudieron cargar los proveedores.', failed);
    setProveedores((prov.data ?? []) as Proveedor[]);
    setInsumos((ins.data ?? []) as Insumo[]);
    setLinks((lnk.data ?? []) as Link[]);
    setLogs((log.data ?? []) as AlertLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (proveedor: Proveedor | null) => {
    setEditingId(proveedor?.id ?? null);
    setForm(
      proveedor
        ? { nombre: proveedor.nombre, contacto_email: proveedor.contacto_email ?? '', telefono: proveedor.telefono ?? '', notas: proveedor.notas ?? '' }
        : EMPTY_FORM,
    );
  };

  const saveProveedor = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.nombre.trim()) return notify('error', 'El nombre es obligatorio.');
    const row = {
      nombre: form.nombre.trim(),
      contacto_email: form.contacto_email.trim() || null,
      telefono: form.telefono.trim() || null,
      notas: form.notas.trim() || null,
    };
    setBusy(true);
    const { error } = editingId
      ? await supabase.from('proveedores').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('proveedores').insert(row);
    setBusy(false);
    if (error) return notify('error', 'No se pudo guardar el proveedor. Revisa el correo y los campos.', error);
    notify('ok', editingId ? 'Proveedor actualizado.' : 'Proveedor agregado.');
    startEdit(null);
    await load();
  };

  const selectedLinks = links.filter((link) => link.proveedor_id === selectedId);
  const insumoName = (id: string) => insumos.find((insumo) => String(insumo.id) === String(id))?.nombre ?? 'Insumo eliminado';
  const available = insumos.filter((insumo) => !selectedLinks.some((link) => String(link.insumo_id) === String(insumo.id)));

  const addLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !newLink.insumo_id) return;
    const lead = newLink.lead_days === '' ? null : Math.max(0, Math.round(Number(newLink.lead_days)));
    setBusy(true);
    const { error } = await supabase.from('insumo_proveedor').insert({
      insumo_id: newLink.insumo_id,
      proveedor_id: selectedId,
      sku_ref: newLink.sku_ref.trim() || null,
      lead_days: Number.isFinite(lead) ? lead : null,
      preferred: newLink.preferred,
    });
    setBusy(false);
    if (error) return notify('error', 'No se pudo asignar el insumo.', error);
    setNewLink({ insumo_id: '', sku_ref: '', lead_days: '', preferred: true });
    notify('ok', 'Insumo asignado.');
    await load();
  };

  const updateLink = async (link: Link, changes: Partial<Link>) => {
    setBusy(true);
    const { error } = await supabase.from('insumo_proveedor').update(changes).eq('insumo_id', link.insumo_id).eq('proveedor_id', link.proveedor_id);
    setBusy(false);
    if (error) return notify('error', 'No se pudo actualizar la asignación.', error);
    await load();
  };

  const removeLink = async (link: Link) => {
    if (!window.confirm(`¿Quitar ${insumoName(link.insumo_id)} de este proveedor?`)) return;
    setBusy(true);
    const { error } = await supabase.from('insumo_proveedor').delete().eq('insumo_id', link.insumo_id).eq('proveedor_id', link.proveedor_id);
    setBusy(false);
    if (error) return notify('error', 'No se pudo quitar la asignación.', error);
    await load();
  };

  // Dry-run: la función nunca envía cuando la llama staff; solo devuelve el HTML y la configuración.
  const testAlert = async () => {
    setBusy(true);
    setPreview(null);
    const { data, error } = await supabase.functions.invoke('send-low-stock-email', { body: { dry_run: true } });
    setBusy(false);
    if (error) return notify('error', 'No se pudo generar la vista previa de la alerta.', error);
    setPreview(data as AlertPreview);
  };

  const selected = proveedores.find((proveedor) => proveedor.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Panel de staff</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Proveedores</h1>
        <p className="mt-2 text-sm text-foreground-600">
          Registra proveedores, asígnalos a insumos y marca el preferido: aparece en la alerta diaria de stock bajo.
        </p>

        {message && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.tone === 'ok' ? 'bg-primary-100 text-primary-800' : 'bg-accent-100 text-accent-800'}`}>
            {message.text}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="prov-list-title">
            <h2 id="prov-list-title" className="font-heading text-lg font-bold text-foreground-950">Lista</h2>
            {loading ? (
              <p className="mt-4 text-sm text-foreground-600">Cargando…</p>
            ) : proveedores.length === 0 ? (
              <p className="mt-4 text-sm text-foreground-600">Todavía no hay proveedores.</p>
            ) : (
              <ul className="mt-4 divide-y divide-background-200">
                {proveedores.map((proveedor) => {
                  const count = links.filter((link) => link.proveedor_id === proveedor.id).length;
                  return (
                    <li key={proveedor.id} className={`flex items-start justify-between gap-3 py-3 ${selectedId === proveedor.id ? 'bg-primary-50 -mx-2 px-2 rounded-lg' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground-950">{proveedor.nombre}</p>
                        <p className="text-xs text-foreground-600">
                          {[proveedor.telefono, proveedor.contacto_email].filter(Boolean).join(' · ') || 'Sin contacto'} · {count} {count === 1 ? 'insumo' : 'insumos'}
                        </p>
                        {proveedor.notas && <p className="mt-1 text-xs text-foreground-500">{proveedor.notas}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => startEdit(proveedor)} className={smallButton}>Editar</button>
                        <button type="button" onClick={() => setSelectedId(proveedor.id)} className={smallButton}>Insumos</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="prov-form-title">
            <h2 id="prov-form-title" className="font-heading text-lg font-bold text-foreground-950">
              {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
            </h2>
            <form onSubmit={(event) => void saveProveedor(event)} className="mt-4 grid gap-3">
              <input required maxLength={120} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={input} aria-label="Nombre" />
              <input type="email" placeholder="Correo de contacto (opcional)" value={form.contacto_email} onChange={(e) => setForm({ ...form, contacto_email: e.target.value })} className={input} aria-label="Correo de contacto" />
              <input type="tel" maxLength={30} placeholder="Teléfono (opcional)" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={input} aria-label="Teléfono" />
              <textarea maxLength={500} rows={2} placeholder="Notas: horario, condiciones, mínimo de compra…" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={input} aria-label="Notas" />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
                  {editingId ? 'Guardar cambios' : 'Agregar proveedor'}
                </button>
                {editingId && <button type="button" onClick={() => startEdit(null)} className={smallButton}>Cancelar</button>}
              </div>
            </form>
          </section>
        </div>

        {selected && (
          <section className="mt-6 rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="links-title">
            <h2 id="links-title" className="font-heading text-lg font-bold text-foreground-950">Insumos de {selected.nombre}</h2>
            {selectedLinks.length === 0 ? (
              <p className="mt-3 text-sm text-foreground-600">Aún no tiene insumos asignados.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-foreground-500">
                    <tr><th className="py-2 pr-3">Insumo</th><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Entrega (días)</th><th className="py-2 pr-3">Preferido</th><th className="py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-background-200">
                    {selectedLinks.map((link) => (
                      <tr key={link.insumo_id}>
                        <td className="py-2 pr-3 font-semibold text-foreground-950">{insumoName(link.insumo_id)}</td>
                        <td className="py-2 pr-3">{link.sku_ref ?? '—'}</td>
                        <td className="py-2 pr-3">{link.lead_days ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <input type="checkbox" checked={link.preferred} disabled={busy} onChange={(e) => void updateLink(link, { preferred: e.target.checked })} aria-label={`Preferido para ${insumoName(link.insumo_id)}`} className="accent-primary-600" />
                        </td>
                        <td className="py-2 text-right">
                          <button type="button" disabled={busy} onClick={() => void removeLink(link)} className={smallButton}>Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={(event) => void addLink(event)} className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-center">
              <select required value={newLink.insumo_id} onChange={(e) => setNewLink({ ...newLink, insumo_id: e.target.value })} className={input} aria-label="Insumo">
                <option value="">Elige un insumo…</option>
                {available.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.nombre} ({insumo.unidad})</option>)}
              </select>
              <input maxLength={60} placeholder="SKU (opcional)" value={newLink.sku_ref} onChange={(e) => setNewLink({ ...newLink, sku_ref: e.target.value })} className={input} aria-label="SKU" />
              <input type="number" min={0} max={365} placeholder="Días de entrega" value={newLink.lead_days} onChange={(e) => setNewLink({ ...newLink, lead_days: e.target.value })} className={input} aria-label="Días de entrega" />
              <label className="flex items-center gap-2 text-sm text-foreground-700 whitespace-nowrap">
                <input type="checkbox" checked={newLink.preferred} onChange={(e) => setNewLink({ ...newLink, preferred: e.target.checked })} className="accent-primary-600" />
                Preferido
              </label>
              <button type="submit" disabled={busy || !newLink.insumo_id} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">Asignar</button>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="alert-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="alert-title" className="font-heading text-lg font-bold text-foreground-950">Alerta de stock bajo</h2>
              <p className="mt-1 text-sm text-foreground-600">
                Se envía sola, máximo una vez al día, cuando un insumo queda en o debajo de su mínimo. “Probar alerta” solo genera la vista previa: no envía nada.
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => void testAlert()} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
              Probar alerta
            </button>
          </div>

          {preview && (
            <div className="mt-4">
              <ul className="grid gap-2 text-sm sm:grid-cols-3">
                <li className="rounded-lg bg-background-50 px-3 py-2">Insumos en stock bajo: <strong>{preview.low_count}</strong></li>
                <li className="rounded-lg bg-background-50 px-3 py-2">
                  Destinatarios: <strong>{preview.recipients_count}</strong>
                  {preview.recipients_count === 0 && <span className="block text-xs text-accent-700">Falta STOCK_ALERT_EMAILS en la función.</span>}
                </li>
                <li className="rounded-lg bg-background-50 px-3 py-2">
                  Envío: <strong>{preview.provider ? PROVIDER_TEXT[preview.provider] : 'Sin configurar'}</strong>
                  {!preview.provider && <span className="block text-xs text-accent-700">Solo se registrará el HTML en los logs.</span>}
                </li>
              </ul>
              {preview.html ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-foreground-800">Asunto: {preview.subject}</p>
                  {/* sandbox vacío: el HTML del correo no puede ejecutar scripts ni navegar. */}
                  <iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html} className="mt-2 h-96 w-full rounded-lg border border-background-300 bg-white" />
                </>
              ) : (
                <p className="mt-3 text-sm text-foreground-600">No hay insumos en stock bajo ahora mismo: hoy no se enviaría correo.</p>
              )}
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground-500">Últimos envíos</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground-700">
                {logs.map((log) => (
                  <li key={log.day}>
                    {new Date(`${log.day}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {log.result ?? 'en proceso'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
