'use client';
import { useEffect, useMemo, useRef } from 'react';
import { generateSystem } from '@/game/universe';
import { HeroRocketSprite, PlanetSprite, StarSprite } from '@/components/game/Sprites';
import { scatterDust } from '@/game/deep-sky';

/** Cursor distance (px) within which a planet or the rocket names itself. */
const NEAR_PX = 64;
/** Parallax steps are whole pixel-art cells: never a half pixel. */
const CELL = 2;

/**
 * Hero visual: the first generated star system, drawn as a real pixel solar system. Planets sit on
 * dotted orbits and drift slowly; a chunky cartoon rocket (hero-rocket-art.ts) rides the third
 * orbit. Motion is CSS-only and switches
 * off under prefers-reduced-motion or the in-app setting.
 *
 * Cursor interaction: as the pointer moves anywhere over the hero, the system drifts with it in
 * depth (the star against the cursor, each orbit a little more with it), snapped to whole cells.
 * The planet or rocket nearest the cursor lights its orbit and shows its name. Parallax respects
 * the reduced-motion setting; the label does not move anything, so it stays available.
 */
export function HeroSolar({ seed }: { seed: string }) {
  const system = useMemo(() => generateSystem(seed, 0), [seed]);
  const planets = useMemo(() => system.planets.slice(0, 5), [system]);
  // coloured space dust between the orbits, as on the reference sheets (percent coordinates, deepest layer)
  const dust = useMemo(() => scatterDust(`${seed}:hero`, 100, 100, 46, [{ x: 50, y: 50, radius: 12 }]), [seed]);
  const rootRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([]); // planets 0..4, rocket at 5
  const labelRef = useRef<HTMLDivElement>(null);
  const labelNameRef = useRef<HTMLElement>(null);
  const labelSubRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hero = (root.closest('.hero') as HTMLElement | null) ?? root;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionOff = () => mq.matches || document.documentElement.dataset.motion === 'off';
    const snap = (v: number) => Math.round(v / CELL) * CELL;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    let raf = 0;
    let px = 0;
    let py = 0;
    let inside = false;
    let near = -1;

    const paint = () => {
      raf = 0;
      const hr = hero.getBoundingClientRect();
      const nx = inside ? clamp(((px - hr.left) / hr.width) * 2 - 1) : 0;
      const ny = inside ? clamp(((py - hr.top) / hr.height) * 2 - 1) : 0;
      const move = !motionOff();
      // depth: the star sits deepest and drifts against the cursor; orbits drift with it, more the further out
      if (starRef.current) starRef.current.style.translate = move ? `${snap(-nx * 4)}px ${snap(-ny * 4)}px` : '';
      if (dustRef.current) dustRef.current.style.translate = move ? `${snap(-nx * 6)}px ${snap(-ny * 6)}px` : '';
      layerRefs.current.forEach((el, i) => {
        if (el) el.style.translate = move ? `${snap(nx * (4 + i * 3))}px ${snap(ny * (4 + i * 3))}px` : '';
      });
      // whichever body is nearest the cursor names itself
      let best = -1;
      let bestD = NEAR_PX;
      let bx = 0;
      let by = 0;
      if (inside) {
        bodyRefs.current.forEach((el, i) => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const d = Math.hypot(px - cx, py - cy);
          if (d < bestD) { bestD = d; best = i; bx = cx; by = cy; }
        });
      }
      if (best !== near) {
        const ring = best === 5 ? 2 : best; // the rocket rides the third orbit
        layerRefs.current.forEach((el, i) => el?.classList.toggle('is-near', i === ring));
        near = best;
      }
      const label = labelRef.current;
      if (!label) return;
      if (best < 0) { label.classList.remove('is-on'); return; }
      if (labelNameRef.current && labelSubRef.current) {
        if (best === 5) { labelNameRef.current.textContent = 'Somebody\u2019s rocket'; labelSubRef.current.textContent = 'on the way out'; }
        else { labelNameRef.current.textContent = planets[best].name; labelSubRef.current.textContent = planets[best].biome; }
      }
      label.classList.add('is-on');
      const rr = root.getBoundingClientRect();
      const lw = label.offsetWidth;
      const lh = label.offsetHeight;
      const left = Math.round(Math.max(0, Math.min(rr.width - lw, bx - rr.left + 14)));
      const top = Math.round(Math.max(0, Math.min(rr.height - lh, by - rr.top - lh - 10)));
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onMove = (e: PointerEvent) => { px = e.clientX; py = e.clientY; inside = true; schedule(); };
    const onLeave = () => { inside = false; schedule(); };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [planets]);

  return (
    <div className="hero-visual" aria-label={`Pixel rendering of the ${system.name} system`} role="img" ref={rootRef}>
      <div className="solar">
        <div className="par solar-dust" ref={dustRef} aria-hidden="true">
          {dust.map((d, i) => (
            <i key={i} style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size === 2 ? 4 : 2, background: d.c, opacity: d.alpha * 0.8 }} />
          ))}
        </div>
        <div className="par solar-star" ref={starRef}>
          <div className="orbit-body">
            <StarSprite color={system.starColor} radius={Math.max(20, system.starRadius)} chunk={3} />
          </div>
        </div>
        {planets.map((p, i) => {
          const pct = 16 + i * 8.5;
          const dur = 46 + i * 22;
          const start = (i * 137) % 360;
          return (
            <div key={p.id} className="par" ref={(el) => { layerRefs.current[i] = el; }}>
              <div className="orbit" style={{ width: `${pct * 2}%`, height: `${pct * 2}%` }} />
              <div className="orbit-body orbit-spin" style={{ width: `${pct * 2}%`, height: `${pct * 2}%`, ['--dur' as string]: `${dur}s`, ['--start' as string]: `${start}deg`, animationDelay: `-${(start / 360) * dur}s` }}>
                <div style={{ position: 'absolute', left: '100%', top: '50%', translate: '-50% -50%' }} ref={(el) => { bodyRefs.current[i] = el; }}>
                  <PlanetSprite planet={p} chunk={2} radius={Math.min(p.radius, 16)} />
                </div>
              </div>
              {i === 2 ? (
                <div className="orbit-body orbit-spin" style={{ width: `${pct * 2}%`, height: `${pct * 2}%`, ['--dur' as string]: `${dur}s`, ['--start' as string]: `${start + 40}deg`, animationDelay: `-${((start + 40) / 360) * dur}s` }}>
                  <div style={{ position: 'absolute', left: '100%', top: '50%', translate: '-50% -50%', rotate: '90deg' }} ref={(el) => { bodyRefs.current[5] = el; }}>
                    <HeroRocketSprite scale={2} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="hero-focus" ref={labelRef} aria-hidden="true">
        <b ref={labelNameRef} />
        <small ref={labelSubRef} />
      </div>
    </div>
  );
}
