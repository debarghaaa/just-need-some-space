import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RocketPage } from '@/components/game/RocketPage';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { isBackendConfigured } from '@/lib/env';
import { getViewer } from '@/server/profile';

export const metadata: Metadata = { title: 'Rocket' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!isBackendConfigured()) return <BackendMissing />;
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/rocket');
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/universe', label: 'Universe' }, { label: 'Rocket' }]} />
          <h1>YOUR ROCKET.</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{viewer.rocket ? `Last saved ${new Date(viewer.rocket.updated_at).toLocaleString()}` : 'Not saved yet'}</p>
      </div>
      <p className="small dim" style={{ marginTop: 0 }}>
        Parts and colours are here. Suit colours, per-region rocket colours and your player name live on <a href="/customize">Customize</a>.
      </p>
      <RocketPage initial={viewer.rocketConfig} initialName={viewer.rocket?.name ?? 'The Sensible One'} />
    </div>
  );
}
