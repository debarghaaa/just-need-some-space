import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicBackendConfig } from '@/lib/env';
import { AUTH_COOKIE_OPTIONS } from './cookies';

/**
 * Server client bound to the current request's cookies. Runs with the user's own session, so
 * every query is subject to row level security exactly as it would be from the browser.
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  const cfg = getPublicBackendConfig();
  if (!cfg) return null;
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the middleware instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS. Only ever constructed on the server, only used by the game
 * API after the caller's session has been verified, and never returned to the client.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const cfg = getPublicBackendConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cfg || !key || key.startsWith('YOUR-')) return null;
  return createClient(cfg.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Resolves the signed-in user for the current request, or null. */
export async function getSessionUser() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
