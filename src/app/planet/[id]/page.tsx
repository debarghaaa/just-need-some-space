import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PlanetExplorer } from '@/components/game/PlanetExplorer';
import { Crumbs } from '@/components/ui';
import { BackendMissing } from '@/components/site/BackendMissing';
import { idToSlug, resolvePlanet, slugToId } from '@/game/universe';
import { isBackendConfigured, universeSeed } from '@/lib/env';
import { getViewer } from '@/server/profile';
import { planetProgress, requireActor } from '@/server/game';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = resolvePlanet(universeSeed(), slugToId('planet', id));
  return { title: r ? r.planet.name : 'Planet' };
}

export default async function PlanetPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isBackendConfigured()) return <BackendMissing />;
  const { id } = await params;
  const r = resolvePlanet(universeSeed(), slugToId('planet', id));
  if (!r) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/enter?next=/planet/${id}`);
  if (!viewer.profile?.onboarded_at) redirect('/onboarding');
  const actor = await requireActor();
  const progress = await planetProgress(actor, r.planet.id);
  // Landing is what discovers a planet. If someone deep-links here, go through the system map first.
  if (!progress.planetDiscovered) redirect(`/system/${idToSlug(r.system.id)}`);
  return (
    <div className="wrap">
      <div className="game-head">
        <div>
          <Crumbs items={[{ href: '/universe', label: 'Universe' }, { href: `/system/${idToSlug(r.system.id)}`, label: r.system.name }, { label: r.planet.name }]} />
          <h1>{r.planet.name}</h1>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{r.planet.biome}. {r.planet.gravity.toFixed(2)} g. {r.planet.temperature} C. Atmosphere: {r.planet.atmosphere}.</p>
      </div>
      <PlanetExplorer seed={universeSeed()} systemIndex={r.system.index} planetIndex={r.planet.index} systemSlug={idToSlug(r.system.id)} initialScanned={progress.scannedSites} initialCollected={progress.collectedNodes} username={viewer.profile.username} displayName={viewer.profile.display_name} suit={viewer.suit} />
    </div>
  );
}
