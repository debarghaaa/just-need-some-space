'use client';
import { useMemo, useState } from 'react';
import { Empty, EntityKind, Tag } from '@/components/ui';
import { COPY } from '@/game/copy';
import { parseId, RARITY_LABEL, resolvePlanet, type Rarity } from '@/game/universe';
import { PlanetSprite } from './Sprites';
import { drawResource, drawSite } from '@/game/pixel';
import { useEffect, useRef } from 'react';

export interface CodexEntry {
  id: string;
  player_id: string;
  discovered_by: string;
  discovery_type: 'system' | 'planet' | 'site' | 'resource';
  entity_id: string;
  planet_id: string | null;
  system_id: string | null;
  name: string;
  rarity: string;
  attributes: Record<string, unknown>;
  first_find: boolean;
  discovered_at: string;
}

type Tab = 'all' | 'mine' | 'planets' | 'resources' | 'systems' | 'sites';

export function CodexView({ entries, me, seed }: { entries: CodexEntry[]; me: string; seed: string }) {
  const [tab, setTab] = useState<Tab>('all');
  const shown = useMemo(() => {
    switch (tab) {
      case 'mine': return entries.filter((e) => e.discovered_by === me);
      case 'planets': return entries.filter((e) => e.discovery_type === 'planet');
      case 'resources': return entries.filter((e) => e.discovery_type === 'resource');
      case 'systems': return entries.filter((e) => e.discovery_type === 'system');
      case 'sites': return entries.filter((e) => e.discovery_type === 'site');
      default: return entries;
    }
  }, [entries, tab, me]);
  const tabs: Array<[Tab, string]> = [['all', 'All'], ['mine', 'Mine'], ['planets', 'Planets'], ['systems', 'Systems'], ['sites', 'Sites'], ['resources', 'Resources']];
  return (
    <div>
      <div className="codex-tabs" role="tablist" aria-label="Codex filter">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="opt" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label} <span className="muted">{id === 'all' ? entries.length : id === 'mine' ? entries.filter((e) => e.discovered_by === me).length : entries.filter((e) => e.discovery_type === id.slice(0, -1)).length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty head={tab === 'mine' ? COPY.emptyDiscoveries.head : COPY.emptyCodex.head} sub={tab === 'mine' ? COPY.emptyDiscoveries.sub : COPY.emptyCodex.sub} />
      ) : (
        <div className="grid-3">
          {shown.map((e) => (
            <CodexCard key={e.id} e={e} seed={seed} mine={e.discovered_by === me} />
          ))}
        </div>
      )}
    </div>
  );
}

function CodexCard({ e, seed, mine }: { e: CodexEntry; seed: string; mine: boolean }) {
  const planet = e.discovery_type === 'planet' ? resolvePlanet(seed, e.entity_id)?.planet : null;
  const rarity = (['common', 'uncommon', 'rare', 'exotic'].includes(e.rarity) ? e.rarity : 'common') as Rarity;
  const a = e.attributes ?? {};
  const parsed = parseId(e.entity_id);
  return (
    <article className="codex-card">
      <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', background: 'var(--color-bg-primary)', border: '2px solid var(--color-border-subtle)' }}>
        {planet ? <PlanetSprite planet={planet} chunk={2} radius={12} /> : e.discovery_type === 'resource' ? <IconCanvas kind="resource" v={rarity === 'exotic' ? 'exotic' : rarity === 'rare' ? 'rare' : 'common'} /> : e.discovery_type === 'site' ? <IconCanvas kind="site" v={String(a.kind ?? 'formation')} /> : <span className="display-xs amber">SYS</span>}
      </div>
      <div>
        <div className="name">{e.name}</div>
        <div className="row" style={{ gap: '0.35rem' }}>
          <Tag kind={rarity}>{RARITY_LABEL[rarity]}</Tag>
          <Tag>{e.discovery_type}</Tag>
          {e.first_find ? <Tag kind="first">First find</Tag> : null}
          {mine ? <Tag kind="ok">Yours</Tag> : null}
        </div>
        <dl>
          <dt>Found by</dt><dd>{e.discovered_by}</dd>
          <dt>Date</dt><dd>{new Date(e.discovered_at).toLocaleDateString()}</dd>
          {e.discovery_type === 'planet' && a.biome ? (<><dt>Biome</dt><dd>{String(a.biome)}</dd><dt>Gravity</dt><dd>{Number(a.gravity).toFixed(2)} g</dd><dt>Temp</dt><dd>{String(a.temperature)} C</dd></>) : null}
          {e.discovery_type === 'system' && a.starClass ? (<><dt>Star</dt><dd>{String(a.starClass)}</dd><dt>Planets</dt><dd>{String(a.planetCount)}</dd></>) : null}
          {e.discovery_type === 'site' && a.kind ? (<><dt>Kind</dt><dd>{String(a.kind)}</dd></>) : null}
          {e.discovery_type === 'resource' && a.firstSeenOn ? (<><dt>Seen on</dt><dd>{String(a.firstSeenOn)}</dd></>) : null}
          {parsed && parsed.type !== 'system' ? (<><dt>System</dt><dd>system {parsed.sys + 1}</dd></>) : null}
        </dl>
        <div style={{ marginTop: '0.5rem' }}><EntityKind kind="proc" /></div>
      </div>
    </article>
  );
}

function IconCanvas({ kind, v }: { kind: 'resource' | 'site'; v: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    const src = kind === 'resource' ? drawResource(v as 'common' | 'rare' | 'exotic', 3) : drawSite(v as 'formation', 3);
    t.width = src.width; t.height = src.height;
    const ctx = t.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [kind, v]);
  return <canvas ref={ref} aria-hidden="true" />;
}
