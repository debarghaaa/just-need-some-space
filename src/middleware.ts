import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static assets, the uptime probe and the local-stack proxy (dev only).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|fonts/|api/health|local-backend/).*)'],
};
