import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type Profile = {
  name: string | null;
  phone: string | null;
  email: string | null;
  membership_level: string | null;
  membership_current_spend: number | string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(async (currentUser: User) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('name, phone, email, membership_level, membership_current_spend')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: currentUser.id,
        name: currentUser.user_metadata?.name ?? currentUser.user_metadata?.full_name ?? null,
        phone: currentUser.phone ?? null,
        email: currentUser.email ?? null,
      });
      return;
    }

    if (!existingProfile.email && currentUser.email) {
      await supabase.from('profiles').update({ email: currentUser.email }).eq('id', currentUser.id);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    if (!current?.user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('name, phone, email, membership_level, membership_current_spend')
      .eq('id', current.user.id)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) {
          console.warn('Supabase getSession error:', error.message);
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        setSession(data.session);
        setLoading(false);
        if (data.session?.user) {
          await ensureProfile(data.session.user);
          supabase
            .from('profiles')
            .select('name, phone, email, membership_level, membership_current_spend')
            .eq('id', data.session.user.id)
            .maybeSingle()
            .then(({ data: profileData }) => {
              if (active) setProfile(profileData ?? null);
            });
        }
      } catch (e: any) {
        if (!active) return;
        console.warn('Auth initialization error:', e);
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        supabase
          .from('profiles')
          .select('name, phone, email, membership_level, membership_current_spend')
          .eq('id', newSession.user.id)
          .maybeSingle()
          .then(({ data: profileData }) => {
            if (active) setProfile(profileData ?? null);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [ensureProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}