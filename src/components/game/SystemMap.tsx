'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, EntityKind, Panel, Tag } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { COPY } from '@/game/copy';
import type { RocketConfig } from '@/game/rockets';
import { generateSystem, idToSlug, RARITY_LABEL } from '@/game/universe';
import { canvasFont, drawNameplate, drawPlanet, drawRocket, drawStar } from '@/game/pixel';
import { PlanetSprite, RocketSprite } from './Sprites';
import { usePresence } from './usePresence';
import { useSfx } from './useSfx';
import { PlayerCard } from './PlayerCard';
import { MAP, PALETTE } from '@/game/palette';
import { scatterDust } from '@/game/deep-sky';

const W = 640;
const H = 420;

export function SystemMap(props: { systemId: string; systemIndex: number; seed: string; visited: boolean; discovered: string[]; firstFound: Record<string, { username: string; at: string }>; rocket: RocketConfig; username: string; displayName?: string; userId: string }) {
  const { systemId, systemIndex, seed, firstFound, rocket, username } = props;
  const displayName = props.displayName || username;
  const router = useRouter();
  const toast = useToast();
  const sfx = useSfx();
  const system = useMemo(() => generateSystem(seed, systemIndex), [seed, systemIndex]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Keep discovery state in the browser so the UI changes immediately after the API succeeds.
  // The server-provided value is still the authoritative initial state on every full load.
  const [discoveredState, setDiscoveredState] = useState<Set<string>>(() => new Set(props.discovered));
  const [firstFoundState, setFirstFoundState] = useState(firstFound);
  const discoveredSet = discoveredState;
  const firstFoundMap = firstFoundState;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // My rocket sits on the orbit of the selected planet (or parked near the star).
  const posRef = useRef({ x: 0, y: 0, facing: 1 });
  const getPos = useCallback(() => posRef.current, []);
  const presence = usePresence({ systemId, planetId: null }, getPos);
  const inOrbit = presence.others.filter((o) => !o.planet_id);
  const onPlanets = presence.others.filter((o) => o.planet_id);

  // Layout: orbits scaled to fit
  const layout = useMemo(() => {
    const maxOrbit = Math.max(...system.planets.map((p) => p.orbitRadius));
    const scale = (Math.min(W, H) / 2 - 36) / maxOrbit;
    return system.planets.map((p) => ({ p, r: p.orbitRadius * scale, angle: p.orbitPhase, x: undefined as number | undefined, y: undefined as number | undefined }));
  }, [system]);

  useEffect(() => {
    const sel = layout.find((l) => l.p.id === selected);
    if (sel) posRef.current = { x: Math.cos(sel.angle) * sel.r + 26, y: Math.sin(sel.angle) * sel.r - 20, facing: 1 };
    else posRef.current = { x: 70, y: -40, facing: 1 };
  }, [selected, layout]);

  // Draw the system: star, orbits, planets, my rocket, other players' rockets.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cx = W / 2;
    const cy = H / 2;
    let raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const star = drawStar(system.starColor, Math.max(14, Math.min(26, system.starRadius)), 2);
    // planets drawn large and bold, as on the reference sheets (radius 16 to 32 px, rings and moons included)
    const sprites = new Map(system.planets.map((p) => [p.id, drawPlanet(p, 2, p.radius)]));
    const dust = scatterDust(`${system.id}:map`, W, H, 110, [{ x: cx, y: cy, radius: 34 }]);
    const mine = drawRocket(rocket, 1);
    const otherSprites = new Map<string, HTMLCanvasElement>();
    const start = performance.now();

    const frame = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      ctx.fillStyle = MAP.background;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = MAP.star;
      for (let i = 0; i < 70; i++) ctx.globalAlpha = i % 6 === 0 ? 0.5 : 0.22, ctx.fillRect((i * 89 + 31) % W, (i * 47 + 11) % H, 2, 2);
      // coloured space dust between the orbits (reference sheets): teal, gold, blue specks
      for (const d of dust) {
        ctx.globalAlpha = d.alpha * 0.85;
        ctx.fillStyle = d.c;
        ctx.fillRect(d.x, d.y, 2, 2);
        if (d.size === 2) ctx.fillRect(d.x + 2, d.y, 2, 2);
      }
      ctx.globalAlpha = 1;
      // orbits
      ctx.strokeStyle = 'rgba(169,222,249,0.25)'; // --color-primary-soft (Icy Blue) at 25%: orbit line
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (const l of layout) {
        ctx.beginPath();
        ctx.arc(cx, cy, l.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.drawImage(star, Math.round(cx - star.width / 2), Math.round(cy - star.height / 2));
      // planets
      for (const l of layout) {
        const a = l.angle + t * (0.05 / Math.sqrt(l.r / 60));
        const x = cx + Math.cos(a) * l.r;
        const y = cy + Math.sin(a) * l.r;
        const spr = sprites.get(l.p.id)!;
        const known = discoveredSet.has(l.p.id);
        ctx.globalAlpha = known ? 1 : 0.5;
        ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2));
        ctx.globalAlpha = 1;
        if (!known) {
          ctx.fillStyle = MAP.background;
          for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(x - 1 + i * 4), Math.round(y - 1), 2, 2);
        }
        if (selected === l.p.id) {
          ctx.strokeStyle = MAP.player;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(Math.round(x - spr.width / 2 - 6), Math.round(y - spr.height / 2 - 6), spr.width + 12, spr.height + 12);
          ctx.setLineDash([]);
        }
        // players landed on this planet
        const landed = onPlanets.filter((o) => o.planet_id === l.p.id).length;
        if (landed > 0) {
          ctx.fillStyle = MAP.otherPlayer;
          ctx.fillRect(Math.round(x + spr.width / 2 + 2), Math.round(y - spr.height / 2 - 8), 12, 10);
          ctx.fillStyle = MAP.background;
          ctx.font = canvasFont(8);
          ctx.fillText(String(landed), Math.round(x + spr.width / 2 + 5), Math.round(y - spr.height / 2));
        }
        l.x = x; l.y = y;
      }
      // my rocket
      const me = posRef.current;
      const bob = reduce ? 0 : Math.round(Math.sin(t * 2) * 2);
      ctx.drawImage(mine, Math.round(cx + me.x - 12), Math.round(cy + me.y - 16 + bob));
      drawNameplate(ctx, displayName, Math.round(cx + me.x), Math.round(cy + me.y - 18 + bob), { px: 7 });
      // other players in orbit
      inOrbit.forEach((o, i) => {
        if (!otherSprites.has(o.player_id) && o.rocket) otherSprites.set(o.player_id, drawRocket(o.rocket as RocketConfig, 1));
        const spr = otherSprites.get(o.player_id);
        const ox = cx + (Number.isFinite(o.x) ? o.x : 0) + (i + 1) * 30;
        const oy = cy + (Number.isFinite(o.y) ? o.y : 0);
        if (spr) ctx.drawImage(spr, Math.round(ox - 12), Math.round(oy - 16));
        drawNameplate(ctx, o.display_name || o.username, Math.round(ox), Math.round(oy - 18), { px: 7, color: MAP.otherPlayer });
        if (o.action === 'wave' && o.action_at && Date.now() - new Date(o.action_at).getTime() < 6000) {
          ctx.fillStyle = MAP.star;
          ctx.font = canvasFont(8);
          ctx.textAlign = 'left';
          ctx.fillText('WAVES', Math.round(ox + 14), Math.round(oy - 26));
        }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [system, layout, selected, discoveredSet, rocket, username, displayName, inOrbit, onPlanets]);

  // click to select a planet
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    let best: { id: string; d: number } | null = null;
    for (const l of layout) {
      if (l.x == null || l.y == null) continue;
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < Math.max(26, l.p.radius + 8) && (!best || d < best.d)) best = { id: l.p.id, d };
    }
    if (best) { setSelected(best.id); sfx('blip'); }
  };

  const sel = system.planets.find((p) => p.id === selected) ?? null;

  async function land() {
    if (!sel || busy) return;
    setBusy(true);
    sfx('land');
    let res: Response;
    try {
      res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'land', planetId: sel.id }) });
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
    const data = (await res.json()) as { points_awarded: number; newly_discovered: boolean; first_find: boolean };
    if (data.newly_discovered) {
      // Reflect the discovery immediately without waiting for a server component refresh.
      setDiscoveredState((prev) => {
        const next = new Set(prev);
        next.add(sel.id);
        return next;
      });
      if (data.first_find) {
        setFirstFoundState((prev) => ({
          ...prev,
          [sel.id]: { username, at: new Date().toISOString() },
        }));
      }
      sfx('found');
      toast({ head: `${COPY.planetFound.head} +${data.points_awarded}`, sub: data.first_find ? 'Nobody had logged this world before you.' : COPY.planetFound.sub, tone: 'ok' });
    }
    // Refresh the server component payload as well, so returning to this route cannot restore stale discovery data.
    router.refresh();
    router.push(`/planet/${idToSlug(sel.id)}`);
  }

  return (
    <div className="game-grid">
      <div>
        <div className="map-frame">
          <canvas ref={canvasRef} width={W} height={H} onClick={onClick} role="img" aria-label={`Map of the ${system.name} system. Use the planet list to select and inspect planets.`} />
        </div>
        <div className="legend">
          <span><i style={{ background: MAP.discovered }} />Discovered planet</span>
          <span><i style={{ background: MAP.undiscovered }} />Unknown planet</span>
          <span><i style={{ background: MAP.otherPlayer }} />Real player</span>
          <span className="muted">Presence: {presence.status === 'live' ? <span className="green">live</span> : presence.status === 'offline' ? <span className="red">{COPY.signalLost.head}</span> : 'connecting'}</span>
        </div>

        <div className="planet-list" style={{ marginTop: '1rem' }}>
          {system.planets.map((p) => {
            const known = discoveredSet.has(p.id);
            const landed = onPlanets.filter((o) => o.planet_id === p.id).length;
            return (
              <button key={p.id} type="button" className="planet-row" aria-pressed={selected === p.id} onClick={() => { setSelected(p.id); sfx('blip'); }}>
                <PlanetSprite planet={p} chunk={2} radius={12} style={{ opacity: known ? 1 : 0.5 }} />
                <span>
                  <span className="name">{known ? p.name : `Unknown world ${p.index + 1}`}</span>
                  <br />
                  <span className="sub">{known ? `${p.biome}, ${p.temperature} C` : 'Land to identify'}{landed ? `. ${landed} player${landed > 1 ? 's' : ''} on the surface` : ''}</span>
                </span>
                <span>{known ? <Tag kind={p.rarity}>{RARITY_LABEL[p.rarity]}</Tag> : <Tag>?</Tag>}</span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="stack">
        <Panel title={sel ? 'Selected planet' : 'Select a planet'} tight>
          {sel ? (
            <div className="stack">
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
                <PlanetSprite planet={sel} chunk={2} radius={20} style={{ opacity: discoveredSet.has(sel.id) ? 1 : 0.6 }} />
                <div>
                  <div className="display-sm">{discoveredSet.has(sel.id) ? sel.name : 'UNIDENTIFIED'}</div>
                  <div className="row" style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
                    <EntityKind kind="proc" />
                    {discoveredSet.has(sel.id) ? <Tag kind={sel.rarity}>{RARITY_LABEL[sel.rarity]}</Tag> : null}
                  </div>
                </div>
              </div>
              {discoveredSet.has(sel.id) ? (
                <dl className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat"><dt>Biome</dt><dd style={{ fontSize: '0.9rem' }}>{sel.biome}</dd></div>
                  <div className="stat"><dt>Gravity</dt><dd style={{ fontSize: '0.9rem' }}>{sel.gravity.toFixed(2)} g</dd></div>
                  <div className="stat"><dt>Temp</dt><dd style={{ fontSize: '0.9rem' }}>{sel.temperature} C</dd></div>
                  <div className="stat"><dt>Sites</dt><dd style={{ fontSize: '0.9rem' }}>{sel.sites.length}</dd></div>
                </dl>
              ) : (
                <p className="small dim" style={{ margin: 0 }}>Orbit scan shows a world with {sel.sites.length} points of interest and {sel.nodes.length} resource readings. Land to find out what it is.</p>
              )}
              {firstFoundMap[sel.id] ? (
                <p className="small muted" style={{ margin: 0 }}>First discovered by <span className="amber">{firstFoundMap[sel.id].username}</span> on {new Date(firstFoundMap[sel.id].at).toLocaleDateString()}.</p>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>Nobody has logged this planet yet.</p>
              )}
              <Button variant="primary" block busy={busy} onClick={land}>
                <PixelIcon name="planet" size={12} /> {discoveredSet.has(sel.id) ? 'Land' : 'Land (+100 discovery)'}
              </Button>
            </div>
          ) : (
            <p className="small dim" style={{ margin: 0 }}>Click a planet on the map or in the list to inspect it. Unknown worlds only show what orbit scans can see.</p>
          )}
        </Panel>

        <Panel title="In this system" tight>
          {presence.others.length === 0 ? (
            <p className="small dim" style={{ margin: 0 }}>{COPY.nobodyNearby.head} {COPY.nobodyNearby.sub}</p>
          ) : (
            presence.others.map((o) => <PlayerCard key={o.player_id} row={o} where={o.planet_id ? `On ${system.planets.find((p) => p.id === o.planet_id)?.name ?? 'a planet'}` : 'In orbit'} onWave={presence.wave} compact />)
          )}
        </Panel>

        <Panel title="Leave" tight>
          <Link href="/universe" className="btn btn-ghost btn-block">
            <PixelIcon name="leave" size={12} /> Back to the galaxy
          </Link>
        </Panel>
      </aside>
    </div>
  );
}
