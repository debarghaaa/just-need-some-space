import { OFFICIAL } from './palette';
/**
 * Rocket and astronaut customization catalogue. Eight hulls, three engines, three fins, a shared
 * swatch palette, three decals (plus none). Stored per player in the `rockets` table; the server
 * validates every id against this list before saving.
 *
 * The first three hulls are classic rockets built from separate parts (hull + fins + bells). The
 * five ship hulls added later (delta, cruiser, interceptor, hauler, lancer) carry their own wings
 * and nozzles in the artwork; for those the fin and engine choices only change the colour of the
 * wings and nozzles. Ids are stable and only ever added, never renamed, so saved rockets keep
 * working. The database mirrors the id lists in supabase/migrations (0001, 0004).
 *
 * Colour regions (section 45.2): body, engine, fins, window/accent, decal. `color` is the body
 * colour and `accent` is the window/accent colour; the older two-field rockets map onto the new
 * regions without any data migration (engine and fins fall back to the body colour, the decal to
 * the accent colour).
 */
export type BodyId = 'stub' | 'needle' | 'barrel' | 'delta' | 'cruiser' | 'interceptor' | 'hauler' | 'lancer';
export type EngineId = 'single' | 'twin' | 'wide';
export type FinId = 'swept' | 'box' | 'blade';
export type ColorId = 'cream' | 'rust' | 'moss' | 'slate' | 'ochre' | 'navy' | 'sky' | 'starlight';
export type DecalId = 'none' | 'stripe' | 'ring' | 'number';

export interface RocketConfig {
  body: BodyId;
  engine: EngineId;
  fins: FinId;
  /** body colour */
  color: ColorId;
  /** window / accent colour */
  accent: ColorId;
  decal: DecalId;
  engineColor?: ColorId;
  finColor?: ColorId;
  decalColor?: ColorId;
}

export interface SuitConfig {
  primary: ColorId;
  secondary: ColorId;
  visor: ColorId;
  pack: ColorId;
}

export interface PartOption<T extends string> {
  id: T;
  name: string;
  note: string;
}

export const BODIES: PartOption<BodyId>[] = [
  { id: 'stub', name: 'Stub', note: 'Short. Honest. Fits anywhere.' },
  { id: 'needle', name: 'Needle', note: 'Long and narrow. Looks fast while parked.' },
  { id: 'barrel', name: 'Barrel', note: 'Round enough to roll home.' },
  { id: 'delta', name: 'Delta', note: 'Wide arrowhead. Wings are part of the hull.' },
  { id: 'cruiser', name: 'Cruiser', note: 'Twin prongs, twin pods. Looks busy standing still.' },
  { id: 'interceptor', name: 'Interceptor', note: 'Slim hull, swept wings, one big nozzle.' },
  { id: 'hauler', name: 'Hauler', note: 'Broad and boxy. Room for everything.' },
  { id: 'lancer', name: 'Lancer', note: 'Needle nose, long wings, nozzles at the tips.' },
];

/** Hulls whose wings and nozzles are drawn in the hull art (fin and engine choices recolour them). */
export const WINGED_BODIES: ReadonlySet<BodyId> = new Set<BodyId>(['delta', 'cruiser', 'interceptor', 'hauler', 'lancer']);

export const ENGINES: PartOption<EngineId>[] = [
  { id: 'single', name: 'Single Bell', note: 'One nozzle. No opinions.' },
  { id: 'twin', name: 'Twin Bell', note: 'Two nozzles for symmetry, mostly.' },
  { id: 'wide', name: 'Wide Bell', note: 'Loud on takeoff. Quiet everywhere else.' },
];

export const FINS: PartOption<FinId>[] = [
  { id: 'swept', name: 'Swept', note: 'The classic.' },
  { id: 'box', name: 'Box', note: 'Square. Reliable. Slightly stubborn.' },
  { id: 'blade', name: 'Blade', note: 'Thin fins for thin atmospheres.' },
];

/**
 * Curated swatches from the OFFICIAL COLOUR SYSTEM (47.10 rocket and astronaut customization).
 * Ids are stable so saved rockets keep working; the names and hex values are the only thing that
 * follows the colour system. Primary: Prussian Blue, Sapphire, Smart Blue. Secondary: Dusty Denim,
 * Icy Blue, Teal. Accent: Cream, Apricot Cream, Electric Aqua. Every shade is an official colour.
 */
export const COLORS: Array<PartOption<ColorId> & { hex: string; shade: string }> = [
  { id: 'cream', name: 'Icy Blue', note: '', hex: OFFICIAL.icyBlue, shade: OFFICIAL.dustyDenim },
  { id: 'starlight', name: 'Emerald', note: '', hex: OFFICIAL.emerald, shade: OFFICIAL.oceanMist }, // 47.10 astronaut secondary: Emerald / Mint
  { id: 'sky', name: 'Dusty Denim', note: '', hex: OFFICIAL.dustyDenim, shade: OFFICIAL.duskBlue },
  { id: 'slate', name: 'Smart Blue', note: '', hex: OFFICIAL.smartBlue, shade: OFFICIAL.sapphire },
  { id: 'navy', name: 'Prussian Blue', note: '', hex: OFFICIAL.prussianBlue, shade: OFFICIAL.inkBlack },
  { id: 'moss', name: 'Teal', note: '', hex: OFFICIAL.tropicalTeal, shade: OFFICIAL.balticBlue },
  { id: 'ochre', name: 'Cream', note: '', hex: OFFICIAL.cream, shade: OFFICIAL.apricotCream },
  { id: 'rust', name: 'Electric Aqua', note: '', hex: OFFICIAL.electricAqua, shade: OFFICIAL.cerulean },
];

export const DECALS: PartOption<DecalId>[] = [
  { id: 'none', name: 'None', note: 'Clean hull.' },
  { id: 'stripe', name: 'Stripe', note: 'One racing stripe. Purely psychological.' },
  { id: 'ring', name: 'Ring', note: 'A band around the middle.' },
  { id: 'number', name: 'Number', note: 'A hull number nobody assigned.' },
];

/** 47.10 rocket lighting: Prussian Blue body, Icy Blue windows, warm engine, Smart Blue fins. */
export const DEFAULT_ROCKET: RocketConfig = {
  body: 'stub',
  engine: 'single',
  fins: 'swept',
  color: 'navy',
  accent: 'cream',
  decal: 'none',
  engineColor: 'ochre',
  finColor: 'slate',
  decalColor: 'sky',
};

export const DEFAULT_SUIT: SuitConfig = { primary: 'navy', secondary: 'slate', visor: 'sky', pack: 'navy' };

/** 47.14 suggested suit combinations. Cool suits; warm colour only in small equipment areas. */
export const SUIT_PRESETS: Array<{ name: string; config: SuitConfig }> = [
  { name: 'Midnight Suit', config: { primary: 'navy', secondary: 'cream', visor: 'sky', pack: 'navy' } },
  { name: 'Orbit Suit', config: { primary: 'navy', secondary: 'slate', visor: 'sky', pack: 'slate' } },
  { name: 'Sky Suit', config: { primary: 'navy', secondary: 'sky', visor: 'cream', pack: 'navy' } },
  { name: 'Celestial Suit', config: { primary: 'navy', secondary: 'moss', visor: 'rust', pack: 'navy' } },
  { name: 'Explorer Suit', config: { primary: 'navy', secondary: 'ochre', visor: 'sky', pack: 'slate' } },
];

export const STARTER_ROCKETS: Array<{ name: string; blurb: string; config: RocketConfig }> = [
  { name: 'The Sensible One', blurb: 'Standard hull. Standard everything. Leaves on time.', config: { body: 'stub', engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal: 'none', engineColor: 'ochre', finColor: 'slate', decalColor: 'sky' } },
  { name: 'The Long Way Round', blurb: 'Narrow hull, twin bells, thin fins. Built to keep going.', config: { body: 'needle', engine: 'twin', fins: 'blade', color: 'slate', accent: 'cream', decal: 'stripe', engineColor: 'ochre', finColor: 'navy', decalColor: 'sky' } },
  { name: 'The Kettle', blurb: 'Round, loud on launch, very comfortable inside.', config: { body: 'barrel', engine: 'wide', fins: 'box', color: 'sky', accent: 'navy', decal: 'ring', engineColor: 'rust', finColor: 'navy', decalColor: 'moss' } },
  { name: 'The Arrowhead', blurb: 'Wide delta wings, a canopy down the spine, two warm nozzles.', config: { body: 'delta', engine: 'twin', fins: 'swept', color: 'sky', accent: 'moss', decal: 'none', engineColor: 'ochre', finColor: 'slate', decalColor: 'cream' } },
  { name: 'The Gunmetal', blurb: 'Dark hull, twin prongs, two engine pods and not much small talk.', config: { body: 'cruiser', engine: 'twin', fins: 'box', color: 'navy', accent: 'cream', decal: 'none', engineColor: 'ochre', finColor: 'navy', decalColor: 'sky' } },
  { name: 'The Interceptor', blurb: 'Slim, swept and slightly over-engined.', config: { body: 'interceptor', engine: 'wide', fins: 'blade', color: 'slate', accent: 'cream', decal: 'number', engineColor: 'ochre', finColor: 'navy', decalColor: 'cream' } },
  { name: 'The Hauler', blurb: 'Four nozzles, two cargo bays, one very patient pilot.', config: { body: 'hauler', engine: 'wide', fins: 'box', color: 'navy', accent: 'sky', decal: 'stripe', engineColor: 'ochre', finColor: 'slate', decalColor: 'sky' } },
  { name: 'The Lancer', blurb: 'Long wings, tip-mounted engines, arrives before the noise.', config: { body: 'lancer', engine: 'twin', fins: 'swept', color: 'cream', accent: 'navy', decal: 'none', engineColor: 'ochre', finColor: 'slate', decalColor: 'sky' } },
];

const ids = <T extends string>(arr: Array<{ id: T }>) => new Set<string>(arr.map((a) => a.id));
const BODY_IDS = ids(BODIES);
const ENGINE_IDS = ids(ENGINES);
const FIN_IDS = ids(FINS);
const COLOR_IDS = ids(COLORS);
const DECAL_IDS = ids(DECALS);

export const COLOR_BY_ID: Record<ColorId, { hex: string; shade: string; name: string }> = Object.fromEntries(COLORS.map((c) => [c.id, { hex: c.hex, shade: c.shade, name: c.name }])) as Record<ColorId, { hex: string; shade: string; name: string }>;

/** Resolves the five colour regions, applying the fallbacks for older two-colour rockets. */
export function rocketColors(cfg: RocketConfig): { body: ColorId; engine: ColorId; fins: ColorId; accent: ColorId; decal: ColorId } {
  return {
    body: cfg.color,
    engine: cfg.engineColor ?? 'navy',
    fins: cfg.finColor ?? cfg.color,
    accent: cfg.accent,
    decal: cfg.decalColor ?? cfg.accent,
  };
}

/** Returns a sanitized config or null if any part is unknown. Used server-side before saving. */
export function validateRocket(input: unknown): RocketConfig | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const body = s(o.body);
  const engine = s(o.engine);
  const fins = s(o.fins);
  const color = s(o.color);
  const accent = s(o.accent);
  const decal = s(o.decal);
  if (!BODY_IDS.has(body) || !ENGINE_IDS.has(engine) || !FIN_IDS.has(fins) || !COLOR_IDS.has(color) || !COLOR_IDS.has(accent) || !DECAL_IDS.has(decal)) return null;
  const optional = (v: unknown, fallback: ColorId): ColorId | null => {
    if (v == null) return fallback;
    const c = s(v);
    return COLOR_IDS.has(c) ? (c as ColorId) : null;
  };
  const engineColor = optional(o.engineColor ?? o.engine_color, 'navy');
  const finColor = optional(o.finColor ?? o.fin_color, color as ColorId);
  const decalColor = optional(o.decalColor ?? o.decal_color, accent as ColorId);
  if (!engineColor || !finColor || !decalColor) return null;
  return { body: body as BodyId, engine: engine as EngineId, fins: fins as FinId, color: color as ColorId, accent: accent as ColorId, decal: decal as DecalId, engineColor, finColor, decalColor };
}

/** Returns a sanitized suit or null if any colour is unknown. */
export function validateSuit(input: unknown): SuitConfig | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const pick = (v: unknown): ColorId | null => (typeof v === 'string' && COLOR_IDS.has(v) ? (v as ColorId) : null);
  const primary = pick(o.primary ?? o.suit_primary);
  const secondary = pick(o.secondary ?? o.suit_secondary);
  const visor = pick(o.visor ?? o.suit_visor);
  const pack = pick(o.pack ?? o.suit_pack);
  if (!primary || !secondary || !visor || !pack) return null;
  return { primary, secondary, visor, pack };
}

export function rocketFromRow(row: { body: string; engine: string; fins: string; color: string; accent: string; decal: string; engine_color?: string | null; fin_color?: string | null; decal_color?: string | null } | null | undefined): RocketConfig {
  return validateRocket(row) ?? DEFAULT_ROCKET;
}

export function suitFromRow(row: { suit_primary?: string | null; suit_secondary?: string | null; suit_visor?: string | null; suit_pack?: string | null } | null | undefined): SuitConfig {
  return validateSuit(row) ?? DEFAULT_SUIT;
}

/** Display-name rules, shared by the client form and the server (section 45.4). */
export const DISPLAY_NAME_MAX = 32;
export const DISPLAY_NAME_MIN = 1;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/;

export function normalizeDisplayName(raw: unknown): { value: string; error: string | null } {
  if (typeof raw !== 'string') return { value: '', error: 'Enter a name.' };
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < DISPLAY_NAME_MIN) return { value, error: 'A name needs at least one character.' };
  if (value.length > DISPLAY_NAME_MAX) return { value, error: `Names are at most ${DISPLAY_NAME_MAX} characters.` };
  if (CONTROL_CHARS.test(value)) return { value, error: 'That name contains characters we cannot print.' };
  return { value, error: null };
}
