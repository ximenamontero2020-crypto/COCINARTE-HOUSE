import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ShareSuggestion from './ShareSuggestion';

const BUCKET = 'community';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function SuggestFood() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; nombre: string } | null>(null);

  const selectFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.');
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setError('La imagen no debe superar los 5 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
  };

  const submit = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      setError('Escribe el nombre y una descripción corta.');
      return;
    }

    setSaving(true);
    setError(null);
    setCreated(null);
    let imagePath: string | null = null;

    try {
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        imagePath = `${user.id}/suggestions/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(imagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const imageUrl = imagePath
        ? supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl
        : null;
      const { data: inserted, error: insertError } = await supabase
        .from('food_suggestions')
        .insert({
          user_id: user.id,
          nombre: trimmedName.slice(0, 100),
          descripcion: trimmedDescription.slice(0, 300),
          imagen_url: imageUrl,
          status: 'pendiente',
        })
        .select('id, nombre')
        .single();
      if (insertError) {
        if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);
        throw insertError;
      }

      setName('');
      setDescription('');
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setCreated(inserted as { id: number; nombre: string });
    } catch (submitError) {
      console.error('Error creando propuesta de alimento:', submitError);
      setError('No pudimos enviar tu propuesta. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-background-200/70 bg-background-100 p-6 text-center">
        <p className="text-sm text-foreground-600">Inicia sesión para proponer un alimento.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-background-200/70 bg-background-100 p-6 md:p-8">
      <div className="mb-5">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Tu idea puede llegar al menú</span>
        <h3 className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Propón un alimento</h3>
        <p className="mt-2 text-sm text-foreground-600">El staff revisará tu propuesta antes de ponerla a prueba.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <div className="space-y-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            placeholder="Nombre del alimento"
            className="w-full rounded-md border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Descríbelo brevemente: sabor, ingredientes o por qué debería estar en el menú…"
            className="w-full resize-none rounded-md border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-background-300 bg-background-50 text-center hover:border-primary-400"
        >
          {preview ? <img src={preview} alt="Vista previa" className="absolute inset-0 h-full w-full object-cover" /> : <><i className="ri-image-add-line text-3xl text-primary-600" /><span className="mt-2 px-3 text-xs font-medium text-foreground-600">Añadir imagen</span></>}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
      </div>

      {error && <p className="mt-3 text-sm text-accent-700">{error}</p>}
      {created && (
        <>
          <p className="mt-3 text-sm font-semibold text-primary-700">Propuesta enviada. Ya aparece en las propuestas; ¡consigue votos!</p>
          <ShareSuggestion id={created.id} nombre={created.nombre} />
        </>
      )}
      <button type="button" disabled={saving} onClick={() => void submit()} className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50">
        <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-2-fill'} />
        {saving ? 'Enviando…' : 'Enviar propuesta'}
      </button>
    </div>
  );
}
