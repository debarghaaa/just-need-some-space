'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialogue, EntityKind, Panel, Tag } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { COPY } from '@/game/copy';
import { canvasFont, drawExplorer, drawNameplate, drawResource, drawSite, drawTerrainTiles } from '@/game/pixel';
import { DEFAULT_SUIT, suitFromRow, type SuitConfig } from '@/game/rockets';
import { INTERACT_RANGE_TILES, WALK_SPEED } from '@/game/rules';
import { generatePlanet, generateSystem, RARITY_LABEL, type Planet, type ResourceNode, type Site } from '@/game/universe';
import type { PresenceRow } from '@/app/api/presence/route';
import { usePresence } from './usePresence';
import { useSfx } from './useSfx';
import { PlayerCard } from './PlayerCard';
import { MAP, PALETTE } from '@/game/palette';

const TILE = 8; // logical px per tile
const SCALE = 3; // canvas px per logical px

type Target = { kind: 'site'; site: Site; dist: number } | { kind: 'node'; node: ResourceNode; dist: number } | { kind: 'player'; row: PresenceRow; dist: number } | null;

export function PlanetExplorer(props: { seed: string; systemIndex: number; planetIndex: number; systemSlug: string; initialScanned: string[]; initialCollected: string[]; username: string; displayName?: string; suit: SuitConfig }) {
  const { seed, systemIndex, planetIndex, systemSlug, username, suit } = props;
  const displayName = props.displayName || username;
  const router = useRouter();
  const toast = useToast();
  const sfx = useSfx();
  const planet: Planet = useMemo(() => {
    const sys = generateSystem(seed, systemIndex);
    return sys.planets[planetIndex] ?? generatePlanet(seed, systemIndex, planetIndex, 100);
  }, [seed, systemIndex, planetIndex]);

  const [scanned, setScanned] = useState<Set<string>>(() => new Set(props.initialScanned));
  const [collected, setCollected] = useState<Set<string>>(() => new Set(props.initialCollected));
  const [target, setTarget] = useState<Target>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Array<{ head: string; sub?: string }>>([{ head: 'LANDED.', sub: `${planet.name}. ${planet.atmosphere} atmosphere. Hazards: ${planet.hazards.join(', ') || 'none noted'}.` }]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pos = useRef({ x: 3.5, y: planet.areaH / 2, facing: 1, moving: false, frame: 0 as 0 | 1 });
  const keys = useRef<Record<string, boolean>>({});
  const scannedRef = useRef(scanned);
  const collectedRef = useRef(collected);
  scannedRef.current = scanned;
  collectedRef.current = collected;

  const getPos = useCallback(() => ({ x: pos.current.x, y: pos.current.y, facing: pos.current.facing }), []);
  const presence = usePresence({ systemId: planet.systemId, planetId: planet.id }, getPos);
  const othersRef = useRef<PresenceRow[]>([]);
  othersRef.current = presence.others;

  const pushLog = useCallback((head: string, sub?: string) => setLog((l) => [{ head, sub }, ...l].slice(0, 6)), []);

  // ------------------------------------------------------------ input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.current[k] = true; e.preventDefault(); }
      if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); void act(); }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, busy]);

  const hold = (k: string, on: boolean) => { keys.current[k] = on; };

  // ------------------------------------------------------------ game loop + render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tiles = drawTerrainTiles(planet, SCALE);
    const siteSprites = Object.fromEntries(planet.sites.map((s) => [s.id, drawSite(s.kind, SCALE)]));
    const nodeSprites = { common: drawResource('common', SCALE), rare: drawResource('rare', SCALE), exotic: drawResource('exotic', SCALE) };
    const me = [drawExplorer(suit, 0, SCALE), drawExplorer(suit, 1, SCALE)];
    const otherSprites = new Map<string, HTMLCanvasElement>();
    const spriteFor = (o: PresenceRow) => {
      const key = o.suit ? `${o.suit.suit_primary}/${o.suit.suit_secondary}/${o.suit.suit_visor}/${o.suit.suit_pack}` : 'default';
      let spr = otherSprites.get(key);
      if (!spr) { spr = drawExplorer(o.suit ? suitFromRow(o.suit) : DEFAULT_SUIT, 0, SCALE); otherSprites.set(key, spr); }
      return spr;
    };
    const W = planet.areaW * TILE * SCALE;
    const H = planet.areaH * TILE * SCALE;
    canvas.width = W;
    canvas.height = H;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

    let last = performance.now();
    let raf = 0;
    let walkT = 0;
    let lastTargetKey = '';

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      let dx = 0;
      let dy = 0;
      if (k.w || k.arrowup) dy -= 1;
      if (k.s || k.arrowdown) dy += 1;
      if (k.a || k.arrowleft) dx -= 1;
      if (k.d || k.arrowright) dx += 1;
      const p = pos.current;
      p.moving = dx !== 0 || dy !== 0;
      if (p.moving) {
        const len = Math.hypot(dx, dy);
        p.x = Math.max(0.5, Math.min(planet.areaW - 0.5, p.x + (dx / len) * WALK_SPEED * dt));
        p.y = Math.max(0.5, Math.min(planet.areaH - 0.5, p.y + (dy / len) * WALK_SPEED * dt));
        if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
        walkT += dt;
        p.frame = Math.floor(walkT * 6) % 2 === 0 ? 0 : 1;
      } else p.frame = 0;

      // nearest interactable
      let best: Target = null;
      for (const s of planet.sites) {
        const d = Math.hypot(s.tx + 0.5 - p.x, s.ty + 0.5 - p.y);
        if (d <= INTERACT_RANGE_TILES && (!best || d < best.dist)) best = { kind: 'site', site: s, dist: d };
      }
      for (const n of planet.nodes) {
        if (collectedRef.current.has(n.id)) continue;
        const d = Math.hypot(n.tx + 0.5 - p.x, n.ty + 0.5 - p.y);
        if (d <= INTERACT_RANGE_TILES && (!best || d < best.dist)) best = { kind: 'node', node: n, dist: d };
      }
      for (const o of othersRef.current) {
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d <= INTERACT_RANGE_TILES * 1.5 && (!best || d < best.dist)) best = { kind: 'player', row: o, dist: d };
      }
      const key = best ? `${best.kind}:${best.kind === 'site' ? best.site.id : best.kind === 'node' ? best.node.id : best.row.player_id}` : '';
      if (key !== lastTargetKey) {
        lastTargetKey = key;
        setTarget(best);
        if (best?.kind === 'player') sfx('blip');
      }

      // ---- draw
      for (let ty = 0; ty < planet.areaH; ty++)
        for (let tx = 0; tx < planet.areaW; tx++) {
          const v = ((tx * 7 + ty * 13 + planet.seed) % 11 === 0) ? 3 : (tx * 31 + ty * 17 + planet.seed) % 3;
          ctx.drawImage(tiles[v], tx * TILE * SCALE, ty * TILE * SCALE);
        }
      // sites
      for (const s of planet.sites) {
        const spr = siteSprites[s.id];
        const x = s.tx * TILE * SCALE - (spr.width - TILE * SCALE) / 2;
        const y = s.ty * TILE * SCALE - (spr.height - TILE * SCALE);
        ctx.drawImage(spr, Math.round(x), Math.round(y));
        if (scannedRef.current.has(s.id)) {
          ctx.fillStyle = PALETTE.celestialCyan; // 47.6: discovery highlight
          ctx.fillRect(Math.round(x + spr.width - 6), Math.round(y), 6, 6);
        }
      }
      // nodes
      for (const n of planet.nodes) {
        if (collectedRef.current.has(n.id)) continue;
        const spr = nodeSprites[n.resource.tier];
        const bob = reduce ? 0 : Math.round(Math.sin(now / 400 + n.index) * 1.5) * SCALE;
        ctx.drawImage(spr, Math.round(n.tx * TILE * SCALE - (spr.width - TILE * SCALE) / 2), Math.round(n.ty * TILE * SCALE - (spr.height - TILE * SCALE) / 2 + bob));
      }
      // highlight target
      if (best) {
        const tx = best.kind === 'site' ? best.site.tx : best.kind === 'node' ? best.node.tx : best.row.x - 0.5;
        const ty = best.kind === 'site' ? best.site.ty : best.kind === 'node' ? best.node.ty : best.row.y - 0.5;
        ctx.strokeStyle = best.kind === 'player' ? MAP.otherPlayer : PALETTE.sky;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.round(tx * TILE * SCALE) - 6, Math.round(ty * TILE * SCALE) - 10, TILE * SCALE + 12, TILE * SCALE + 16);
        ctx.setLineDash([]);
      }
      // other players
      ctx.font = canvasFont(4 * SCALE);
      ctx.textAlign = 'center';
      for (const o of othersRef.current) {
        const ox = o.x * TILE * SCALE;
        const oy = o.y * TILE * SCALE;
        const spr = spriteFor(o);
        ctx.save();
        if (o.facing === -1) { ctx.translate(Math.round(ox + spr.width / 2), 0); ctx.scale(-1, 1); ctx.drawImage(spr, 0, Math.round(oy - spr.height)); }
        else ctx.drawImage(spr, Math.round(ox - spr.width / 2), Math.round(oy - spr.height));
        ctx.restore();
        drawNameplate(ctx, o.display_name || o.username, Math.round(ox), Math.round(oy - spr.height - SCALE), { px: 4 * SCALE, color: MAP.otherPlayer });
        if (o.action === 'wave' && o.action_at && Date.now() - new Date(o.action_at).getTime() < 6000) {
          ctx.fillStyle = PALETTE.starlight;
          ctx.font = canvasFont(4 * SCALE);
          ctx.textAlign = 'center';
          ctx.fillText('WAVES', Math.round(ox), Math.round(oy - spr.height - 9 * SCALE));
        }
      }
      // me
      const mx = p.x * TILE * SCALE;
      const my = p.y * TILE * SCALE;
      const spr = me[p.frame];
      ctx.save();
      if (p.facing === -1) { ctx.translate(Math.round(mx + spr.width / 2), 0); ctx.scale(-1, 1); ctx.drawImage(spr, 0, Math.round(my - spr.height)); }
      else ctx.drawImage(spr, Math.round(mx - spr.width / 2), Math.round(my - spr.height));
      ctx.restore();
      drawNameplate(ctx, displayName, Math.round(mx), Math.round(my - spr.height - SCALE), { px: 4 * SCALE });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [planet, suit, username, displayName, sfx]);

  // ------------------------------------------------------------ actions (server-authoritative)
  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (!res.ok) throw new Error(json.error ?? 'Request failed.');
    return json;
  }

  async function act() {
    if (busy || !target) return;
    if (target.kind === 'player') {
      presence.wave();
      sfx('wave');
      toast({ head: 'YOU WAVED.', sub: `${target.row.username} will see it within a few seconds.`, tone: 'info', ttl: 2500 });
      return;
    }
    setBusy(true);
    try {
      if (target.kind === 'site') {
        sfx('scan');
        const r = (await post({ action: 'scan_site', planetId: planet.id, siteIndex: target.site.index })) as { points_awarded: number; newly_discovered: boolean; full_scan_points: number };
        setScanned((s) => new Set(s).add(target.site.id));
        if (r.newly_discovered) {
          pushLog(`SCANNED: ${target.site.name.toUpperCase()}`, `${RARITY_LABEL[target.site.rarity]} ${target.site.kind}. +${r.points_awarded} points.`);
          toast({ head: `+${r.points_awarded} SCAN`, sub: target.site.name, tone: 'ok', ttl: 2500 });
          if (r.full_scan_points > 0) { sfx('found'); toast({ head: `PLANET FULLY SCANNED. +${r.full_scan_points}`, sub: 'Every point of interest logged. Nothing left to misunderstand.', tone: 'ok' }); pushLog('FULLY SCANNED.', `+${r.full_scan_points} points.`); }
        } else pushLog('ALREADY SCANNED.', `${target.site.name}. Still there. Still odd.`);
      } else if (target.kind === 'node') {
        const r = (await post({ action: 'collect', planetId: planet.id, nodeIndex: target.node.index })) as { points_awarded: number; collected: boolean; new_resource: boolean };
        if (r.collected) {
          sfx('collect');
          setCollected((s) => new Set(s).add(target.node.id));
          setTarget(null);
          pushLog(`COLLECTED: ${target.node.resource.name.toUpperCase()} x${target.node.amount}`, `${RARITY_LABEL[target.node.resource.tier]}. +${r.points_awarded} points.${r.new_resource ? ' New codex entry.' : ''}`);
          toast({ head: `+${r.points_awarded} ${target.node.resource.name.toUpperCase()}`, sub: r.new_resource ? 'First time you have seen this. Added to the codex.' : `x${target.node.amount} added to inventory.`, tone: 'ok', ttl: 2500 });
        } else pushLog('NOTHING LEFT HERE.', 'You already took it.');
      }
      router.refresh();
    } catch (e) {
      sfx('error');
      toast({ head: COPY.saveFailed.head, sub: e instanceof Error ? e.message : COPY.saveFailed.sub, tone: 'err' });
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    sfx('land');
    await fetch('/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemId: planet.systemId, planetId: null, x: 0, y: 0, facing: 1 }) }).catch(() => undefined);
    router.push(`/system/${systemSlug}`);
  }

  const sitesDone = planet.sites.filter((s) => scanned.has(s.id)).length;
  const nodesLeft = planet.nodes.filter((n) => !collected.has(n.id)).length;

  const prompt = target
    ? target.kind === 'player'
      ? { head: COPY.playerDetected, sub: target.row.display_name || target.row.username, actionLabel: 'Wave' }
      : target.kind === 'site'
        ? { head: scanned.has(target.site.id) ? 'SCANNED SITE' : 'UNKNOWN SITE', sub: scanned.has(target.site.id) ? target.site.name : `${target.site.kind}. Press E to scan.`, actionLabel: 'Scan' }
        : { head: `${target.node.resource.name.toUpperCase()}`, sub: `${RARITY_LABEL[target.node.resource.tier]} resource, x${target.node.amount}. Press E to collect.`, actionLabel: 'Collect' }
    : null;

  return (
    <div className="game-grid">
      <div>
        <div className="explore-frame">
          <canvas ref={canvasRef} role="img" aria-label={`Surface of ${planet.name}. Use the arrow keys or WASD to walk, E to interact.`} />
          <div className="hud">
            <span>Sites {sitesDone}/{planet.sites.length}</span>
            <span>Resources left {nodesLeft}</span>
            <span className={presence.status === 'live' ? 'green' : presence.status === 'offline' ? 'red' : ''}>{presence.status === 'live' ? `Live: ${presence.others.length} other${presence.others.length === 1 ? '' : 's'} here` : presence.status === 'offline' ? COPY.signalLost.head : 'Connecting'}</span>
          </div>
          {prompt ? (
            <div className="prompt">
              <div className="dialogue" style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div className={`dialogue-head ${target?.kind === 'player' ? 'warm' : ''}`}>{prompt.head}</div>
                  <div className="dialogue-sub small">
                    {prompt.sub} {target?.kind === 'player' ? <EntityKind kind="player" /> : <EntityKind kind="proc" />}
                  </div>
                </div>
                <div className="row" style={{ gap: '0.4rem' }}>
                  {target?.kind === 'player' ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => { pos.current.x = target.row.x - 1; pos.current.y = target.row.y; }}>Approach</Button>
                      <Button size="sm" onClick={act}>Wave</Button>
                      <InviteInline row={target.row} />
                    </>
                  ) : (
                    <Button size="sm" variant="primary" busy={busy} onClick={act}>
                      {prompt.actionLabel} <kbd>E</kbd>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="keys" style={{ marginTop: '0.75rem' }}>
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to walk</span>
          <span><kbd>E</kbd> scan, collect or wave</span>
          <span className="muted">Stand next to something to interact with it.</span>
        </div>
        <div className="dpad" aria-label="Touch controls">
          <button type="button" className="up" aria-label="Walk up" onPointerDown={() => hold('w', true)} onPointerUp={() => hold('w', false)} onPointerLeave={() => hold('w', false)} onPointerCancel={() => hold('w', false)}>W</button>
          <button type="button" className="left" aria-label="Walk left" onPointerDown={() => hold('a', true)} onPointerUp={() => hold('a', false)} onPointerLeave={() => hold('a', false)} onPointerCancel={() => hold('a', false)}>A</button>
          <button type="button" className="act" aria-label="Interact" onClick={act}>E</button>
          <button type="button" className="right" aria-label="Walk right" onPointerDown={() => hold('d', true)} onPointerUp={() => hold('d', false)} onPointerLeave={() => hold('d', false)} onPointerCancel={() => hold('d', false)}>D</button>
          <button type="button" className="down" aria-label="Walk down" onPointerDown={() => hold('s', true)} onPointerUp={() => hold('s', false)} onPointerLeave={() => hold('s', false)} onPointerCancel={() => hold('s', false)}>S</button>
        </div>
      </div>

      <aside className="stack">
        <Panel title="Log" tight>
          <div className="stack" style={{ display: 'grid', gap: '0.5rem' }} aria-live="polite">
            {log.map((l, i) => (
              <div key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>
                <div className="display-xs">{l.head}</div>
                {l.sub ? <div className="small dim">{l.sub}</div> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="This world" tight>
          <dl className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat"><dt>Rarity</dt><dd style={{ fontSize: '0.85rem' }}><Tag kind={planet.rarity}>{RARITY_LABEL[planet.rarity]}</Tag></dd></div>
            <div className="stat"><dt>Moons</dt><dd style={{ fontSize: '0.9rem' }}>{planet.moons}</dd></div>
            <div className="stat"><dt>Resources</dt><dd style={{ fontSize: '0.8rem' }}>{planet.resourceTypes.map((r) => r.name).join(', ')}</dd></div>
            <div className="stat"><dt>Hazards</dt><dd style={{ fontSize: '0.8rem' }}>{planet.hazards.join(', ') || 'none'}</dd></div>
          </dl>
        </Panel>

        <Panel title="Also on the surface" tight>
          {presence.others.length === 0 ? (
            <Dialogue head={COPY.nobodyNearby.head} sub={COPY.nobodyNearby.sub} />
          ) : (
            presence.others.map((o) => (
              <PlayerCard key={o.player_id} row={o} where={`${Math.round(Math.hypot(o.x - pos.current.x, o.y - pos.current.y))} tiles away`} onWave={presence.wave} onApproach={() => { pos.current.x = Math.max(0.5, o.x - 1); pos.current.y = o.y; }} compact />
            ))
          )}
        </Panel>

        <Panel title="Leave" tight>
          <Button variant="ghost" block onClick={leave}>
            <PixelIcon name="rocket" size={12} /> Return to orbit
          </Button>
          <p className="small muted" style={{ margin: '0.5rem 0 0' }}>
            Or <Link href="/universe">go back to the galaxy</Link>. {COPY.returnEarth.head} is not an option we offer.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function InviteInline({ row }: { row: PresenceRow }) {
  // Reuses PlayerCard's invite modal without the card chrome.
  return (
    <div style={{ display: 'contents' }}>
      <PlayerCardInvite row={row} />
    </div>
  );
}

function PlayerCardInvite({ row }: { row: PresenceRow }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      busy={busy}
      onClick={async () => {
        if (!window.confirm(`${COPY.friendInvite.head} ${COPY.friendInvite.sub} Send a friend invite to ${row.username}?`)) return;
        setBusy(true);
        const res = await fetch('/api/friends', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'invite', userId: row.player_id }) });
        const json = (await res.json().catch(() => ({}))) as { error?: string; already?: string };
        setBusy(false);
        if (!res.ok) return toast({ head: 'INVITE FAILED.', sub: json.error ?? 'Try again.', tone: 'err' });
        toast({ head: json.already ? 'ALREADY SENT.' : 'INVITE SENT.', sub: `${row.username} can accept it from their profile.`, tone: 'ok' });
      }}
    >
      Invite
    </Button>
  );
}
