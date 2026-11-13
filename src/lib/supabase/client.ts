import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
let pkceClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}

/**
 * A second auth client for Google and Apple sign-in, which use the PKCE
 * flow. The email link keeps the main client's flow, so a link opened on
 * another device still works. Both clients use Supabase's default storage key
 * for the same project URL, so the session this client stores after the code
 * exchange is the one the main client reads on the next page. It never reads
 * the address bar itself: /auth/callback/ hands it the code.
 */
export function getPkceAuthClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  pkceClient ??= createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
    },
  });
  return pkceClient;
}
