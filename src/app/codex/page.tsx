import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { CodexView, type CodexEntry } from '@/components/game/CodexView';
import { isBackendConfigured, universeSeed } from '@/lib/env';
import { getServerSupabase } from '@/lib/supabase/server';
import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Codex' };
export const dynamic = 'force-dynamic';

export default async function CodexPage() {
  if (!isBackendConfigured()) return <BackendMissing />;
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/codex');
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  const supabase = await getServerSupabase();
  const { data } = await supabase!.from('codex_entries').select('*').order('discovered_at', { ascending: false }).limit(500);
  const entries = (data ?? []) as CodexEntry[];
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/universe', label: 'Universe' }, { label: 'Codex' }]} />
          <h1>THE CODEX.</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Everything anyone has found, in the order it was found.</p>
      </div>
      <CodexView entries={entries} me={viewer.profile.username} seed={universeSeed()} />
    </div>
  );
}
