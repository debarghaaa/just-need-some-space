'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button, EntityKind, Panel, Tag } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { COPY } from '@/game/copy';
import type { RocketConfig } from '@/game/rockets';
import { idToSlug } from '@/game/universe';
import { usePresence } from './usePresence';
import { useSfx } from './useSfx';
import { RocketSprite } from './Sprites';
import { MAP, PALETTE } from '@/game/palette';
import { scatterDeepSky, scatterDust } from '@/game/deep-sky';

export interface SystemSummary {
  id: string;
  name: string;
  starClass: string;
  starColor: string;
  starRadius: number;
  mapX: number;
  mapY: number;
  planetCount: number;
  discoveredPlanets: number;
  visited: boolean;
}

const W = 640;
const H = 400;

export function UniverseMap({ systems, rocket, username, seed }: { systems: SystemSummary[]; rocket: RocketConfig; username: string; seed: string }) {
  const router = useRouter();
  const toast = useToast();
  const sfx = useSfx();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = systems.find((s) => s.id === selected) ?? null;

  // In the galaxy view nobody has a position; presence just says "in the galaxy map".
  const getPos = useCallback(() => ({ x: 0, y: 0, facing: 1 }), []);
  const presence = usePresence({ systemId: null, planetId: null }, getPos);
  const perSystem = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of presence.others) if (o.system_id) m.set(o.system_id, (m.get(o.system_id) ?? 0) + 1);
    return m;
  }, [presence.others]);

  async function travel(id: string) {
    setBusy(true);
    sfx('blip');
    let res: Response;
    try {
      res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'visit_system', systemId: id }) });
    } catch {
      setBusy(false);
      sfx('error');
      toast({ head: COPY.signalLost.head, sub: COPY.signalLost.sub, tone: 'err' });
      return;
    }
    if (!res.ok) {
      setBusy(false);
      sfx('error');
      toast({ head: COPY.saveFailed.head, sub: COPY.saveFailed.sub, tone: 'err' });
      return;
    }
    const data = (await res.json()) as { points_awarded: number; first_visit: boolean };
    if (data.points_awarded > 0) {
      sfx('found');
      toast({ head: `NEW SYSTEM. +${data.points_awarded}`, sub: data.first_visit ? 'You are the first person here. Try not to touch anything.' : 'Others have been here before you. They left it tidy.', tone: 'ok' });
    }
    router.push(`/system/${idToSlug(id)}`);
  }

  // Decorative stars from a fixed pattern (not random per render, so it never flickers)
  const stars = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ x: (i * 97 + 13) % W, y: (i * 53 + 7) % H, b: i % 7 === 0 ? 0.55 : 0.28 })), []);
  // Deep-sky scenery (galaxies, nebulae, clusters, flare stars): deterministic from the universe
  // seed, kept clear of every system node and its label so the interactive layer stays readable.
  const deepSky = useMemo(() => {
    const keepOut = systems.map((s) => ({ x: Math.round(60 + s.mapX * (W - 120)), y: Math.round(50 + s.mapY * (H - 100)) + 8, radius: Math.max(6, Math.round(s.starRadius / 2)) + 34 }));
    return scatterDeepSky(seed, W, H, keepOut);
  }, [systems, seed]);
  // coloured space dust (reference sheets): thin teal, gold and blue specks, clear of the system nodes
  const dust = useMemo(() => {
    const keepOut = systems.map((s) => ({ x: Math.round(60 + s.mapX * (W - 120)), y: Math.round(50 + s.mapY * (H - 100)) + 8, radius: Math.max(6, Math.round(s.starRadius / 2)) + 30 }));
    return scatterDust(seed, W, H, 90, keepOut);
  }, [systems, seed]);

  return (
    <div className="game-grid">
      <div>
        <div className="map-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Galaxy map: five star systems. Background galaxies and nebulae are scenery." shapeRendering="crispEdges">
            <rect width={W} height={H} fill={MAP.background} />
            {stars.map((s, i) => (
              <rect key={i} x={s.x} y={s.y} width={2} height={2} fill={MAP.star} opacity={s.b} />
            ))}
            <g className="space-dust" aria-hidden="true">
              {dust.map((d, i) => (
                <rect key={i} x={d.x} y={d.y} width={d.size === 2 ? 4 : 2} height={2} fill={d.c} opacity={d.alpha * 0.85} />
              ))}
            </g>
            <g className="deep-sky" aria-hidden="true">
              {deepSky.map((o, i) => (
                <g key={i} transform={`translate(${o.x} ${o.y})`} opacity={o.kind === 'flare' ? 0.9 : 0.8}>
                  {o.cells.map((c, j) => (
                    <rect key={j} x={c.x * o.px} y={c.y * o.px} width={o.px} height={o.px} fill={c.c} />
                  ))}
                </g>
              ))}
            </g>
            {systems.map((s) => {
              const x = Math.round(60 + s.mapX * (W - 120));
              const y = Math.round(50 + s.mapY * (H - 100));
              const r = Math.max(6, Math.round(s.starRadius / 2));
              const here = perSystem.get(s.id) ?? 0;
              const isSel = selected === s.id;
              return (
                <g
                  key={s.id}
                  className={`sysnode ${isSel ? 'is-selected' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSel}
                  aria-label={`${s.name}, ${s.starClass}, ${s.planetCount} planets${s.visited ? ', visited' : ', not visited'}${here ? `, ${here} player${here > 1 ? 's' : ''} present` : ''}`}
                  onClick={() => { setSelected(s.id); sfx('blip'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s.id); } }}
                >
                  <rect className="focus-ring" x={x - r - 10} y={y - r - 10} width={(r + 10) * 2} height={(r + 10) * 2} fill="transparent" stroke={isSel ? MAP.player : 'transparent'} strokeWidth={2} strokeDasharray="4 3" />
                  {/* pixel star: a plus of squares, dimmer when never visited */}
                  <rect x={x - r} y={y - Math.round(r / 2)} width={r * 2} height={r} fill={s.starColor} opacity={s.visited ? 1 : 0.55} />
                  <rect x={x - Math.round(r / 2)} y={y - r} width={r} height={r * 2} fill={s.starColor} opacity={s.visited ? 1 : 0.55} />
                  <rect x={x - Math.round(r / 3)} y={y - Math.round(r / 3)} width={Math.round(r / 1.5)} height={Math.round(r / 1.5)} fill={s.visited ? MAP.discovered : MAP.undiscovered} opacity={s.visited ? 0.95 : 0.7} />
                  {s.visited ? null : <rect x={x - 2} y={y - 2} width={4} height={4} fill={MAP.background} />}
                  <text x={x} y={y + r + 18} textAnchor="middle">{s.visited ? s.name : 'UNKNOWN'}</text>
                  <text x={x} y={y + r + 28} textAnchor="middle" style={{ fill: s.visited ? MAP.discovered : MAP.undiscovered, fontSize: 7 }}>
                    {s.visited ? `${s.discoveredPlanets}/${s.planetCount} FOUND` : `${s.planetCount} SIGNALS`}
                  </text>
                  {here > 0 ? (
                    <g aria-hidden="true">
                      <rect x={x + r + 4} y={y - r - 8} width={14} height={10} fill={MAP.otherPlayer} />
                      <text x={x + r + 11} y={y - r} textAnchor="middle" style={{ fill: MAP.background, fontSize: 8 }}>{here}</text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="legend">
          <span><i style={{ background: MAP.discovered }} />Visited star</span>
          <span><i style={{ background: MAP.undiscovered }} />Unvisited star</span>
          <span><i style={{ background: MAP.otherPlayer }} />Real players present</span>
          <span className="muted">
            Presence: {presence.status === 'live' ? <span className="green">live</span> : presence.status === 'offline' ? <span className="red">{COPY.signalLost.head}</span> : 'connecting'}
          </span>
        </div>
      </div>

      <aside className="stack">
        <Panel title="Your ship" tight>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
            <RocketSprite config={rocket} scale={3} />
            <div>
              <div className="display-xs">{username}</div>
              <div className="small dim">Docked at the galaxy map. Pick a star.</div>
              <a href="/customize" className="small">Customize</a>
            </div>
          </div>
        </Panel>

        <Panel title={sel ? 'Selected system' : 'Select a system'} tight>
          {sel ? (
            <div className="stack">
              <div>
                <div className="display-sm">{sel.visited ? sel.name : 'UNKNOWN SYSTEM'}</div>
                <div className="small dim">
                  {sel.starClass}. {sel.planetCount} planets. {sel.visited ? `${sel.discoveredPlanets} discovered by you.` : 'Nothing on record yet.'}
                </div>
              </div>
              <div className="row">
                <EntityKind kind="proc" />
                {sel.visited ? <Tag kind="ok">Visited</Tag> : <Tag>Unvisited</Tag>}
                {(perSystem.get(sel.id) ?? 0) > 0 ? <Tag kind="player">{perSystem.get(sel.id)} here</Tag> : null}
              </div>
              <Button variant="primary" block busy={busy} onClick={() => travel(sel.id)}>
                <PixelIcon name="rocket" size={12} /> {sel.visited ? 'Travel' : 'Travel (+150 first visit)'}
              </Button>
            </div>
          ) : (
            <p className="small dim" style={{ margin: 0 }}>Click or focus a star on the map. Unvisited systems show only how many planets are signalling.</p>
          )}
        </Panel>

        <Panel title="Also in the galaxy map" tight>
          {presence.others.filter((o) => !o.system_id).length === 0 ? (
            <p className="small dim" style={{ margin: 0 }}>{COPY.nobodyNearby.head} {COPY.nobodyNearby.sub}</p>
          ) : (
            presence.others.filter((o) => !o.system_id).map((o) => (
              <div className="player-row" key={o.player_id}>
                {o.rocket ? <RocketSprite config={o.rocket as RocketConfig} scale={1} /> : <span />}
                <div>
                  <div className="who">{o.username}</div>
                  <div className="where">Choosing a star</div>
                </div>
                <EntityKind kind="player" />
              </div>
            ))
          )}
        </Panel>
      </aside>
    </div>
  );
}
