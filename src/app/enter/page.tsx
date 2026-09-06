import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuestEntry } from '@/components/site/GuestEntry';
import { BackendMissing } from '@/components/site/BackendMissing';
import { isBackendConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Entering' };
export const dynamic = 'force-dynamic';

/**
 * No login required. This page issues a guest session (Supabase anonymous sign-in) and continues
 * to the page the visitor asked for. Signed-in visitors are passed straight through.
 */
export default function EnterPage() {
  if (!isBackendConfigured()) return <BackendMissing />;
  return (
    <Suspense fallback={null}>
      <GuestEntry />
    </Suspense>
  );
}
