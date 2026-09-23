import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey =
  (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const customLock = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), acquireTimeout > 0 ? acquireTimeout : 10000);
    return navigator.locks
      .request(
        name,
        { mode: 'exclusive', signal: abortController.signal },
        async () => await fn(),
      )
      .finally(() => clearTimeout(timeout));
  }
  return fn();
};

/** Placeholder URL/key avoid createClient throwing when Railway env vars are missing. */
const clientUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const clientKey = isSupabaseConfigured ? supabaseAnonKey : 'public-anon-key-not-configured';

export const supabase: SupabaseClient = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: false,
    flowType: 'pkce',
    lock: customLock,
  },
});
