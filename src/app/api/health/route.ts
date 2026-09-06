import { NextResponse } from 'next/server';
import { backendMode, getPublicBackendConfig } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health  (route contract, spec 46.24)
 * Who: anyone (uptime checks, the recovery script). Input: none. Auth: none.
 * Reads: one unauthenticated request to the auth service's health endpoint, with a short timeout,
 * so `ok` means "a player can actually sign in", not merely "Next.js is up".
 * Discloses only: overall ok, which kind of backend is configured ('local' | 'supabase' | 'none')
 * and whether it answered. Never URLs, keys, versions or error text.
 * Frequency: cheap; cached for nothing (no-store). Fails closed to ok:false on any error.
 */
export async function GET() {
  const mode = backendMode();
  const cfg = getPublicBackendConfig();
  let backendUp = false;
  if (cfg) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${cfg.url.replace(/\/$/, '')}/auth/v1/health`, {
        headers: { apikey: cfg.anonKey },
        cache: 'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      backendUp = res.ok;
    } catch {
      backendUp = false;
    }
  }
  const ok = mode !== 'none' && backendUp;
  return NextResponse.json(
    { ok, backend: mode, backendUp },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
