import { Rng, hashNoise, seedFrom } from './rng';
import { OFFICIAL, PALETTE } from './palette';

/**
 * Deep-sky decoration for the galaxy map: tilted spiral galaxies, nebulae, star clusters and
 * flare stars, scattered deterministically from the universe seed so every player sees the same
 * sky and nothing flickers between renders. Everything is built from 1 px cells (rendered as
 * squares) in the official colour system: cool blues for the ordinary objects, one Electric Aqua
 * variant, and a very rare warm one. Scenery only: not selectable, not discoverable, no gameplay meaning.
 */

export type DeepSkyKind = 'galaxy' | 'nebula' | 'cluster' | 'flare';

export interface Cell {
  x: number;
  y: number;
  c: string;
}

export interface DeepSkyObject {
  kind: DeepSkyKind;
  /** map position of the object's centre, in map units */
  x: number;
  y: number;
  /** pixel scale of each cell in map units (1 or 2) */
  px: number;
  cells: Cell[];
  /** accessible description */
  label: string;
}

interface GalaxyPalette {
  core: string;
  arm: string;
  armLight: string;
  halo: string;
  accent: string;
}

/** Cool blue galaxies dominate (47.14 blue ramp); the sparse aqua variant marks nothing, it is just a nicer one. */
const GALAXY_PALETTES: readonly GalaxyPalette[] = [
  { core: OFFICIAL.porcelain, arm: OFFICIAL.sapphire, armLight: OFFICIAL.icyBlue, halo: OFFICIAL.regalNavy, accent: OFFICIAL.icyBlue },
  { core: OFFICIAL.alabasterGrey, arm: OFFICIAL.duskBlue, armLight: OFFICIAL.icyBlue, halo: OFFICIAL.prussianBlue, accent: OFFICIAL.porcelain },
  { core: OFFICIAL.porcelain, arm: OFFICIAL.smartBlue, armLight: OFFICIAL.babyBlueIce, halo: OFFICIAL.regalNavy, accent: OFFICIAL.electricAqua },
  { core: OFFICIAL.lemonChiffon, arm: OFFICIAL.duskBlue, armLight: OFFICIAL.icyBlue, halo: OFFICIAL.prussianBlue, accent: OFFICIAL.apricotCream },
];

/**
 * A spiral galaxy seen at an angle, in the manner of the reference artwork: a dense elliptical disc
 * with a bright core, two arms wound through it that are lighter than the disc, dark dust lanes
 * hugging the inside of each arm, a ragged outer edge and stray stars thrown outward. Built by
 * evaluating a density field per cell in the galaxy's own (un-tilted) frame, then projecting.
 * `size` is the semi-major axis in cells.
 */
export function drawGalaxy(seed: number, size: number, tilt: number, pal: GalaxyPalette): Cell[] {
  const rng = new Rng(seedFrom(seed, 'galaxy'));
  const grid = new Map<string, string>();
  const flatten = 0.44 + rng.range(-0.06, 0.1); // axis ratio of the tilted disc
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const twist = 2.6 + rng.range(-0.4, 0.5);
  const phase = rng.range(0, Math.PI * 2);
  const handed = rng.chance(0.5) ? 1 : -1;
  const noiseSeed = rng.int(1, 1e9);
  const reach = Math.ceil(size * 1.25);
  // walk the projected bounding box and un-project each cell into the disc frame
  for (let py = -reach; py <= reach; py++) {
    for (let px = -reach; px <= reach; px++) {
      // inverse rotation, then un-flatten
      const u = px * cos + py * sin;
      const v = (-px * sin + py * cos) / flatten;
      const r = Math.hypot(u, v) / size; // 0 at the core, 1 at the nominal edge
      if (r > 1.3) continue;
      const ang = Math.atan2(v, u) * handed;
      // angular distance to the nearest of two arms (log spiral)
      const armAngle = Math.log(0.25 + r * 2.4) * twist + phase;
      let d = (ang - armAngle) % Math.PI;
      if (d < 0) d += Math.PI;
      d = Math.min(d, Math.PI - d) / (Math.PI / 2); // 0 on an arm, 1 midway between arms
      const n = hashNoise(px, py, noiseSeed);
      const n2 = hashNoise(px >> 1, py >> 1, noiseSeed + 7);
      // disc density: bright core, falling off outward, ragged beyond r=1
      const core = Math.exp(-(r * r) * 6);
      const disc = Math.exp(-r * 2.1);
      const arm = Math.exp(-(d * d) * 5.5) * (r > 0.22 ? 1 : 0) * (1 - Math.max(0, r - 0.95) * 4);
      const lane = Math.exp(-((d - 0.42) * (d - 0.42)) * 40) * (r > 0.3 && r < 0.95 ? 1 : 0);
      let density = core * 1.6 + disc * 0.7 + arm * 0.55 - lane * 0.35 + (n2 - 0.5) * 0.18;
      const edge = 1 - Math.max(0, r - 0.8) * 3.2; // outer fringe fades out, noise makes it ragged
      density *= Math.max(0, Math.min(1, edge + (n - 0.5) * 0.9));
      if (density < 0.12) continue;
      const bayer = ((px & 1) + (py & 1) * 2) / 4;
      if (density < 0.3 && bayer > (density - 0.1) * 3.5) continue; // dithered fringe
      let c: string;
      if (density > 1.05) c = pal.core;
      else if (density > 0.72) c = (bayer < 0.5 ? pal.core : pal.armLight);
      else if (density > 0.48) c = pal.armLight;
      else if (density > 0.3) c = pal.arm;
      else c = pal.halo;
      if (arm > 0.7 && r > 0.3 && density <= 0.72 && n > 0.86) c = pal.armLight; // sparkle in the arms
      if (lane > 0.75 && r > 0.35 && r < 0.9 && density > 0.3) c = pal.halo; // dust lane reads dark
      grid.set(`${px},${py}`, c);
    }
  }
  // accent sparks along the arms
  for (let i = 0; i < Math.max(3, Math.round(size / 2)); i++) {
    const r = rng.range(0.4, 1.0);
    const a = (Math.log(0.25 + r * 2.4) * twist + phase) * handed + (rng.chance(0.5) ? 0 : Math.PI) + rng.range(-0.1, 0.1);
    const u = Math.cos(a) * r * size;
    const v = Math.sin(a) * r * size * flatten;
    grid.set(`${Math.round(u * cos - v * sin)},${Math.round(u * sin + v * cos)}`, pal.accent);
  }
  // stray field stars around it
  for (let i = 0; i < size; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = rng.range(size * 1.1, size * 1.6);
    const u = Math.cos(a) * rr;
    const v = Math.sin(a) * rr * flatten;
    grid.set(`${Math.round(u * cos - v * sin)},${Math.round(u * sin + v * cos)}`, rng.chance(0.3) ? pal.armLight : pal.halo);
  }
  return [...grid.entries()].map(([k, c]) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y, c };
  });
}

/** A soft cloud of dithered cells with a brighter knot or two. Cool by default; the warm one is rare. */
export function drawNebula(seed: number, size: number, warm: boolean): Cell[] {
  const rng = new Rng(seedFrom(seed, 'nebula'));
  const grid = new Map<string, string>();
  const dim = warm ? OFFICIAL.prussianBlue : OFFICIAL.regalNavy;
  const mid = warm ? OFFICIAL.petalRouge : OFFICIAL.sapphire;
  const hot = warm ? OFFICIAL.apricotCream : OFFICIAL.smartBlue;
  const knots = Array.from({ length: rng.int(3, 4) }, () => ({ x: rng.range(-size * 0.5, size * 0.5), y: rng.range(-size * 0.35, size * 0.35), r: rng.range(size * 0.45, size * 0.75) }));
  for (let y = -size; y <= size; y++) {
    for (let x = -size; x <= size; x++) {
      let density = 0;
      for (const k of knots) {
        const d = Math.hypot(x - k.x, (y - k.y) * 1.3) / k.r;
        density += Math.max(0, 1 - d) * 0.9;
      }
      density += (hashNoise(x >> 1, y >> 1, seed) - 0.5) * 0.6 + (hashNoise(x >> 2, y >> 2, seed + 3) - 0.5) * 0.4;
      if (density < 0.16) continue;
      const bayer = ((x & 1) + (y & 1) * 2) / 4;
      if (density < 0.4 && bayer > density * 1.8) continue; // dithered edge
      grid.set(`${x},${y}`, density > 0.85 ? hot : density > 0.42 ? mid : dim);
    }
  }
  // a few embedded stars
  for (let i = 0; i < Math.max(2, size >> 1); i++) {
    const k = rng.pick(knots);
    grid.set(`${Math.round(k.x + rng.range(-k.r, k.r) * 0.5)},${Math.round(k.y + rng.range(-k.r, k.r) * 0.4)}`, PALETTE.ice);
  }
  return [...grid.entries()].map(([key, c]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, c };
  });
}

/** A loose globular cluster: many single cells, denser towards the middle. */
export function drawCluster(seed: number, size: number): Cell[] {
  const rng = new Rng(seedFrom(seed, 'cluster'));
  const grid = new Map<string, string>();
  const n = size * size * 1.2;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.next() ** 1.8 * size;
    const x = Math.round(Math.cos(a) * r);
    const y = Math.round(Math.sin(a) * r);
    const d = r / size;
    grid.set(`${x},${y}`, d < 0.25 ? PALETTE.ice : d < 0.6 ? PALETTE.sky : OFFICIAL.duskBlue);
  }
  return [...grid.entries()].map(([key, c]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, c };
  });
}

/** A four-point flare star, like the stitched stars around the reference galaxy. */
export function drawFlare(seed: number, size: number, cyan: boolean): Cell[] {
  const rng = new Rng(seedFrom(seed, 'flare'));
  const cells: Cell[] = [];
  const bright = cyan ? PALETTE.celestialCyan : PALETTE.ice;
  const soft = cyan ? PALETTE.sky : PALETTE.starlight;
  const faint = OFFICIAL.duskBlue;
  const long = size;
  const short = Math.max(1, Math.round(size * 0.5));
  for (let i = 1; i <= long; i++) {
    const c = i <= long * 0.4 ? bright : i <= long * 0.75 ? soft : faint;
    cells.push({ x: 0, y: -i, c }, { x: 0, y: i, c });
  }
  for (let i = 1; i <= short; i++) {
    const c = i <= short * 0.5 ? bright : soft;
    cells.push({ x: -i, y: 0, c }, { x: i, y: 0, c });
  }
  cells.push({ x: 0, y: 0, c: PALETTE.ice });
  if (rng.chance(0.5)) cells.push({ x: -1, y: -1, c: faint }, { x: 1, y: -1, c: faint }, { x: -1, y: 1, c: faint }, { x: 1, y: 1, c: faint });
  return cells;
}

interface Placement {
  x: number;
  y: number;
  radius: number;
}

/**
 * Space dust, as on the reference planet sheets: single-pixel specks of teal, gold, blue and a
 * little pink scattered thinly between the objects, with the odd two-pixel pair. Mostly cool and
 * dim so the interactive layer stays readable; deterministic so it never flickers. `keepOut`
 * discs (planets, stars, labels) stay clear.
 */
export interface Speck {
  x: number;
  y: number;
  c: string;
  /** 1 = a single cell, 2 = a two-cell pair (the brighter, closer specks) */
  size: 1 | 2;
  /** 0.35 to 1 */
  alpha: number;
}
const DUST_COLOURS: ReadonlyArray<readonly [string, number]> = [
  [OFFICIAL.tropicalTeal, 24],
  [OFFICIAL.oceanMist, 10],
  [OFFICIAL.smartBlue, 18],
  [OFFICIAL.icyBlue, 14],
  [OFFICIAL.duskBlue, 16],
  [OFFICIAL.apricotCream, 7],
  [OFFICIAL.cream, 5],
  [OFFICIAL.pinkMist, 4],
  [OFFICIAL.porcelain, 2],
];
export function scatterDust(seed: string, width: number, height: number, count: number, keepOut: Placement[] = []): Speck[] {
  const rng = new Rng(seedFrom(seed, 'dust'));
  const out: Speck[] = [];
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const x = Math.floor(rng.range(0, width));
    const y = Math.floor(rng.range(0, height));
    if (!keepOut.every((p) => Math.hypot(p.x - x, p.y - y) > p.radius)) continue;
    out.push({ x, y, c: rng.weighted(DUST_COLOURS), size: rng.chance(0.18) ? 2 : 1, alpha: rng.chance(0.3) ? 1 : rng.chance(0.5) ? 0.6 : 0.35 });
  }
  return out;
}

/**
 * Scatter deep-sky objects across a map of `width` x `height`, avoiding `keepOut` discs (the star
 * systems and their labels). Deterministic for a given seed. Returns objects sorted so the
 * biggest (drawn first, furthest back) come before the small flares.
 */
export function scatterDeepSky(seed: string, width: number, height: number, keepOut: Placement[]): DeepSkyObject[] {
  const rng = new Rng(seedFrom(seed, 'deep-sky'));
  const placed: Placement[] = [...keepOut];
  const out: DeepSkyObject[] = [];
  const tryPlace = (radius: number, attempts = 40): { x: number; y: number } | null => {
    for (let i = 0; i < attempts; i++) {
      const x = Math.round(rng.range(radius, width - radius));
      const y = Math.round(rng.range(radius, height - radius));
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.radius + radius)) {
        placed.push({ x, y, radius });
        return { x, y };
      }
    }
    return null;
  };

  // 3 galaxies: one large, two smaller
  const galaxyCount = 3;
  for (let i = 0; i < galaxyCount; i++) {
    const size = i === 0 ? rng.int(22, 26) : rng.int(13, 17);
    const px = i === 0 ? 2 : rng.chance(0.5) ? 2 : 1;
    const pos = tryPlace(size * px * 1.15 + 6);
    if (!pos) continue;
    const pal = i === 0 ? GALAXY_PALETTES[0] : rng.pick(GALAXY_PALETTES);
    const tilt = rng.range(-0.9, 0.9);
    out.push({ kind: 'galaxy', ...pos, px, cells: drawGalaxy(seedFrom(seed, 'g', i), size, tilt, pal), label: 'a distant spiral galaxy' });
  }
  // 2 nebulae: the warm one appears only for some seeds (gold and amber stay rare)
  for (let i = 0; i < 2; i++) {
    const size = rng.int(14, 18);
    const pos = tryPlace(size * 1.2 + 4);
    if (!pos) continue;
    const warm = i === 1 && rng.chance(0.35);
    out.push({ kind: 'nebula', ...pos, px: 1, cells: drawNebula(seedFrom(seed, 'n', i), size, warm), label: warm ? 'a warm nebula' : 'a cold nebula' });
  }
  // 2 clusters
  for (let i = 0; i < 2; i++) {
    const size = rng.int(9, 12);
    const pos = tryPlace(size + 4);
    if (!pos) continue;
    out.push({ kind: 'cluster', ...pos, px: 1, cells: drawCluster(seedFrom(seed, 'c', i), size), label: 'a star cluster' });
  }
  // flares: bright foreground stars
  const flares = rng.int(6, 9);
  for (let i = 0; i < flares; i++) {
    const size = rng.int(3, 7);
    const pos = tryPlace(size + 3, 20);
    if (!pos) continue;
    out.push({ kind: 'flare', ...pos, px: 1, cells: drawFlare(seedFrom(seed, 'f', i), size, i === 0), label: 'a bright star' });
  }
  return out;
}
