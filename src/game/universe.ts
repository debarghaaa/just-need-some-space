/**
 * Deterministic universe generation.
 *
 *   galaxy seed -> star system (index) -> planet (index) -> site (index) / resource (index)
 *
 * Nothing generated here is stored. Only player-generated state (discoveries, inventory,
 * points, presence) is persisted in Supabase. The MVP exposes a finite window of the galaxy
 * (MVP_SYSTEM_COUNT systems) but every generator takes an arbitrary index, so widening the
 * window later is a one-line change.
 *
 * Object ids are stable and self-describing:  "system:3"  "planet:3:1"  "site:3:1:2"
 */
import { Rng, seedFrom } from './rng';
import { OFFICIAL, STAR_COLOR } from './palette';

export const MVP_SYSTEM_COUNT = 5;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'exotic';
export type ResourceTier = 'common' | 'rare' | 'exotic';
export type StarClass = 'red dwarf' | 'orange dwarf' | 'yellow dwarf' | 'white star' | 'blue giant';

export type Biome =
  | 'salt flats'
  | 'ash plains'
  | 'ice shelf'
  | 'moss basin'
  | 'rust desert'
  | 'shallow sea'
  | 'fungal steppe'
  | 'cinder field'
  | 'clay canyon'
  | 'frozen bog';

export type SiteKind = 'formation' | 'ruin' | 'signal' | 'flora' | 'creature' | 'anomaly';

export interface Palette {
  /** 4-step ramp, shadow -> base -> light -> highlight. Official colours only (47.13 / 47.14). */
  ramp: [string, string, string, string];
  /** deep official tone for the walkable surface and the sphere outline */
  ground: string;
  /** official deep blue behind the planet */
  sky: string;
}

export interface ResourceDef {
  id: string; // stable slug, e.g. "iron-grit"
  name: string;
  tier: ResourceTier;
}

export interface ResourceNode {
  id: string; // "res:<sys>:<planet>:<idx>"
  index: number;
  resource: ResourceDef;
  /** tile position inside the planet's play area */
  tx: number;
  ty: number;
  amount: number;
}

export interface Site {
  id: string; // "site:<sys>:<planet>:<idx>"
  index: number;
  kind: SiteKind;
  name: string;
  rarity: Rarity;
  tx: number;
  ty: number;
}

export interface Planet {
  id: string; // "planet:<sys>:<idx>"
  systemId: string;
  index: number;
  seed: number;
  name: string;
  biome: Biome;
  atmosphere: string;
  gravity: number; // g
  temperature: number; // celsius
  rarity: Rarity;
  palette: Palette;
  radius: number; // px at 1x
  orbitRadius: number;
  orbitPhase: number;
  ring: boolean;
  moons: number;
  hazards: string[];
  resourceTypes: ResourceDef[];
  /** play area size in tiles */
  areaW: number;
  areaH: number;
  sites: Site[];
  nodes: ResourceNode[];
}

export interface StarSystem {
  id: string; // "system:<idx>"
  index: number;
  seed: number;
  name: string;
  starClass: StarClass;
  starColor: string;
  starRadius: number;
  /** position on the galaxy map, 0..1 */
  mapX: number;
  mapY: number;
  planets: Planet[];
}

export interface Galaxy {
  seed: string;
  systems: StarSystem[];
}

// ---------------------------------------------------------------- names

const SYL_A = ['ka', 'ver', 'lo', 'mi', 'tor', 'esh', 'ny', 'ol', 'ra', 'sul', 'te', 'quo', 'ha', 'be', 'ith', 'mor'];
const SYL_B = ['ren', 'da', 'vin', 'ma', 'lis', 'ko', 'thu', 'ne', 'ph', 'ra', 'ss', 'wen', 'ty', 'lo'];
const SYSTEM_WORDS = ['Kestrel', 'Tallow', 'Orrin', 'Vesper', 'Halden', 'Sable', 'Marrow', 'Quill', 'Lantern', 'Fennel', 'Cobalt', 'Wren'];

function properCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function planetName(rng: Rng, systemIndex: number, planetIndex: number): string {
  const base = properCase(rng.pick(SYL_A) + rng.pick(SYL_B));
  return `${base} ${romanNumeral(planetIndex + 1)}`;
}

function romanNumeral(n: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n - 1] ?? String(n);
}

function systemName(rng: Rng, index: number): string {
  const word = rng.pick(SYSTEM_WORDS);
  const num = 11 + ((index * 37 + rng.int(0, 9)) % 80);
  return `${word} ${num}`;
}

// ---------------------------------------------------------------- palette (official colour system 47.13: deliberate planet palettes, no rainbows)

/**
 * Each biome draws from one of the spec's planet archetypes (ocean, forest, ice, desert, flower,
 * twilight, strange alien) plus two quiet grey-blue worlds. `ramp` is shadow -> base -> light ->
 * highlight, `ground` is the deep official tone the walkable surface and sphere outline are built
 * from, `sky` is the official deep blue behind the planet. Every value is an official colour.
 */
const BIOME_TABLE: Record<
  Biome,
  {
    palettes: Palette[];
    atmospheres: string[];
    gravity: [number, number];
    temperature: [number, number];
    hazards: string[];
    resources: ResourceDef[];
  }
> = {
  'salt flats': {
    // ice archetype with Dust Grey crust
    palettes: [
      { ramp: [OFFICIAL.inkBlack, OFFICIAL.duskBlue, OFFICIAL.dustGrey, OFFICIAL.porcelain], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue2 },
      { ramp: [OFFICIAL.prussianBlue, OFFICIAL.blueSlate, OFFICIAL.lightBlue, OFFICIAL.porcelain], ground: OFFICIAL.inkBlack, sky: OFFICIAL.prussianBlue3 },
    ],
    atmospheres: ['thin', 'dry', 'still'],
    gravity: [0.7, 1.1],
    temperature: [10, 48],
    hazards: ['glare', 'dust devils'],
    resources: [
      { id: 'salt-crust', name: 'Salt Crust', tier: 'common' },
      { id: 'mirror-sand', name: 'Mirror Sand', tier: 'rare' },
      { id: 'still-water', name: 'Still Water', tier: 'exotic' },
    ],
  },
  'ash plains': {
    // the supporting slate hierarchy, used as an environment: quiet grey-blue worlds
    palettes: [
      { ramp: [OFFICIAL.inkBlack, OFFICIAL.twilightIndigo, OFFICIAL.blueSlate, OFFICIAL.slateGrey], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.inkBlack },
      { ramp: [OFFICIAL.prussianBlue3, OFFICIAL.prussianBlue, OFFICIAL.duskBlue, OFFICIAL.dustyDenim], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue3 },
    ],
    atmospheres: ['smoky', 'heavy', 'grey'],
    gravity: [0.9, 1.5],
    temperature: [-5, 30],
    hazards: ['ash fall'],
    resources: [
      { id: 'iron-grit', name: 'Iron Grit', tier: 'common' },
      { id: 'char-glass', name: 'Char Glass', tier: 'rare' },
      { id: 'old-machinery', name: 'Old Machinery', tier: 'exotic' },
    ],
  },
  'ice shelf': {
    // ice planet: Ink Black, Prussian Blue, Baby Blue Ice, Icy Blue, Porcelain
    palettes: [
      { ramp: [OFFICIAL.inkBlack, OFFICIAL.prussianBlue, OFFICIAL.babyBlueIce, OFFICIAL.icyBlue], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue3 },
      { ramp: [OFFICIAL.prussianBlue, OFFICIAL.babyBlueIce, OFFICIAL.icyBlue, OFFICIAL.porcelain], ground: OFFICIAL.inkBlack, sky: OFFICIAL.inkBlack },
    ],
    atmospheres: ['frozen', 'crystalline', 'none'],
    gravity: [0.4, 0.9],
    temperature: [-140, -40],
    hazards: ['thin ice', 'whiteout'],
    resources: [
      { id: 'methane-ice', name: 'Methane Ice', tier: 'common' },
      { id: 'frozen-spores', name: 'Frozen Spores', tier: 'rare' },
      { id: 'quiet-core', name: 'Quiet Core', tier: 'exotic' },
    ],
  },
  'moss basin': {
    // forest planet (Regal Navy, Emerald, Light Green, Tea Green) and flower planet (Regal Navy, Emerald, Baby Pink, Frosted Mint)
    palettes: [
      { ramp: [OFFICIAL.regalNavy, OFFICIAL.emerald, OFFICIAL.lightGreen, OFFICIAL.teaGreen], ground: OFFICIAL.yaleBlue, sky: OFFICIAL.prussianBlue2 },
      { ramp: [OFFICIAL.regalNavy, OFFICIAL.emerald, OFFICIAL.babyPink, OFFICIAL.frostedMint], ground: OFFICIAL.yaleBlue, sky: OFFICIAL.prussianBlue2 },
    ],
    atmospheres: ['damp', 'thick', 'sweet'],
    gravity: [0.8, 1.2],
    temperature: [8, 26],
    hazards: ['spore drift'],
    resources: [
      { id: 'peat', name: 'Peat', tier: 'common' },
      { id: 'humming-root', name: 'Humming Root', tier: 'rare' },
      { id: 'lantern-sap', name: 'Lantern Sap', tier: 'exotic' },
    ],
  },
  'rust desert': {
    // desert planet: Prussian Blue, Petal Rouge, Apricot Cream, Cream, Dust Grey
    palettes: [
      { ramp: [OFFICIAL.prussianBlue, OFFICIAL.petalRouge, OFFICIAL.apricotCream, OFFICIAL.cream], ground: OFFICIAL.inkBlack, sky: OFFICIAL.prussianBlue2 },
      { ramp: [OFFICIAL.prussianBlue, OFFICIAL.petalRouge, OFFICIAL.dustGrey, OFFICIAL.cream], ground: OFFICIAL.inkBlack, sky: OFFICIAL.prussianBlue2 },
    ],
    atmospheres: ['dry', 'windy', 'thin'],
    gravity: [0.6, 1.0],
    temperature: [-20, 60],
    hazards: ['sandstorm'],
    resources: [
      { id: 'red-ore', name: 'Red Ore', tier: 'common' },
      { id: 'sun-quartz', name: 'Sun Quartz', tier: 'rare' },
      { id: 'fossil-battery', name: 'Fossil Battery', tier: 'exotic' },
    ],
  },
  'shallow sea': {
    // ocean planet: Prussian Blue 3, Baltic Blue, Cerulean, Ocean Mist, Icy Aqua (47.14 ocean ramp)
    palettes: [
      { ramp: [OFFICIAL.prussianBlue3, OFFICIAL.balticBlue, OFFICIAL.cerulean, OFFICIAL.oceanMist], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue2 },
      { ramp: [OFFICIAL.yaleBlue, OFFICIAL.bondiBlue, OFFICIAL.tropicalTeal, OFFICIAL.icyAqua], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue3 },
    ],
    atmospheres: ['humid', 'stormy', 'salt haze'],
    gravity: [0.8, 1.3],
    temperature: [2, 34],
    hazards: ['rip current'],
    resources: [
      { id: 'brine', name: 'Brine', tier: 'common' },
      { id: 'kelp-glass', name: 'Kelp Glass', tier: 'rare' },
      { id: 'deep-echo', name: 'Deep Echo', tier: 'exotic' },
    ],
  },
  'fungal steppe': {
    // strange alien planet: Regal Navy, Tropical Teal, Electric Aqua, Mauve, Lemon Chiffon (Mauve is the occasional accent)
    palettes: [
      { ramp: [OFFICIAL.regalNavy, OFFICIAL.tropicalTeal, OFFICIAL.electricAqua, OFFICIAL.lemonChiffon], ground: OFFICIAL.yaleBlue, sky: OFFICIAL.prussianBlue2 },
      { ramp: [OFFICIAL.regalNavy, OFFICIAL.tropicalTeal, OFFICIAL.mauve, OFFICIAL.lemonChiffon], ground: OFFICIAL.yaleBlue, sky: OFFICIAL.prussianBlue3 },
    ],
    atmospheres: ['thick', 'musty'],
    gravity: [0.7, 1.1],
    temperature: [12, 32],
    hazards: ['spore drift', 'soft ground'],
    resources: [
      { id: 'spore-cap', name: 'Spore Cap', tier: 'common' },
      { id: 'amber-mycelium', name: 'Amber Mycelium', tier: 'rare' },
      { id: 'thinking-mold', name: 'Thinking Mold', tier: 'exotic' },
    ],
  },
  'cinder field': {
    // warm ramp (47.14): heat is energy, so the lit side burns Petal Rouge -> Apricot -> Cream
    palettes: [
      { ramp: [OFFICIAL.inkBlack, OFFICIAL.petalRouge, OFFICIAL.apricotCream, OFFICIAL.cream], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.inkBlack },
    ],
    atmospheres: ['scorched', 'sulfurous'],
    gravity: [1.0, 1.7],
    temperature: [180, 420],
    hazards: ['lava vents', 'heat'],
    resources: [
      { id: 'obsidian', name: 'Obsidian', tier: 'common' },
      { id: 'sulfur-bloom', name: 'Sulfur Bloom', tier: 'rare' },
      { id: 'ember-heart', name: 'Ember Heart', tier: 'exotic' },
    ],
  },
  'clay canyon': {
    // petal / atmospheric palette (47.5, 47.7): Pink Mist rock, Cotton Rose light, Dust Grey highlight
    palettes: [
      { ramp: [OFFICIAL.prussianBlue, OFFICIAL.pinkMist, OFFICIAL.cottonRose, OFFICIAL.dustGrey], ground: OFFICIAL.inkBlack, sky: OFFICIAL.prussianBlue2 },
    ],
    atmospheres: ['dry', 'still'],
    gravity: [0.8, 1.2],
    temperature: [-10, 38],
    hazards: ['rockfall'],
    resources: [
      { id: 'terracotta', name: 'Terracotta', tier: 'common' },
      { id: 'blue-clay', name: 'Blue Clay', tier: 'rare' },
      { id: 'carved-tablet', name: 'Carved Tablet', tier: 'exotic' },
    ],
  },
  'frozen bog': {
    // twilight planet: Prussian Blue 2, Cerulean, Periwinkle, Baby Blue Ice, Cream (Periwinkle is the occasional accent)
    palettes: [
      { ramp: [OFFICIAL.prussianBlue2, OFFICIAL.yaleBlue, OFFICIAL.cerulean, OFFICIAL.babyBlueIce], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue3 },
      { ramp: [OFFICIAL.prussianBlue2, OFFICIAL.cerulean, OFFICIAL.periwinkle, OFFICIAL.cream], ground: OFFICIAL.prussianBlue3, sky: OFFICIAL.prussianBlue3 },
    ],
    atmospheres: ['misty', 'cold'],
    gravity: [0.8, 1.1],
    temperature: [-30, 4],
    hazards: ['soft ground', 'fog'],
    resources: [
      { id: 'bog-iron', name: 'Bog Iron', tier: 'common' },
      { id: 'winter-reed', name: 'Winter Reed', tier: 'rare' },
      { id: 'preserved-thing', name: 'Preserved Thing', tier: 'exotic' },
    ],
  },
};

export const BIOMES = Object.keys(BIOME_TABLE) as Biome[];

/** All resource definitions across biomes, keyed by slug. Used to seed the `resources` table. */
export const RESOURCE_DEFS: ResourceDef[] = Object.values(BIOME_TABLE).flatMap((b) => b.resources);
export const RESOURCE_BY_ID: Record<string, ResourceDef> = Object.fromEntries(RESOURCE_DEFS.map((r) => [r.id, r]));

const RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['common', 58],
  ['uncommon', 27],
  ['rare', 11],
  ['exotic', 4],
];

const SITE_NAMES: Record<SiteKind, string[]> = {
  formation: ['leaning spires', 'hollow ridge', 'glass arch', 'stacked stones'],
  ruin: ['abandoned relay', 'collapsed dome', 'somebody\u2019s shed', 'obelisk with typos'],
  signal: ['repeating pulse', 'very old voicemail', 'a low hum', 'unknown transmitter'],
  flora: ['lantern trees', 'grumpy moss', 'glass reeds', 'slow flowers'],
  creature: ['tunnel grazers', 'shy something', 'small angry rocks', 'sky jellies'],
  anomaly: ['cold spot', 'gravity fold', 'a door', 'time stutter'],
};

// ---------------------------------------------------------------- generators

export function systemId(index: number): string {
  return `system:${index}`;
}
export function planetId(sysIndex: number, planetIndex: number): string {
  return `planet:${sysIndex}:${planetIndex}`;
}

export function generateGalaxy(universeSeed: string, count = MVP_SYSTEM_COUNT): Galaxy {
  const systems: StarSystem[] = [];
  for (let i = 0; i < count; i++) systems.push(generateSystem(universeSeed, i));
  return { seed: universeSeed, systems };
}

export function generateSystem(universeSeed: string, index: number): StarSystem {
  const seed = seedFrom(universeSeed, 'system', index);
  const rng = new Rng(seed);
  const starClass = rng.weighted<StarClass>([
    ['red dwarf', 30],
    ['orange dwarf', 26],
    ['yellow dwarf', 22],
    ['white star', 14],
    ['blue giant', 8],
  ]);
  const starColor = STAR_COLOR[starClass]; // 47.15: warm light belongs to stars
  const starRadius = { 'red dwarf': 22, 'orange dwarf': 26, 'yellow dwarf': 30, 'white star': 34, 'blue giant': 40 }[starClass];
  const name = systemName(rng.child('name'), index);
  // spread systems across the map on a jittered arc so the MVP galaxy reads as a small cluster
  const t = (index + 0.5) / Math.max(1, MVP_SYSTEM_COUNT);
  const mapX = 0.12 + t * 0.76 + rng.range(-0.04, 0.04);
  const mapY = 0.3 + Math.sin(t * Math.PI * 1.4 + index) * 0.22 + rng.range(-0.08, 0.08);
  const planetCount = rng.int(3, 5);
  const planets: Planet[] = [];
  let orbit = starRadius + 48;
  for (let p = 0; p < planetCount; p++) {
    orbit += rng.int(7, 10) * 8;
    planets.push(generatePlanet(universeSeed, index, p, orbit));
  }
  return { id: systemId(index), index, seed, name, starClass, starColor, starRadius, mapX, mapY, planets };
}

export function generatePlanet(universeSeed: string, sysIndex: number, planetIndex: number, orbitRadius: number): Planet {
  const seed = seedFrom(universeSeed, 'planet', sysIndex, planetIndex);
  const rng = new Rng(seed);
  const biome = rng.pick(BIOMES);
  const table = BIOME_TABLE[biome];
  const palette = rng.pick(table.palettes);
  const rarity = rng.weighted(RARITY_WEIGHTS);
  const radius = rng.int(2, 4) * 8;
  const areaW = 24;
  const areaH = 14;

  // sites (points of interest)
  const siteCount = rng.int(2, 4);
  const taken = new Set<string>();
  const place = (r: Rng): { tx: number; ty: number } => {
    for (let tries = 0; tries < 50; tries++) {
      const tx = r.int(2, areaW - 3);
      const ty = r.int(2, areaH - 3);
      const key = `${tx},${ty}`;
      if (taken.has(key)) continue;
      // keep a small landing clearing in the middle
      if (Math.abs(tx - areaW / 2) < 3 && Math.abs(ty - areaH / 2) < 2) continue;
      taken.add(key);
      return { tx, ty };
    }
    return { tx: 2, ty: 2 };
  };
  const sites: Site[] = [];
  for (let i = 0; i < siteCount; i++) {
    const sr = rng.child('site', i);
    const kind = sr.weighted<SiteKind>([
      ['formation', 24],
      ['ruin', 18],
      ['signal', 16],
      ['flora', 18],
      ['creature', 14],
      ['anomaly', 10],
    ]);
    const pos = place(sr);
    sites.push({ id: `site:${sysIndex}:${planetIndex}:${i}`, index: i, kind, name: sr.pick(SITE_NAMES[kind]), rarity: sr.weighted(RARITY_WEIGHTS), ...pos });
  }

  // resource nodes: mostly common, a few rare, occasionally one exotic
  const nodeCount = rng.int(5, 8);
  const nodes: ResourceNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const nr = rng.child('node', i);
    const tier = nr.weighted<ResourceTier>([
      ['common', 66],
      ['rare', 26],
      ['exotic', 8],
    ]);
    const def = table.resources.find((r) => r.tier === tier) ?? table.resources[0];
    const pos = place(nr);
    nodes.push({ id: `res:${sysIndex}:${planetIndex}:${i}`, index: i, resource: def, amount: tier === 'common' ? nr.int(2, 4) : tier === 'rare' ? nr.int(1, 2) : 1, ...pos });
  }

  const hazards: string[] = [];
  if (rng.chance(0.55)) hazards.push(rng.pick(table.hazards));

  return {
    id: planetId(sysIndex, planetIndex),
    systemId: systemId(sysIndex),
    index: planetIndex,
    seed,
    name: planetName(rng.child('name'), sysIndex, planetIndex),
    biome,
    atmosphere: rng.pick(table.atmospheres),
    gravity: Math.round(rng.range(table.gravity[0], table.gravity[1]) * 100) / 100,
    temperature: Math.round(rng.range(table.temperature[0], table.temperature[1])),
    rarity,
    palette,
    radius,
    orbitRadius,
    orbitPhase: rng.range(0, Math.PI * 2),
    ring: rng.chance(0.18),
    moons: rng.int(0, 2),
    hazards,
    resourceTypes: table.resources,
    areaW,
    areaH,
    sites,
    nodes,
  };
}

// ---------------------------------------------------------------- id parsing / resolution

export type ParsedId =
  | { type: 'system'; sys: number }
  | { type: 'planet'; sys: number; planet: number }
  | { type: 'site'; sys: number; planet: number; index: number }
  | { type: 'res'; sys: number; planet: number; index: number };

export function parseId(id: string): ParsedId | null {
  const parts = id.split(':');
  const nums = parts.slice(1).map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  switch (parts[0]) {
    case 'system':
      return nums.length === 1 ? { type: 'system', sys: nums[0] } : null;
    case 'planet':
      return nums.length === 2 ? { type: 'planet', sys: nums[0], planet: nums[1] } : null;
    case 'site':
      return nums.length === 3 ? { type: 'site', sys: nums[0], planet: nums[1], index: nums[2] } : null;
    case 'res':
      return nums.length === 3 ? { type: 'res', sys: nums[0], planet: nums[1], index: nums[2] } : null;
    default:
      return null;
  }
}

export function resolveSystem(universeSeed: string, id: string): StarSystem | null {
  const p = parseId(id);
  if (!p || p.type !== 'system' || p.sys >= MVP_SYSTEM_COUNT) return null;
  return generateSystem(universeSeed, p.sys);
}

export function resolvePlanet(universeSeed: string, id: string): { system: StarSystem; planet: Planet } | null {
  const p = parseId(id);
  if (!p || p.type !== 'planet' || p.sys >= MVP_SYSTEM_COUNT) return null;
  const system = generateSystem(universeSeed, p.sys);
  const planet = system.planets[p.planet];
  return planet ? { system, planet } : null;
}

/** Slug-safe route param -> id and back. Routes use "3-1" for "planet:3:1". */
export function idToSlug(id: string): string {
  return id.split(':').slice(1).join('-');
}
export function slugToId(type: 'system' | 'planet', slug: string): string {
  return `${type}:${slug.split('-').join(':')}`;
}

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', exotic: 'Exotic' };
