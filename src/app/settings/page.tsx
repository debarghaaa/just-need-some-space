import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { SettingsView } from '@/components/game/SettingsView';
import { isBackendConfigured } from '@/lib/env';
import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!isBackendConfigured()) return <BackendMissing />;
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/settings');
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/profile', label: 'Profile' }, { label: 'Settings' }]} />
          <h1>SETTINGS.</h1>
        </div>
      </div>
      <SettingsView email={viewer.email ?? ''} isGuest={viewer.isGuest} displayName={viewer.profile?.display_name ?? ''} planetName={viewer.profile?.planet_name ?? ''} onboarded={Boolean(viewer.profile?.onboarded_at)} />
    </div>
  );
}
