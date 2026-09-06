/**
 * Runtime pixel-art renderers. Every sprite is authored on a small logical grid and upscaled
 * with nearest-neighbour. No image files, no AI art: rockets, planets, terrain and icons are all
 * drawn from small string maps and deterministic noise.
 */
import { Rng, seedFrom, hashNoise } from './rng';
import { COLOR_BY_ID, rocketColors, type ColorId, type RocketConfig, type SuitConfig } from './rockets';
import type { Biome, Planet, SiteKind } from './universe';
import { OFFICIAL, PALETTE, RARITY_COLOR } from './palette';
import { EARTH_ART_MAP, EARTH_ART_ROWS, EARTH_ART_SIZE } from './earth-art';
import { ASTRONAUT_ICON_H, ASTRONAUT_ICON_MAP, ASTRONAUT_ICON_ROWS, ASTRONAUT_ICON_W } from './astronaut-art';
import { HERO_ROCKET_H, HERO_ROCKET_MAP, HERO_ROCKET_ROWS, HERO_ROCKET_W } from './hero-rocket-art';

export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  constructor(
    public readonly w: number,
    public readonly h: number,
    public readonly scale = 1,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w * scale;
    this.canvas.height = h * scale;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }
  set(x: number, y: number, color: string | null | undefined): void {
    if (!color || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x) * this.scale, Math.floor(y) * this.scale, this.scale, this.scale);
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }
  disc(cx: number, cy: number, r: number, color: string): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) this.set(cx + x, cy + y, color);
  }
  ring(cx: number, cy: number, r: number, color: string): void {
    for (let y = -r - 1; y <= r + 1; y++)
      for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= r + 0.5 && d >= r - 0.5) this.set(cx + x, cy + y, color);
      }
  }
  glyph(x: number, y: number, rows: readonly string[], map: Record<string, string>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        this.set(x + i, y + j, map[ch] ?? PALETTE.warningCoral); // unmapped glyph char: visible as a warning, never shipped
      }
    });
  }
  toDataURL(): string {
    return this.canvas.toDataURL();
  }
}

// ---------------------------------------------------------------- colour utils
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- rocket (24 x 32 grid, nose up)
// Each part is a string map on the shared grid. b = hull, s = hull shade, a = accent band, w = window
// glass, v = window shade, W = window glint, d = dark metal (also the automatic 1 px outline),
// h = hull highlight, F = fins and the nose cap of the classic hulls, E / e = engine, D = decal,
// . = transparent. The three classic hulls (stub, needle, barrel) are drawn in the same chunky
// cartoon style as the homescreen rocket: rounded nose cap in the fin colour with a glint, a big
// round porthole, a band in the accent colour, and a dark outline added by `outline()` so every
// rocket reads cleanly on dark and light surfaces alike. The flame is drawn separately.

/** Hulls whose wings and nozzles are baked into the art (the fin and engine choices only recolour them). */
const HULL_HAS_WINGS: Record<RocketConfig['body'], boolean> = { stub: false, needle: false, barrel: false, delta: true, cruiser: true, interceptor: true, hauler: true, lancer: true };
/** Column span of the classic hulls (fins attach outside it, decals sit inside it). */
const CLASSIC_HULL_SPAN: Partial<Record<RocketConfig['body'], [number, number]>> = { stub: [6, 17], needle: [8, 15], barrel: [5, 18] };
/** Column span of the central fuselage for decals on the baked hulls. */
const HULL_DECAL_SPAN: Partial<Record<RocketConfig['body'], [number, number]>> = { delta: [8, 15], cruiser: [7, 16], interceptor: [9, 14], hauler: [8, 15], lancer: [8, 15] };

const BODY_ROWS: Record<RocketConfig['body'], string[]> = {
  stub: [
    '........................',
    '..........FFFF..........',
    '.........FWWFFF.........',
    '........FWFFFFFF........',
    '.......FWFFFFFFFF.......',
    '......FFFFFFFFFFFF......',
    '......dddddddddddd......',
    '......hbbbbbbbbbss......',
    '......hbbbddddbbss......',
    '......hbbdWWwvdbss......',
    '......hbbdWwwvdbss......',
    '......hbbdwwwvdbss......',
    '......hbbdwvvvdbss......',
    '......hbbbddddbbss......',
    '......hbbbbbbbbbss......',
    '......aaaaaaaaaaaa......',
    '......hbbbbbbbbbss......',
    '......hbbbbbbbbbss......',
    '......hbbbbbbbbbss......',
    '......hbbbbbbbbbss......',
    '......hbbbbbbbbbss......',
    '......hbbbbbbbbbss......',
    '......dddddddddddd......',
  ],
  needle: [
    '........................',
    '...........FF...........',
    '..........FWFF..........',
    '..........FFFF..........',
    '.........FWFFFF.........',
    '.........FFFFFF.........',
    '........FFFFFFFF........',
    '........dddddddd........',
    '........hbbbbbbs........',
    '........hbddddbs........',
    '........hdWwwvds........',
    '........hdwwwvds........',
    '........hdwwvvds........',
    '........hbddddbs........',
    '........hbbbbbbs........',
    '........aaaaaaaa........',
    '........hbbbbbbs........',
    '........hbbbbbbs........',
    '........hbbbbbbs........',
    '........hbbbbbbs........',
    '........hbbbbbbs........',
    '........hbbbbbbs........',
    '........dddddddd........',
  ],
  barrel: [
    '........................',
    '.........FFFFFF.........',
    '........FWWFFFFF........',
    '.......FWFFFFFFFF.......',
    '......FWFFFFFFFFFF......',
    '.....FFFFFFFFFFFFFF.....',
    '.....dddddddddddddd.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbddddbbbss.....',
    '.....hbbbdWWwwvdbss.....',
    '.....hbbdWWwwwvvdss.....',
    '.....hbbdwwwwvvvdss.....',
    '.....hbbbdwvvvvdbss.....',
    '.....hbbbbddddbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....aaaaaaaaaaaaaa.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....hbbbbbbbbbbbss.....',
    '.....dddddddddddddd.....',
  ],
  // Delta: wide arrowhead fighter. Wings are part of the hull (b/s with a dark leading edge); F marks the wingtip panels.
  delta: [
    '...........bb...........',
    '..........bhhb..........',
    '..........bhhb..........',
    '.........bbhhbs.........',
    '.........bbwwbs.........',
    '........bbbwwbbs........',
    '........bbbwwbbs........',
    '.......bbbbwwbbbs.......',
    '.......bbbbwwbbbs.......',
    '......dbbbbwwbbbsd......',
    '.....dbbbbbwwbbbbsd.....',
    '....dbbbbbbwwbbbbbsd....',
    '...dbbbbbbbbbbbbbbbsd...',
    '..dbbbbbbbwwwwbbbbbbsd..',
    '.dbbFFbbbwwddwwbbbFFbsd.',
    'dbbbFFbbbwwddwwbbbFFbbsd',
    'dbbbbbbbbbwwwwbbbbbbbbsd',
    'dsbbbbbbbbbbbbbbbbbbbbsd',
    'dssbbbbbbbbbbbbbbbbbbssd',
    '.dsssbbbbbbddbbbbbbsssd.',
    '..dsssbbbbbddbbbbbsssd..',
    '...dsssbbbbddbbbbsssd...',
    '....dss.bbb..bbb.ssd....',
    '.....d..EEE..EEE..d.....',
    '........EEE..EEE........',
    '........eee..eee........',
    '........eee..eee........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Cruiser: twin forward prongs, dark round canopy, engine pods (F) strapped either side, twin nozzles built in.
  cruiser: [
    '........bb....bb........',
    '.......bhsb..bhsb.......',
    '.......bhsb..bhsb.......',
    '.......bbsb..bbsb.......',
    '.......bbsbbbbbsb.......',
    '.......bbbbbbbbbb.......',
    '.......bbbwddwbbb.......',
    '.......bbwddddwbb.......',
    '.......bbwddddwbb.......',
    '.......bbbwddwbbb.......',
    '..FFF..bbbbbbbbbb..FFF..',
    '.FFFFF.bbbbbbbbbb.FFFFF.',
    '.FFFFF.bbbbddbbbb.FFFFF.',
    '.FFFFFFbbbdddbbbbFFFFFF.',
    '.FFFFFFbbbdbbdbbbFFFFFF.',
    '.FFhFFFbbbdbbdbbbFFhFFF.',
    '.FFhFFFbbbbbbbbbbFFhFFF.',
    '.FFFFFFbbbwwwwbbbFFFFFF.',
    '.FFFFFFbbbwwwwbbbFFFFFF.',
    '.FFFFF.bbbbbbbbbb.FFFFF.',
    '.FFFFF.bbbbbbbbbb.FFFFF.',
    '..ddd..bbbbbbbbbb..ddd..',
    '..ddd..bbb.bb.bbb..ddd..',
    '.......EEE....EEE.......',
    '.......EEE....EEE.......',
    '.......eee....eee.......',
    '.......eee....eee.......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Interceptor: slim fuselage, forward-swept wings (F), one wide nozzle built in.
  interceptor: [
    '...........bb...........',
    '...........bb...........',
    '..........bhhs..........',
    '..........bhhs..........',
    '..........bwws..........',
    '..........bwws..........',
    '.........bbwwbs.........',
    '.........bbwwbs.........',
    '.........bbbbbs.........',
    '.........bbbbbs.........',
    '.........bbbbbs.........',
    'FF.......bbbbbs.......FF',
    'FFF......bbbbbs......FFF',
    'FFFF.....bbbbbs.....FFFF',
    '.FFFFF...bbddbs...FFFFF.',
    '..FFFFF..bbddbs..FFFFF..',
    '...FFFFF.bbbbbs.FFFFF...',
    '....FFFFFbbbbbsFFFFF....',
    '.....FFFFbbbbbsFFFF.....',
    '......FFFbbbbbsFFF......',
    '.......FFbbbbbsFF.......',
    '........Fbbbbbs.........',
    '........dbbbbbsd........',
    '.......dEEEEEEEd........',
    '........EEEEEEE.........',
    '........eeeeeee.........',
    '.........eeeee..........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Hauler: broad freighter with cargo bays and four small nozzles built in.
  hauler: [
    '.........bbbbbb.........',
    '........bbhhhhbs........',
    '........bbhhhhbs........',
    '........bbwwwwbs........',
    '........bbwddwbs........',
    '........bbwddwbs........',
    '........bbwwwwbs........',
    '.....bbbbbbbbbbbbbs.....',
    '....bbbbbbbbbbbbbbbs....',
    '....bbddbbbbbbbbddbs....',
    '....bbdbbbbbbbbbbdbs....',
    '....bbddbbbbbbbbddbs....',
    '....bbbbbbbbbbbbbbbs....',
    '....bbddbbbbbbbbddbs....',
    '....bbdbbbbbbbbbbdbs....',
    '....bbddbbbbbbbbddbs....',
    '....bbbbbbbbbbbbbbbs....',
    '.FFFbbbbbbbbbbbbbbbsFFF.',
    'FFFFbbbbbbbbbbbbbbbsFFFF',
    'FFFFbbbbbbbbbbbbbbbsFFFF',
    'FFFF.bbbbbbbbbbbbbs.FFFF',
    'FFF..bbbbbbbbbbbbbs..FFF',
    '.....bbb.bbb.bbb.bs.....',
    '....EEE.EEE..EEE.EEE....',
    '....EEE.EEE..EEE.EEE....',
    '....eee.eee..eee.eee....',
    '....eee.eee..eee.eee....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Lancer: needle nose, long swept wings (F), nozzles out on the wingtips built in.
  lancer: [
    '...........bb...........',
    '...........bb...........',
    '...........bb...........',
    '..........bbbs..........',
    '..........bbbs..........',
    '..........bwws..........',
    '.........bbwwbs.........',
    '.........bbwwbs.........',
    '.........bbwwbs.........',
    '.........bbbbbs.........',
    '........bbbbbbbs........',
    '........bbbbbbbs........',
    '.......FbbbbbbbsF.......',
    '......FFbbbddbbsFF......',
    '.....FFFbbbddbbsFFF.....',
    '....FFFFbbbbbbbsFFFF....',
    '...FFFFFbbbbbbbsFFFFF...',
    '..FFFFFFbbbbbbbsFFFFFF..',
    '.FFFFFFFbbbbbbbsFFFFFFF.',
    'FFFFFFFFbbbbbbbsFFFFFFFF',
    'FFF..FFFbbbbbbbsFFF..FFF',
    'FF....FFbbbbbbbsFF....FF',
    'dd....ddbbbbbbbsdd....dd',
    'EEE..EEE.bbbbb..EEE..EEE',
    'EEE..EEE........EEE..EEE',
    'eee..eee........eee..eee',
    'eee..eee........eee..eee',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
};

/** fins occupy rows 14..24 either side of the hull; width depends on body. F = fin colour. */
function finRows(fins: RocketConfig['fins'], body: RocketConfig['body']): string[] {
  // returns a 24x32 overlay
  const rows: string[] = Array.from({ length: 32 }, () => '.'.repeat(24));
  const set = (x: number, y: number, ch = 'F') => {
    if (x < 0 || x >= 24 || y < 0 || y >= 32) return;
    const r = rows[y];
    rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
  };
  if (HULL_HAS_WINGS[body]) return rows; // wings are drawn in the hull art; the fin colour still tints them
  const hullL = CLASSIC_HULL_SPAN[body]?.[0] ?? 6;
  const hullR = CLASSIC_HULL_SPAN[body]?.[1] ?? 17;
  if (fins === 'swept') {
    for (let i = 0; i < 8; i++) {
      for (let k = 0; k <= i * 0.6; k++) {
        set(hullL - 1 - k, 15 + i);
        set(hullR + 1 + k, 15 + i);
      }
    }
  } else if (fins === 'box') {
    for (let y = 16; y < 23; y++)
      for (let k = 1; k <= 4; k++) {
        set(hullL - k, y);
        set(hullR + k, y);
      }
  } else {
    for (let i = 0; i < 10; i++) {
      const k = i < 7 ? Math.min(2, Math.floor(i / 3) + 1) : 2;
      for (let j = 1; j <= k; j++) {
        set(hullL - j, 13 + i);
        set(hullR + j, 13 + i);
      }
    }
  }
  return rows;
}

/** engine bells below the hull. E = engine colour, e = engine shade. */
function engineRows(engine: RocketConfig['engine'], body: RocketConfig['body']): string[] {
  const rows: string[] = Array.from({ length: 32 }, () => '.'.repeat(24));
  const set = (x: number, y: number, ch = 'E') => {
    if (x < 0 || x >= 24 || y < 0 || y >= 32) return;
    const r = rows[y];
    rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
  };
  if (HULL_HAS_WINGS[body]) return rows; // nozzles are part of the hull art; the engine colour still tints them
  const cx = body === 'needle' ? 11.5 : 11.5;
  const bells: number[] = engine === 'single' ? [cx] : engine === 'twin' ? [cx - 2.5, cx + 2.5] : [cx];
  const width = engine === 'wide' ? 4 : 2;
  for (const b of bells) {
    for (let y = 23; y < 27; y++) {
      const w = width + (y - 23) * (engine === 'wide' ? 1 : 0.5);
      for (let x = Math.floor(b - w); x <= Math.ceil(b + w); x++) set(x, y, y === 26 ? 'e' : 'E');
    }
  }
  return rows;
}

/** decals painted on the hull only. D = decal colour. */
function decalRows(decal: RocketConfig['decal'], body: RocketConfig['body']): string[] {
  const rows: string[] = Array.from({ length: 32 }, () => '.'.repeat(24));
  const set = (x: number, y: number, ch = 'D') => {
    if (x < 0 || x >= 24 || y < 0 || y >= 32) return;
    const r = rows[y];
    rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
  };
  const hullL = HULL_DECAL_SPAN[body]?.[0] ?? CLASSIC_HULL_SPAN[body]?.[0] ?? 6;
  const hullR = HULL_DECAL_SPAN[body]?.[1] ?? CLASSIC_HULL_SPAN[body]?.[1] ?? 17;
  // on the classic hulls the decals sit below the porthole and the accent band
  const classic = !HULL_HAS_WINGS[body];
  if (decal === 'stripe') {
    for (let y = classic ? 16 : 11; y < 22; y++) set(hullL + 1, y), set(hullL + 2, y);
  } else if (decal === 'ring') {
    const y0 = classic ? 18 : 13;
    for (let x = hullL; x <= hullR; x++) set(x, y0), set(x, y0 + 1);
  } else if (decal === 'number') {
    // a small "7" glyph
    const ox = Math.floor((hullL + hullR) / 2) - 1;
    const y0 = classic ? 17 : 15;
    for (let x = 0; x < 3; x++) set(ox + x, y0);
    set(ox + 2, y0 + 1);
    set(ox + 1, y0 + 2);
    set(ox + 1, y0 + 3);
  }
  return rows;
}

function merge(base: string[], overlay: string[], hullOnly = false): string[] {
  return base.map((row, y) => {
    const o = overlay[y] ?? '';
    let out = '';
    for (let x = 0; x < 24; x++) {
      const b = row[x] ?? '.';
      const c = o[x] ?? '.';
      if (c === '.') out += b;
      else if (hullOnly && b === '.') out += b;
      else out += c;
    }
    return out;
  });
}

/** A one-cell dark outline around everything painted, above the flame rows (the flame stays soft). */
function outline(rows: string[]): string[] {
  const painted = (x: number, y: number) => x >= 0 && x < 24 && y >= 0 && y < 32 && rows[y][x] !== '.';
  return rows.map((row, y) => {
    if (y > 26) return row;
    let out = '';
    for (let x = 0; x < 24; x++) out += row[x] === '.' && (painted(x - 1, y) || painted(x + 1, y) || painted(x, y - 1) || painted(x, y + 1)) ? 'd' : row[x];
    return out;
  });
}

export function rocketRows(cfg: RocketConfig): string[] {
  const body = BODY_ROWS[cfg.body].concat(Array.from({ length: 32 - BODY_ROWS[cfg.body].length }, () => '.'.repeat(24)));
  let rows = merge(body, finRows(cfg.fins, cfg.body));
  rows = merge(rows, engineRows(cfg.engine, cfg.body));
  rows = merge(rows, decalRows(cfg.decal, cfg.body), true);
  return outline(rows);
}

/** Lighter tone for hull highlights per hull colour (all official colours; nothing computed). */
const HULL_HIGHLIGHT: Record<ColorId, string> = {
  cream: OFFICIAL.porcelain, // Icy Blue hull
  starlight: OFFICIAL.frostedMint, // Emerald hull: Frosted Mint highlight
  sky: OFFICIAL.icyBlue, // Dusty Denim hull
  slate: OFFICIAL.icyBlue, // Smart Blue hull
  navy: OFFICIAL.duskBlue, // Prussian Blue hull
  moss: OFFICIAL.oceanMist, // Teal hull
  ochre: OFFICIAL.porcelain, // Cream hull
  rust: OFFICIAL.porcelain, // Electric Aqua hull
};

/** Palette for one rocket: b hull, s hull shade, h hull highlight, w window glass and a accent band (accent colour), v window shade, W window glint, F fins and nose cap, E/e engine, D decal, d dark metal and outline. */
export function rocketPalette(cfg: RocketConfig): Record<string, string> {
  const k = rocketColors(cfg);
  const body = COLOR_BY_ID[k.body];
  const accent = COLOR_BY_ID[k.accent];
  const fins = COLOR_BY_ID[k.fins];
  const engine = COLOR_BY_ID[k.engine];
  const decal = COLOR_BY_ID[k.decal];
  return { b: body.hex, s: body.shade, h: HULL_HIGHLIGHT[k.body], w: accent.hex, a: accent.hex, v: accent.shade, W: OFFICIAL.porcelain, F: fins.hex, E: engine.hex, e: engine.shade, D: decal.hex, d: PALETTE.space };
}

/** Column spans [first, last] of the nozzles on row 26, per hull; flames start directly under them. */
const NOZZLE_SPANS: Record<RocketConfig['body'], Array<[number, number]>> = {
  stub: [[9, 14]],
  needle: [[9, 14]],
  barrel: [[9, 14]],
  delta: [[8, 10], [13, 15]],
  cruiser: [[7, 9], [14, 16]],
  interceptor: [[9, 13]],
  hauler: [[4, 6], [8, 10], [13, 15], [17, 19]],
  lancer: [[0, 2], [5, 7], [16, 18], [21, 23]],
};

/** Flame spans for a config: one per nozzle. Exported for tests. */
export function flameSpans(cfg: RocketConfig): Array<[number, number]> {
  return NOZZLE_SPANS[cfg.body];
}

export function drawRocket(cfg: RocketConfig, scale = 4, flame = 0): HTMLCanvasElement {
  const c = new PixelCanvas(24, 32, scale);
  c.glyph(0, 0, rocketRows(cfg), rocketPalette(cfg));
  if (flame > 0) {
    const fy = 27;
    const len = flame === 1 ? 3 : 5;
    for (const [x0, x1] of flameSpans(cfg)) {
      for (let i = 0; i < len; i++) {
        // each flame narrows by one cell per side every two rows, never thinner than one cell;
        // Apricot Cream rim, Cream inside, a Porcelain core in the upper rows (47.6 engine warmth, small, not neon)
        const inset = Math.min(Math.floor(i / 2), Math.floor((x1 - x0) / 2));
        const l = x0 + inset;
        const r = x1 - inset;
        for (let x = l; x <= r; x++) {
          const rim = x === l || x === r;
          const second = x === l + 1 || x === r - 1;
          c.set(x, fy + i, rim ? PALETTE.sunlitAmber : second || i >= len - 2 ? PALETTE.solarGold : PALETTE.ice);
        }
      }
    }
  }
  return c.canvas;
}

export function rocketDataUrl(cfg: RocketConfig, scale = 4): string {
  return drawRocket(cfg, scale).toDataURL();
}

// ---------------------------------------------------------------- planets
/**
 * Planets follow the supplied pixel-art reference sheets: light from the upper left, a hard,
 * stepped terminator with roughly a third of the disc in shadow, diagonal bands (or blotted
 * continents) that carry on into the shadow, thin one-pixel highlight streaks, rings drawn as a
 * tilted belt of scattered debris that passes in front of the sphere, a dark halo of thin
 * atmosphere around ringed worlds with pale cloud puffs drifting off the limb, and small grey
 * moons. Every colour is the planet's official ramp (shadow, base, light, highlight), its deep
 * ground tone, or an official grey; nothing is blended or computed.
 */
type Surface = 'bands' | 'blots' | 'frost';
const SURFACE: Record<Biome, Surface> = {
  'salt flats': 'frost',
  'ash plains': 'bands',
  'ice shelf': 'frost',
  'moss basin': 'blots',
  'rust desert': 'bands',
  'shallow sea': 'blots',
  'fungal steppe': 'bands',
  'cinder field': 'bands',
  'clay canyon': 'bands',
  'frozen bog': 'blots',
};

type Pat = -1 | 0 | 1;
const SPACE_DARKS = new Set<string>([OFFICIAL.inkBlack, OFFICIAL.prussianBlue, OFFICIAL.prussianDeep, OFFICIAL.prussianBlue2, OFFICIAL.prussianBlue3]);
interface Band {
  start: number;
  end: number;
  pat: Pat;
}
interface Bit {
  x: number;
  y: number;
  front: boolean;
  tone: number; // index into the debris tones: dark rock, grey rock, planet dust, bright dust, sunlit
}
interface Moon {
  x: number;
  y: number;
  r: number;
}

/** Irregular band widths across the disc; each band lifts, keeps or drops the local tone one step. */
function makeBands(rng: Rng, r: number): Band[] {
  const bands: Band[] = [];
  let v = -r - 3;
  while (v <= r + 3) {
    const end = v + rng.int(2, Math.max(3, Math.round(r / 2.2)));
    bands.push({ start: v, end, pat: rng.weighted<Pat>([[0, 46], [1, 32], [-1, 22]]) });
    v = end;
  }
  return bands;
}

function bandAt(bands: Band[], v: number): Band {
  for (const b of bands) if (v < b.end) return b;
  return bands[bands.length - 1];
}

/** A ring as a tilted belt of scattered debris, densest along its inner edge. */
function makeBelt(rng: Rng, r: number): { tilt: number; bits: Bit[] } {
  const tilt = rng.range(-0.5, -0.2);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const bits: Bit[] = [];
  const count = Math.round(r * r * 3.2);
  for (let i = 0; i < count; i++) {
    const t = rng.range(0, Math.PI * 2);
    const rad = r * (1.12 + Math.pow(rng.next(), 1.3) * 1.0);
    const ex = rad * Math.cos(t);
    const ey = rad * Math.sin(t) * 0.36;
    const big = rng.chance(0.26);
    const bit: Bit = {
      x: Math.round(ex * ct - ey * st),
      y: Math.round(ex * st + ey * ct),
      front: ey > 0,
      tone: rng.weighted([
        [0, 30],
        [1, 34],
        [2, 16],
        [3, 12],
        [4, 8],
      ]),
    };
    bits.push(bit);
    if (big) bits.push({ ...bit, x: bit.x + 1 }, { ...bit, y: bit.y + 1 }, { ...bit, x: bit.x + 1, y: bit.y + 1 }); // a 2 by 2 chunk
  }
  return { tilt, bits };
}

function makeMoons(rng: Rng, r: number, count: number, beltTilt: number | null): Moon[] {
  const moons: Moon[] = [];
  if (r < 8) return moons; // too small to read as anything but a dot
  for (let m = 0; m < count; m++) {
    // with a belt the moons sit above or below its plane, clear of the debris
    const ang = beltTilt === null ? rng.range(0, Math.PI * 2) : beltTilt + (m % 2 === 0 ? -Math.PI / 2 : Math.PI / 2) + rng.range(-0.45, 0.45);
    const dist = r * (1.28 + m * 0.18);
    moons.push({ x: Math.round(Math.cos(ang) * dist), y: Math.round(Math.sin(ang) * dist), r: Math.max(1, Math.round(r * 0.16)) });
  }
  return moons;
}

function drawBelt(c: PixelCanvas, cx: number, cy: number, r: number, bits: Bit[], half: 'back' | 'front', tones: string[], deep: string): void {
  for (const b of bits) {
    if (b.front !== (half === 'front')) continue;
    const overFace = b.x * b.x + b.y * b.y <= r * r;
    if (overFace && half === 'back') continue;
    // debris crossing the face is seen against the lit sphere: dark rock, only the brightest bits keep their colour
    c.set(cx + b.x, cy + b.y, overFace && b.tone < 3 ? deep : tones[b.tone]);
  }
}

/** Pale cloud puffs on the lit limb of a ringed world, spilling a little past the edge (first reference sheet). */
function drawClouds(c: PixelCanvas, cx: number, cy: number, r: number, rng: Rng, lx: number, ly: number): void {
  const puffs = rng.int(1, 2);
  for (let i = 0; i < puffs; i++) {
    // on the lit side, near the limb
    const ang = Math.atan2(ly, lx) + rng.range(-0.9, 0.9) + (i === 1 ? Math.PI * 0.5 : 0);
    const px = Math.round(Math.cos(ang) * r * 0.92);
    const py = Math.round(Math.sin(ang) * r * 0.92);
    const w = Math.max(3, Math.round(r * rng.range(0.32, 0.5)));
    const h = Math.max(2, Math.round(w * 0.5));
    for (let y = -h; y <= h; y++)
      for (let x = -w; x <= w; x++) {
        const e = (x * x) / (w * w) + (y * y) / (h * h);
        if (e > 1) continue;
        if (hashNoise(x, y, rng.seed + i) > 0.86 && e > 0.55) continue; // ragged edge
        c.set(cx + px + x, cy + py + y, y < 0 || e < 0.45 ? OFFICIAL.porcelain : OFFICIAL.dustGrey);
      }
  }
}

function drawMoon(c: PixelCanvas, cx: number, cy: number, r: number, lx: number, ly: number): void {
  if (r <= 1) {
    // a two by two block: three lit cells, one in shadow
    c.rect(cx, cy, 2, 2, OFFICIAL.dustGrey);
    c.set(cx + (lx < 0 ? 1 : 0), cy + (ly < 0 ? 1 : 0), OFFICIAL.slateGrey);
    return;
  }
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + r * 0.5) continue;
      const lit = (x * lx + y * ly) / r + 0.35;
      c.set(cx + x, cy + y, lit >= 0 ? OFFICIAL.dustGrey : OFFICIAL.slateGrey);
    }
}

export function drawPlanet(planet: Planet, chunk = 2, radiusOverride?: number): HTMLCanvasElement {
  const r = Math.max(4, Math.round((radiusOverride ?? planet.radius) / chunk));
  const pad = planet.ring ? r + 2 : planet.moons > 0 && r >= 8 ? Math.ceil(r * 0.8) : 2;
  const size = (r + pad) * 2 + 1;
  const c = new PixelCanvas(size, size, chunk);
  const cx = r + pad;
  const cy = cx;
  const rng = new Rng(seedFrom(planet.seed, 'art'));
  const ramp = planet.palette.ramp;
  const deep = planet.palette.ground;
  // Night side. On the reference sheets the shadow is a distinct dark tone with the bands still
  // showing through, never the colour of space. Ramps whose shadow step is one of the deep space
  // blues would vanish into the page, panel or map background, so those planets take the slate
  // hierarchy for their night side instead (dark band, base, light band).
  const spaceDark = SPACE_DARKS.has(ramp[0]);
  const night: [string, string, string] = spaceDark ? [ramp[0], OFFICIAL.twilightIndigo, OFFICIAL.blueSlate] : [deep, ramp[0], ramp[1]];
  // light from the upper left, as on the reference sheets; lz sets how much of the disc is in
  // shadow (about a third)
  const la = -Math.PI * 0.75 + rng.range(-0.3, 0.3);
  const lz = 0.34;
  const lx = Math.cos(la) * Math.sqrt(1 - lz * lz);
  const ly = Math.sin(la) * Math.sqrt(1 - lz * lz);
  // bands rise to the right
  const tilt = rng.range(-0.6, -0.25);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const bands = makeBands(rng, r);
  const surface = SURFACE[planet.biome];
  const belt = planet.ring ? makeBelt(rng, r) : null;
  const moons = makeMoons(rng, r, planet.moons, belt ? belt.tilt : null);
  const tones = [OFFICIAL.twilightIndigo, OFFICIAL.blueSlate, ramp[1], ramp[2], PALETTE.sunlitAmber]; // dark rock, grey rock, planet dust, bright dust, a few sunlit bits
  const seed = rng.seed;

  if (belt) {
    // a dark halo of thin atmosphere around the sphere, as on the ringed reference planet
    c.disc(cx, cy, r + 2, OFFICIAL.twilightIndigo);
    c.disc(cx, cy, r + 1, OFFICIAL.prussianBlue);
    drawBelt(c, cx, cy, r, belt.bits, 'back', tones, deep);
  }
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r + r * 0.5) continue;
      const nx = x / r;
      const ny = y / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // the terminator steps in short horizontal runs instead of a smooth curve
      const lit = nx * lx + ny * ly + nz * lz + (hashNoise(y >> 1, x >> 3, seed + 3) - 0.5) * 0.14;
      const zone = lit < 0 ? 0 : lit < 0.7 ? 1 : 2; // shadow, base, light
      // band coordinates: u along the bands, v across them; band edges step sideways in short runs
      const u = x * ct + y * st;
      const v0 = y * ct - x * st;
      const v = v0 + (hashNoise(Math.floor(u / 3), Math.floor(v0 / 4), seed + 4) - 0.5) * 1.8;
      let pat = 0;
      let streak = 0;
      if (surface === 'blots') {
        // continents: a few large masses with ragged coasts, the odd bright patch inland
        const n = hashNoise(x >> 3, y >> 3, seed + 5) * 0.55 + hashNoise(x >> 2, y >> 2, seed + 6) * 0.3 + hashNoise(x >> 1, y >> 1, seed + 9) * 0.15;
        pat = n > 0.66 ? 2 : n > 0.5 ? 1 : n < 0.3 ? -1 : 0;
      } else {
        const band = bandAt(bands, v);
        pat = band.pat;
        // a one-pixel bright line along the top edge of each lighter band
        if (pat > 0 && v - band.start < 1 && hashNoise(Math.floor(u / 4), 0, seed + 8) > 0.35) streak = 1;
        if (surface === 'frost') {
          if (pat < 0) pat = 0;
          if (hashNoise(x, y, seed + 7) > 0.92) pat = 1;
        }
      }
      if (zone === 0) {
        // shadow side: the pattern carries on in the night tones
        c.set(cx + x, cy + y, night[pat < 0 ? 0 : pat > 0 ? 2 : 1]);
      } else {
        // lit side: never darker than the base tone, so dark bands only show against the light zone
        c.set(cx + x, cy + y, ramp[Math.max(1, Math.min(3, zone + pat + streak))]);
      }
    }
  }
  c.ring(cx, cy, r, deep); // official deep tone, no computed shade
  if (belt) {
    if (r >= 8) drawClouds(c, cx, cy, r, rng.child('clouds'), lx, ly);
    drawBelt(c, cx, cy, r, belt.bits, 'front', tones, deep);
  }
  for (const m of moons) drawMoon(c, cx + m.x, cy + m.y, m.r, lx, ly);
  return c.canvas;
}

export function planetDataUrl(planet: Planet, chunk = 2, radius?: number): string {
  return drawPlanet(planet, chunk, radius).toDataURL();
}

export function drawStar(color: string, radius: number, chunk = 2): HTMLCanvasElement {
  const r = Math.round(radius / chunk);
  const size = r * 2 + 9;
  const c = new PixelCanvas(size, size, chunk);
  const cx = Math.floor(size / 2);
  // 47.15: warm light belongs to stars. Warm stars have a Lemon Chiffon interior; the blue giant
  // and the white star keep a Porcelain core. The rim is the darkest official blue, never a computed shade.
  const core = color === PALETTE.sky || color === PALETTE.ice ? PALETTE.ice : PALETTE.warmCream;
  c.disc(cx, cx, r + 2, OFFICIAL.prussianBlue3);
  c.disc(cx, cx, r, color);
  c.disc(cx - Math.round(r * 0.25), cx - Math.round(r * 0.25), Math.round(r * 0.4), core);
  for (let i = 1; i <= 3; i++) {
    c.set(cx, cx - r - 1 - i, color);
    c.set(cx, cx + r + 1 + i, color);
    c.set(cx - r - 1 - i, cx, color);
    c.set(cx + r + 1 + i, cx, color);
  }
  return c.canvas;
}

// ---------------------------------------------------------------- site / resource icons (12 x 12)
const SITE_ART: Record<SiteKind, { rows: string[]; map: Record<string, string> }> = {
  formation: {
    rows: ['............', '.....a......', '....aa......', '....aa..a...', '...aaa..a...', '...aaa.aa...', '..aaaa.aa...', '..aaaaaaa...', '.aaaaaaaaa..', '.aaaaaaaaa..', 'aaaaaaaaaaa.', '............'],
    map: { a: OFFICIAL.dustyDenim },
  },
  ruin: {
    rows: ['............', '.....a......', '....aaa.....', '...aaaaa....', '..aaaaaaa...', '..a.aaa.a...', '..a.aaa.a...', '..aaa.aaa...', '..aaa.aaa...', '..aaa.aaa...', '.aaaaaaaaa..', '............'],
    map: { a: PALETTE.ice },
  },
  signal: {
    rows: ['............', '...c.....c..', '..c.......c.', '.c...ccc...c', '.c..c...c..c', '.c..c.a.c..c', '.c..c...c..c', '.c...ccc...c', '..c.......c.', '...c.....c..', '............', '............'],
    map: { c: PALETTE.sky, a: PALETTE.celestialCyan },
  },
  flora: {
    rows: ['............', '.....g......', '....ggg.....', '...ggggg....', '..gg.g.gg...', '.....g......', '..g..g..g...', '...g.g.g....', '....ggg.....', '.....g......', '....ddd.....', '............'],
    map: { g: OFFICIAL.lightGreen, d: OFFICIAL.emerald }, // 47.3 vegetation
  },
  creature: {
    rows: ['............', '............', '...pppppp...', '..pppppppp..', '.ppwwppwwpp.', '.ppwkppwkpp.', '.pppppppppp.', '.ppppppppp..', '..pp.pp.pp..', '..p..p..p...', '............', '............'],
    map: { p: PALETTE.sunlitAmber, w: PALETTE.starlight, k: PALETTE.void },
  },
  anomaly: {
    rows: ['............', '.....l......', '....lll.....', '...ll.ll....', '..ll...ll...', '.ll..w..ll..', '..ll...ll...', '...ll.ll....', '....lll.....', '.....l......', '............', '............'],
    map: { l: PALETTE.celestialCyan, w: PALETTE.starlight },
  },
};

export function drawSite(kind: SiteKind, scale = 2): HTMLCanvasElement {
  const c = new PixelCanvas(12, 12, scale);
  c.glyph(0, 0, SITE_ART[kind].rows, SITE_ART[kind].map);
  return c.canvas;
}

const RESOURCE_ART: Record<'common' | 'rare' | 'exotic', { rows: string[]; map: Record<string, string> }> = {
  common: {
    rows: ['............', '............', '............', '....aaaa....', '...aaaaaa...', '..aaawaaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '...aaaaaa...', '....aaaa....', '............', '............'],
    map: { a: RARITY_COLOR.common, w: PALETTE.ice }, // --discovery-common
  },
  rare: {
    rows: ['............', '......c.....', '.....ccc....', '....ccwcc...', '...ccwwccc..', '..cccwcccc..', '..cccccccc..', '...cccccc...', '....cccc....', '.....cc.....', '............', '............'],
    map: { c: RARITY_COLOR.rare, w: PALETTE.ice }, // --discovery-rare
  },
  exotic: {
    rows: ['............', '.....oo.....', '....oooo....', '...oowwoo...', '..oowwwwoo..', '..oowwwwoo..', '..ooowwooo..', '...oooooo...', '....oooo....', '.....oo.....', '............', '............'],
    map: { o: RARITY_COLOR.exotic, w: PALETTE.ice }, // --discovery-exceptional
  },
};

export function drawResource(tier: 'common' | 'rare' | 'exotic', scale = 2): HTMLCanvasElement {
  const c = new PixelCanvas(12, 12, scale);
  c.glyph(0, 0, RESOURCE_ART[tier].rows, RESOURCE_ART[tier].map);
  return c.canvas;
}

// ---------------------------------------------------------------- explorer on foot (8 x 12), 2 walk frames
// h helmet (secondary), v visor, p suit primary, q suit secondary (belt, gloves, boots), k pack, o outline
const EXPLORER = [
  ['..hhhh..', '.hhhhhh.', '.hvvvvh.', '.hvvvvh.', '.hhhhhh.', 'k.qppq.k', 'kpppppp.', 'kpppppp.', '..qqqq..', '..pppp..', '..q..q..', '..q..q..'],
  ['..hhhh..', '.hhhhhh.', '.hvvvvh.', '.hvvvvh.', '.hhhhhh.', 'k.qppq.k', 'kpppppp.', 'kpppppp.', '..qqqq..', '..pppp..', '.q....q.', '.q....q.'],
];

/** Palette for one astronaut. Visor gets a single highlight pixel so it reads as glass. */
export function suitPalette(suit: SuitConfig): Record<string, string> {
  return {
    h: COLOR_BY_ID[suit.secondary].hex,
    v: COLOR_BY_ID[suit.visor].hex,
    p: COLOR_BY_ID[suit.primary].hex,
    q: COLOR_BY_ID[suit.secondary].shade,
    k: COLOR_BY_ID[suit.pack].hex,
  };
}

export function drawExplorer(suit: SuitConfig, frame: 0 | 1, scale = 3): HTMLCanvasElement {
  const c = new PixelCanvas(8, 12, scale);
  c.glyph(0, 0, EXPLORER[frame], suitPalette(suit));
  c.set(2, 2, OFFICIAL.porcelain); // visor glint: Porcelain, never a computed tint
  return c.canvas;
}

/**
 * Nameplate (section 45.5): compact pixel-framed label drawn above a player. Shared by the system
 * map, the planet surface and the customization preview so it always looks the same.
 * `bottomY` is where the plate's bottom edge sits (just above the sprite).
 */
/**
 * Canvas text uses the same pixel display family as the DOM (the CSS variable set by next/font on
 * <html>), so player names and HUD counters on the maps match the rest of the interface. Falls
 * back to a generic monospace before the font has loaded or off the DOM (tests).
 */
export function canvasFont(px: number, weight = 500): string {
  let family = 'monospace';
  if (typeof document !== 'undefined') {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim();
    if (v) family = `${v}, monospace`;
  }
  return `${weight} ${px}px ${family}`;
}

export function drawNameplate(ctx: CanvasRenderingContext2D, text: string, cx: number, bottomY: number, opts: { px?: number; color?: string } = {}): void {
  const px = opts.px ?? 8;
  const pad = Math.max(2, Math.round(px / 3));
  const frame = px >= 10 ? 2 : 1;
  const label = text.toUpperCase().slice(0, 20);
  ctx.save();
  ctx.font = canvasFont(px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.ceil(ctx.measureText(label).width) + pad * 2 + 2;
  const h = px + pad * 2;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottomY - h);
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.deepNavy;
  ctx.fillRect(x, y, w, frame);
  ctx.fillRect(x, y + h - frame, w, frame);
  ctx.fillRect(x, y, frame, h);
  ctx.fillRect(x + w - frame, y, frame, h);
  ctx.fillStyle = opts.color ?? PALETTE.starlight;
  ctx.fillText(label, Math.round(cx), Math.round(y + h / 2) + 1);
  ctx.restore();
}

// ---------------------------------------------------------------- terrain tiles (8 x 8), 4 variants per planet
export function drawTerrainTiles(planet: Planet, scale = 4): HTMLCanvasElement[] {
  // 47.9 / 47.15: the walkable surface is the largest area on screen, so it is built from the
  // palette's official deep ground tone with the ramp's shadow and base tones as specks and
  // features. Bright official colours stay as light on the ground, never as the ground itself,
  // which keeps the blue foundation dominant and lets the rocket, astronaut and other players read.
  const [c0, c1, c2] = planet.palette.ramp;
  const ground = planet.palette.ground;
  const tiles: HTMLCanvasElement[] = [];
  for (let v = 0; v < 4; v++) {
    const c = new PixelCanvas(8, 8, scale);
    const rng = new Rng(seedFrom(planet.seed, 'tile', v));
    c.rect(0, 0, 8, 8, ground);
    const specks = rng.int(2, 5);
    for (let i = 0; i < specks; i++) c.set(rng.int(0, 7), rng.int(0, 7), rng.chance(0.7) ? c0 : c1);
    if (v === 3) {
      // a "feature" tile: a small rock / crack / puddle depending on biome
      c.rect(2, 4, 4, 2, c0);
      c.rect(3, 3, 2, 1, c1);
      c.set(4, 3, c2);
    }
    tiles.push(c.canvas);
  }
  return tiles;
}

/** Earth, 24 x 24. Used once on the landing page. */
/** The supplied 62 x 62 Earth artwork (landing page status block). `scale` is an integer. */
export function drawEarthArt(scale = 1): HTMLCanvasElement {
  const c = new PixelCanvas(EARTH_ART_SIZE, EARTH_ART_SIZE, scale);
  c.glyph(0, 0, EARTH_ART_ROWS, EARTH_ART_MAP);
  return c.canvas;
}

/** The explorer icon (About page and anywhere a person, not a ship, is the subject). Integer `scale`. */
export function drawAstronautIcon(scale = 2): HTMLCanvasElement {
  const c = new PixelCanvas(ASTRONAUT_ICON_W, ASTRONAUT_ICON_H, scale);
  c.glyph(0, 0, ASTRONAUT_ICON_ROWS, ASTRONAUT_ICON_MAP);
  return c.canvas;
}

/** The homescreen rocket (hero-rocket-art.ts), drawn at an integer scale. */
export function drawHeroRocket(scale = 2): HTMLCanvasElement {
  const c = new PixelCanvas(HERO_ROCKET_W, HERO_ROCKET_H, scale);
  c.glyph(0, 0, HERO_ROCKET_ROWS, HERO_ROCKET_MAP);
  return c.canvas;
}

export function drawEarth(scale = 3): HTMLCanvasElement {
  const c = new PixelCanvas(24, 24, scale);
  c.disc(12, 12, 10, OFFICIAL.balticBlue); // 47.3 ocean
  for (let y = 2; y <= 22; y++)
    for (let x = 2; x <= 22; x++) {
      if ((x - 12) ** 2 + (y - 12) ** 2 > 100) continue;
      const n = hashNoise(x >> 1, y >> 1, 4242);
      if (n > 0.62) c.set(x, y, OFFICIAL.lightGreen); // sunlit land
      else if (n > 0.58) c.set(x, y, OFFICIAL.emerald); // land
      if (hashNoise(x, y, 99) > 0.92) c.set(x, y, OFFICIAL.icyBlue); // cloud
    }
  c.ring(12, 12, 10, OFFICIAL.regalNavy);
  return c.canvas;
}
