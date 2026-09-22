import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import MembershipCard from './components/MembershipCard';

export default function AccountPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? profile?.email ?? '');
  const [password, setPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setEmail(user?.email ?? profile?.email ?? '');
  }, [profile, user]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setMessage(null);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, name: name.trim() || null, phone: phone.trim() || null, email: normalizedEmail || null });

    if (profileError) {
      setError('No se pudieron guardar tus datos. Inténtalo de nuevo.');
      setSavingProfile(false);
      return;
    }

    if (normalizedEmail && normalizedEmail !== user.email?.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: normalizedEmail });
      if (emailError) {
        setError(`Tus datos se guardaron, pero no se pudo cambiar el correo: ${emailError.message}`);
        setSavingProfile(false);
        return;
      }
      setMessage('Datos guardados. Revisa tu nuevo correo para confirmar el cambio.');
    } else {
      setMessage('Datos guardados correctamente.');
    }

    await refreshProfile();
    setSavingProfile(false);
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSavingPassword(true);
    setMessage(null);
    setError(null);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (passwordError) {
      setError(`No se pudo cambiar la contraseña: ${passwordError.message}`);
      return;
    }
    setPassword('');
    setMessage('Contraseña actualizada correctamente.');
  };

  const initial = (name.trim() || user?.email?.charAt(0) || '?').charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-background-100 px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800">
          <i className="ri-arrow-left-line" />
          Volver al inicio
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-background-200 bg-background-50 shadow-sm">
          <div className="bg-primary-700 px-6 py-8 text-background-50 md:px-10">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-500 text-2xl font-extrabold text-foreground-950">
                {initial}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-background-50/75">Mi cuenta</p>
                <h1 className="mt-1 font-heading text-3xl font-extrabold">Tu perfil</h1>
                <p className="mt-1 text-sm text-background-50/80">Administra tus datos y preferencias de acceso.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 md:p-10">
            <form onSubmit={saveProfile} className="grid gap-4">
              <div>
                <h2 className="font-heading text-xl font-extrabold text-foreground-950">Datos personales</h2>
                <p className="mt-1 text-sm text-foreground-600">Estos datos se guardan en tu perfil de CocinArte House.</p>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground-800">
                Nombre
                <input value={name} onChange={(event) => setName(event.target.value)} required className="h-11 rounded-xl border border-background-300 bg-background-50 px-4 font-normal outline-none focus:border-primary-500" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground-800">
                Teléfono
                <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" className="h-11 rounded-xl border border-background-300 bg-background-50 px-4 font-normal outline-none focus:border-primary-500" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground-800">
                Correo electrónico
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="h-11 rounded-xl border border-background-300 bg-background-50 px-4 font-normal outline-none focus:border-primary-500" />
                <span className="text-xs font-normal text-foreground-500">Cambiar el correo puede requerir confirmación en tu bandeja de entrada.</span>
              </label>
              <button type="submit" disabled={savingProfile} className="mt-2 w-fit rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
                {savingProfile ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>

            <form onSubmit={savePassword} className="grid gap-4 border-t border-background-200 pt-8">
              <div>
                <h2 className="font-heading text-xl font-extrabold text-foreground-950">Seguridad</h2>
                <p className="mt-1 text-sm text-foreground-600">Actualiza tu contraseña cuando lo necesites.</p>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground-800">
                Nueva contraseña
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} placeholder="Mínimo 6 caracteres" className="h-11 rounded-xl border border-background-300 bg-background-50 px-4 font-normal outline-none focus:border-primary-500" />
              </label>
              <button type="submit" disabled={savingPassword || !password} className="w-fit rounded-xl border border-primary-600 px-5 py-3 text-sm font-bold text-primary-700 hover:bg-primary-50 disabled:opacity-50">
                {savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}
              </button>
            </form>

            <MembershipCard />

            {(message || error) && <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error ?? message}</p>}

            <button type="button" onClick={() => void signOut()} className="w-fit text-sm font-semibold text-foreground-600 hover:text-red-700">
              Cerrar sesión
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
