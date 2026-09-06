import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SystemMap } from '@/components/game/SystemMap';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { resolveSystem, slugToId } from '@/game/universe';
import { isBackendConfigured, universeSeed } from '@/lib/env';
import { getViewer } from '@/server/profile';
import { firstFinders, myDiscoveries } from '@/server/universe-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = resolveSystem(universeSeed(), slugToId('system', id));
  return { title: s ? `${s.name} system` : 'System' };
}

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isBackendConfigured()) return <BackendMissing />;
  const { id } = await params;
  const system = resolveSystem(universeSeed(), slugToId('system', id));
  if (!system) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/enter?next=/system/${id}`);
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  const [mine, finders] = await Promise.all([myDiscoveries(viewer.userId), firstFinders(system.planets.map((p) => p.id))]);
  const visited = mine.systems.has(system.id);
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/universe', label: 'Universe' }, { label: system.name }]} />
          <h1>{system.name}</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{system.starClass}. {system.planets.length} planets.</p>
      </div>
      <SystemMap
        systemId={system.id}
        systemIndex={system.index}
        seed={universeSeed()}
        visited={visited}
        discovered={system.planets.map((p) => p.id).filter((pid) => mine.planets.has(pid))}
        firstFound={Object.fromEntries([...finders.entries()].map(([k, v]) => [k, v]))}
        rocket={viewer.rocketConfig}
        username={viewer.profile.username}
        displayName={viewer.profile.display_name}
        userId={viewer.userId}
      />
    </div>
  );
}
