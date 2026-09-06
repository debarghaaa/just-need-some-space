import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomizeView } from '@/components/game/CustomizeView';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { COPY } from '@/game/copy';
import { isBackendConfigured, universeSeed } from '@/lib/env';
import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Customize' };
export const dynamic = 'force-dynamic';

export default async function CustomizePage() {
  if (!isBackendConfigured()) return <BackendMissing />;
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/customize');
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/universe', label: 'Universe' }, { label: 'Customize' }]} />
          <h1>{COPY.customize.title}</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{viewer.rocket ? `Last saved ${new Date(viewer.rocket.updated_at).toLocaleString()}` : 'Not saved yet'}</p>
      </div>
      <CustomizeView rocket={viewer.rocketConfig} rocketName={viewer.rocket?.name ?? 'The Sensible One'} suit={viewer.suit} displayName={viewer.profile.display_name} username={viewer.profile.username} seed={universeSeed()} isGuest={viewer.isGuest} />
    </div>
  );
}
