import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    lock: customLock,
  },
});