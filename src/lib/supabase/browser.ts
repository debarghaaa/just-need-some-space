'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getPublicBackendConfig } from '@/lib/env';
import { AUTH_COOKIE_OPTIONS } from './cookies';

let client: ReturnType<typeof createBrowserClient> | null = null;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * LOCAL STACK ONLY: when the page is served through a tunnel (preview sandbox) the browser cannot
 * reach the stack's loopback address, so it uses the same-origin /local-backend proxy declared in
 * next.config.ts instead. Production builds never take this branch (no local mode, no rewrite).
 */
function browserUrl(url: string): string {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_BACKEND_MODE !== 'local') return url;
  try {
    if (LOOPBACK.has(new URL(url).hostname) && !LOOPBACK.has(window.location.hostname)) return `${window.location.origin}/local-backend`;
  } catch {
    // fall through: use the configured URL as-is
  }
  return url;
}

/** Browser client (anon key + user session cookie). Returns null when the backend is not configured. */
export function getBrowserSupabase() {
  if (client) return client;
  const cfg = getPublicBackendConfig();
  if (!cfg) return null;
  client = createBrowserClient(browserUrl(cfg.url), cfg.anonKey, { cookieOptions: AUTH_COOKIE_OPTIONS });
  return client;
}
