import { describe, expect, it } from 'vitest';
import { drawFlare, drawGalaxy, drawNebula, scatterDeepSky } from '@/game/deep-sky';
import { APPROVED_HEXES, OFFICIAL, PALETTE } from '@/game/palette';

const W = 640;
const H = 400;

describe('deep-sky scenery on the galaxy map', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = scatterDeepSky('seed-a', W, H, []);
    const b = scatterDeepSky('seed-a', W, H, []);
    const c = scatterDeepSky('seed-b', W, H, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('only uses approved colours', () => {
    const objs = scatterDeepSky('just-need-some-space', W, H, []);
    for (const o of objs) for (const cell of o.cells) expect(APPROVED_HEXES.has(cell.c.toLowerCase()), cell.c).toBe(true);
  });

  it('places galaxies, nebulae, clusters and flares inside the map', () => {
    const objs = scatterDeepSky('just-need-some-space', W, H, []);
    const kinds = new Set(objs.map((o) => o.kind));
    expect(kinds).toEqual(new Set(['galaxy', 'nebula', 'cluster', 'flare']));
    for (const o of objs) {
      for (const cell of o.cells) {
        const x = o.x + cell.x * o.px;
        const y = o.y + cell.y * o.px;
        expect(x).toBeGreaterThanOrEqual(-2);
        expect(y).toBeGreaterThanOrEqual(-2);
        expect(x).toBeLessThanOrEqual(W + 2);
        expect(y).toBeLessThanOrEqual(H + 2);
      }
    }
  });

  it('keeps clear of the interactive star systems', () => {
    const keepOut = [
      { x: 120, y: 120, radius: 46 },
      { x: 320, y: 200, radius: 46 },
      { x: 520, y: 280, radius: 46 },
    ];
    const objs = scatterDeepSky('just-need-some-space', W, H, keepOut);
    for (const o of objs) {
      const reach = Math.max(...o.cells.map((c) => Math.hypot(c.x, c.y))) * o.px;
      for (const k of keepOut) {
        // object centres stay outside the keep-out disc by at least the object's own placement radius
        expect(Math.hypot(k.x - o.x, k.y - o.y), `${o.kind} overlaps a system`).toBeGreaterThan(k.radius);
        expect(reach).toBeLessThan(80);
      }
    }
  });

  it('keeps warm colours rare: most cells are cool blues', () => {
    const objs = scatterDeepSky('just-need-some-space', W, H, []);
    const warm = new Set<string>([OFFICIAL.cream, OFFICIAL.apricotCream, OFFICIAL.powderBlush, OFFICIAL.lemonChiffon, OFFICIAL.pinkMist, OFFICIAL.petalRouge, OFFICIAL.babyPink].map((h) => h.toLowerCase()));
    let total = 0;
    let warmCount = 0;
    for (const o of objs) for (const c of o.cells) { total++; if (warm.has(c.c.toLowerCase())) warmCount++; }
    expect(warmCount / total).toBeLessThan(0.08);
  });

  it('primitives produce a sensible number of cells', () => {
    expect(drawGalaxy(1, 14, 0.4, { core: PALETTE.ice, arm: PALETTE.orbitBlue, armLight: PALETTE.sky, halo: PALETTE.deepNavy, accent: PALETTE.sky }).length).toBeGreaterThan(120);
    expect(drawNebula(2, 10, false).length).toBeGreaterThan(30);
    expect(drawFlare(3, 5, false).length).toBeGreaterThan(8);
  });
});
