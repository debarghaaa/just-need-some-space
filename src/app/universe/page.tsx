import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { UniverseMap } from '@/components/game/UniverseMap';
import { Crumbs, Notice } from '@/components/ui';
import { COPY } from '@/game/copy';
import { generateGalaxy } from '@/game/universe';
import { isBackendConfigured, universeSeed } from '@/lib/env';
import { getViewer } from '@/server/profile';
import { myDiscoveries } from '@/server/universe-data';
import { BackendMissing } from '@/components/site/BackendMissing';

export const metadata: Metadata = { title: 'Universe' };
export const dynamic = 'force-dynamic';

export default async function UniversePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  if (!isBackendConfigured()) return <BackendMissing />;
  const viewer = await getViewer();
  if (!viewer) redirect('/enter?next=/universe');
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  const { welcome } = await searchParams;
  const galaxy = generateGalaxy(universeSeed());
  const mine = await myDiscoveries(viewer.userId);
  const systems = galaxy.systems.map((s) => ({
    id: s.id,
    name: s.name,
    starClass: s.starClass,
    starColor: s.starColor,
    starRadius: s.starRadius,
    mapX: s.mapX,
    mapY: s.mapY,
    planetCount: s.planets.length,
    discoveredPlanets: s.planets.filter((p) => mine.planets.has(p.id)).length,
    visited: mine.systems.has(s.id),
  }));
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ label: 'Universe' }]} />
          <h1>ONE GALAXY. FIVE SYSTEMS. FOR NOW.</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Home base: <span className="amber">{viewer.profile.planet_name}</span>
        </p>
      </div>
      {welcome ? (
        <div style={{ marginBottom: '1rem' }}>
          <Notice head={COPY.launch.head} tone="blue">
            <p style={{ margin: 0 }}>{COPY.launch.sub} Pick a star to see what is orbiting it.</p>
          </Notice>
        </div>
      ) : null}
      <UniverseMap systems={systems} rocket={viewer.rocketConfig} username={viewer.profile.username} seed={universeSeed()} />
    </div>
  );
}
