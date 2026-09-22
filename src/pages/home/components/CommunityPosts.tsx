import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const BUCKET = 'community';
const MAX_SIZE = 5 * 1024 * 1024;

type Post = {
  id: number;
  image_path: string;
  caption: string | null;
  created_at: string;
  imageUrl: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommunityPosts() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, image_path, caption, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) {
        setPosts([]);
        return;
      }

      setPosts(
        rows.map((r) => ({
          id: r.id,
          image_path: r.image_path,
          caption: r.caption,
          created_at: r.created_at,
          imageUrl: supabase.storage.from(BUCKET).getPublicUrl(r.image_path).data.publicUrl,
        })),
      );
    } catch {
      setLoadError('No pudimos cargar la galería. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleSelectFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setUploadError('Solo se permiten imágenes.');
      return;
    }
    if (selected.size > MAX_SIZE) {
      setUploadError('La imagen no debe superar los 5 MB.');
      return;
    }
    setUploadError(null);
    setUploadSuccess(false);
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleSelectFile(dropped);
  };

  const handleUpload = async () => {
    if (!user) {
      setUploadError('Inicia sesión para publicar una foto.');
      return;
    }
    if (!file) {
      setUploadError('Elige una foto primero.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt)
        ? rawExt === 'jpeg'
          ? 'jpg'
          : rawExt
        : 'jpg';
      const fileName = `${user.id}/post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(fileName, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('community_posts').insert({
        user_id: user?.id ?? null,
        image_path: fileName,
        caption: caption.trim() || null,
        status: 'pending',
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([fileName]);
        throw insErr;
      }

      setUploadSuccess(true);
      setCaption('');
      setFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setUploadError('No pudimos subir tu foto. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-16">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 text-accent-800 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
          <i className="ri-camera-lens-fill"></i>
          Galería de la comunidad
        </span>
        <h3 className="font-heading font-extrabold text-2xl md:text-3xl text-foreground-950">
          Comparte tu experiencia
        </h3>
        <p className="mt-3 text-sm md:text-base text-foreground-600 max-w-2xl mx-auto">
          Sube una foto de tu comida favorita de Cocinarte House. Todas las fotos se revisan antes
          de publicarse para mantener un ambiente de respeto y convivencia.
        </p>
      </div>

      <div className="rounded-2xl bg-background-100 border border-background-200/70 p-6 md:p-8">
        {user ? (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-64 shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative w-full aspect-square rounded-xl border-2 border-dashed border-background-300 bg-background-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary-400 transition-colors overflow-hidden"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Vista previa de tu foto"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                ) : (
                  <>
                    <span className="w-12 h-12 flex items-center justify-center rounded-full bg-primary-100 text-primary-600 text-2xl">
                      <i className="ri-image-add-line"></i>
                    </span>
                    <span className="text-sm font-medium text-foreground-700 px-4 text-center">
                      Toca aquí para elegir una foto
                    </span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-foreground-600 hover:text-accent-700 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Quitar foto
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                Comentario (opcional)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Cuéntanos qué pediste, con quién fuiste, qué te gustó…"
                maxLength={500}
                rows={4}
                className="w-full rounded-md border border-background-300 bg-background-50 px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 resize-none"
              />

              {uploadError && (
                <p className="mt-3 text-sm text-accent-700 flex items-center gap-1.5">
                  <i className="ri-error-warning-line"></i>
                  {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="mt-3 text-sm text-primary-700 flex items-center gap-1.5">
                  <i className="ri-checkbox-circle-line"></i>
                  ¡Gracias! Tu foto se envió para revisión y aparecerá pronto.
                </p>
              )}

              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-500 text-background-50 px-6 py-3 text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {uploading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <i className="ri-upload-cloud-2-line"></i>
                      Publicar foto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-600 text-center">
            Inicia sesión para compartir tus fotos.
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
        </div>
      ) : loadError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-foreground-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-500 text-background-50 px-5 py-2.5 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Reintentar
          </button>
        </div>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-foreground-500">
          Aún no hay fotos publicadas. ¡Sé el primero en compartir!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {posts.map((post) => (
            <figure
              key={post.id}
              className="rounded-2xl bg-background-100 border border-background-200/70 overflow-hidden"
            >
              <div className="aspect-[4/3] w-full bg-background-200">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.caption ?? 'Foto de la comunidad'}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground-400">
                    <i className="ri-image-line text-3xl"></i>
                  </div>
                )}
              </div>
              {(post.caption || post.created_at) && (
                <figcaption className="p-4">
                  {post.caption && (
                    <p className="text-sm text-foreground-800 leading-relaxed">{post.caption}</p>
                  )}
                  {post.created_at && (
                    <p className="mt-2 text-xs text-foreground-500 flex items-center gap-1.5">
                      <i className="ri-time-line"></i>
                      {formatDate(post.created_at)}
                    </p>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}