import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Supabase client — for Realtime subscriptions only.
 * persistSession: false — we use custom JWT, not Supabase Auth.
 * No automatic token storage.
 */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Set custom JWT on the realtime channel so RLS policies are enforced.
 * Call this after successful auth.
 */
export function setRealtimeAuth(token: string): void {
  if (supabase) {
    // @ts-expect-error — setAuth exists on realtime but not typed
    supabase.realtime.setAuth(token);
  }
}
