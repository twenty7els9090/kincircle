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
        realtime: {
          // Use custom JWT per-channel instead of global setAuth
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;
