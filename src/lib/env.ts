/**
 * Environment access with an honest "not configured" state.
 * The app never pretends to be connected: if the public Supabase variables are missing, pages
 * that need a backend render a clear notice instead of failing half-way through.
 */
export interface PublicBackendConfig {
  url: string;
  anonKey: string;
}

export function getPublicBackendConfig(): PublicBackendConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || url.includes('YOUR-PROJECT-REF') || anonKey.startsWith('YOUR-')) return null;
  return { url, anonKey };
}

export function isBackendConfigured(): boolean {
  return getPublicBackendConfig() !== null;
}

/** 'local' when running against scripts/local-supabase, otherwise 'supabase'. Display only. */
export function backendMode(): 'local' | 'supabase' | 'none' {
  if (!isBackendConfigured()) return 'none';
  return process.env.NEXT_PUBLIC_BACKEND_MODE === 'local' ? 'local' : 'supabase';
}

export function universeSeed(): string {
  return process.env.UNIVERSE_SEED?.trim() || 'just-need-some-space';
}
