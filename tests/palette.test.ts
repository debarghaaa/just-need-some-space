import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVED_HEXES, MAP, OFFICIAL, PALETTE, RAMPS, RARITY_COLOR, SEMANTIC, STAR_COLOR } from '@/game/palette';
import { COLORS } from '@/game/rockets';
import { generateGalaxy } from '@/game/universe';

/** Walks src and returns every file path with one of the given extensions. */
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrast = (a: string, b: string) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

/** The supplied colours, exactly as written in the brief (47.1 to 47.7) plus the 47.21 danger red. */
const SUPPLIED = [
  '#0d1b2a', '#1b263b', '#415a77', '#778da9', '#e0e1dd',
  '#0466c8', '#0353a4', '#023e7d', '#002855', '#001845', '#001233', '#33415c', '#5c677d', '#7d8597', '#979dac',
  '#d9ed92', '#b5e48c', '#99d98c', '#76c893', '#52b69a', '#34a0a4', '#168aad', '#1a759f', '#1e6091', '#184e77',
  '#ff99c8', '#fcf6bd', '#d0f4de', '#a9def9', '#e4c1f9',
  '#e27396', '#ea9ab2', '#efcfe3', '#eaf2d7', '#b3dee2',
  '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffffc',
  '#bcf4de', '#cde5d7', '#ded6d1', '#eec6ca', '#ffb7c3',
  '#d9564a',
];

/** The 47.21 semantic token table, verbatim from the brief (name -> value). */
const SPEC_TOKENS: Record<string, string> = {
  '--color-bg-primary': '#0d1b2a', '--color-bg-secondary': '#1b263b', '--color-bg-tertiary': '#415a77', '--color-bg-deep': '#001233', '--color-surface-dark': '#002855',
  '--color-border': '#415a77', '--color-border-active': '#0466c8',
  '--color-text-primary': '#fffffc', '--color-text-secondary': '#e0e1dd', '--color-text-muted': '#778da9', '--color-text-disabled': '#5c677d',
  '--color-primary': '#0466c8', '--color-primary-hover': '#0353a4', '--color-primary-active': '#023e7d', '--color-primary-soft': '#a9def9', '--color-secondary': '#1a759f',
  '--color-accent-cyan': '#9bf6ff', '--color-accent-teal': '#34a0a4', '--color-accent-green': '#76c893', '--color-accent-mint': '#d0f4de',
  '--color-accent-warm': '#ffd6a5', '--color-accent-gold': '#fcf6bd', '--color-accent-bright': '#fffffc',
  '--color-warning': '#e27396', '--color-danger': '#d9564a', '--color-success': '#76c893', '--color-focus': '#9bf6ff', '--color-overlay': '#001233',
  '--button-primary-bg': '#0466c8', '--button-primary-hover': '#0353a4', '--button-primary-text': '#fffffc',
  '--button-secondary-bg': '#1b263b', '--button-secondary-hover': '#415a77', '--button-secondary-text': '#e0e1dd',
  '--button-danger-bg': '#d9564a',
  '--input-bg': '#1b263b', '--input-border': '#415a77', '--input-border-focus': '#9bf6ff', '--input-text': '#fffffc',
  '--nav-bg': '#0d1b2a', '--nav-text': '#e0e1dd', '--nav-text-active': '#fffffc', '--nav-accent': '#0466c8',
  '--hud-bg': '#001845', '--hud-border': '#415a77', '--hud-text': '#fffffc', '--hud-accent': '#9bf6ff',
  '--discovery-common': '#52b69a', '--discovery-uncommon': '#1a759f', '--discovery-rare': '#9bf6ff', '--discovery-exceptional': '#fcf6bd',
  '--planet-water': '#168aad', '--planet-ocean': '#52b69a', '--planet-vegetation': '#76c893', '--planet-foliage-light': '#b5e48c', '--planet-ice': '#a9def9', '--planet-sand': '#ffd6a5', '--planet-sunset': '#e27396',
};

/** Tokens where the implementation deviates from the table for a documented contrast reason. */
const CONTRAST_EXCEPTIONS: Record<string, { value: string; reason: string }> = {
  '--button-danger-text': { value: '#001233', reason: 'Porcelain on Coral Red is 3.9:1; Prussian Blue 3 is 4.7:1' },
  '--input-placeholder': { value: '#979dac', reason: 'Dusty Denim on the input surface is 4.45:1; Lavender Grey is 5.6:1' },
};

/** Purple-derived accents (47.4 / 47.6): environmental only, never interface, navigation or buttons. */
const PURPLE_DERIVED = new Set([OFFICIAL.mauve, OFFICIAL.mauve2, OFFICIAL.periwinkle].map((h) => h.toLowerCase()));

const STYLE_FILES = ['src/styles/globals.css', 'src/styles/ui.css', 'src/styles/site.css'];
const css = () => readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

/** Every `--name: value` declared in the globals.css :root block. */
function rootDeclarations(): Record<string, string> {
  const root = css().match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Resolves a token through any var() chain to its final value. */
function resolve(decls: Record<string, string>, name: string, depth = 0): string {
  const v = decls[name];
  if (v === undefined || depth > 8) return '';
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/);
  return ref ? resolve(decls, ref[1], depth + 1) : v.toLowerCase();
}

const COLOUR_TOKEN = /^--(color|button|input|nav|hud|discovery|planet|link|control)-(?!h$)/; // --nav-h is the navigation height

describe('official website colour system (section 47) and semantic token layer (47.21)', () => {
  it('the approved raw palette is exactly the supplied colours: nothing invented, nothing missing', () => {
    expect([...APPROVED_HEXES].sort()).toEqual([...new Set(SUPPLIED)].sort());
    for (const hex of Object.values(OFFICIAL)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('every semantic token resolves to a raw palette colour, and the CSS layer mirrors the TypeScript layer exactly', () => {
    const decls = rootDeclarations();
    const cssColourTokens = Object.keys(decls).filter((k) => COLOUR_TOKEN.test(k));
    expect(cssColourTokens.sort()).toEqual(Object.keys(SEMANTIC).sort());
    for (const name of cssColourTokens) {
      const value = resolve(decls, name);
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
      expect(APPROVED_HEXES.has(value), `${name} ${value}`).toBe(true);
      expect(value, name).toBe(SEMANTIC[name as keyof typeof SEMANTIC]);
    }
  });

  it('the 47.21 token table is implemented value for value (contrast exceptions listed with their reason)', () => {
    for (const [name, value] of Object.entries(SPEC_TOKENS)) expect(SEMANTIC[name as keyof typeof SEMANTIC], name).toBe(value);
    for (const [name, ex] of Object.entries(CONTRAST_EXCEPTIONS)) {
      expect(SEMANTIC[name as keyof typeof SEMANTIC], `${name}: ${ex.reason}`).toBe(ex.value);
      expect(ex.reason.length).toBeGreaterThan(10);
    }
  });

  it('components consume semantic tokens: no raw hex outside the token block, no legacy token names, no undeclared var()', () => {
    const decls = rootDeclarations();
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];
    const legacy = /var\(--(?:bg-\d|space|navy|blue(?:-\d)?|sky(?:-2)?|ice|ink(?:-dim|-mute)?|cream|cyan|amber(?:-2)?|orange(?:-2)?|red(?:-2)?|green(?:-2)?|teal|warm-cream|line(?:-strong|-blue)?)\)/g;
    for (const file of walk(root, ['.ts', '.tsx', '.css'])) {
      const rel = file.replace(root, 'src');
      const text = readFileSync(file, 'utf8');
      // the palette module is the raw layer; the :root block and its header comment are the token layer
      if (rel === 'src/game/palette.ts') continue;
      const body = rel === 'src/styles/globals.css' ? text.slice(text.indexOf('\n}', text.indexOf(':root'))) : text;
      for (const m of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) offenders.push(`${rel} raw ${m[0]}`);
      for (const m of text.matchAll(legacy)) offenders.push(`${rel} legacy ${m[0]}`);
      for (const m of body.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
        const name = m[1];
        if (/^--(font|btn|dur|start|motion|ui-scale|radius|cut|shadow|content-w|nav-h)/.test(name)) continue; // typography, layout and per-button locals
        if (!(name in decls)) offenders.push(`${rel} undeclared ${name}`);
      }
      // translucent overlays may only be built from official colours too
      for (const m of text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        const hex = '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
        if (!APPROVED_HEXES.has(hex)) offenders.push(`${rel} ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no computed or mixed colours: the palette is a rule, not a starting point', () => {
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];
    for (const file of walk(root, ['.ts', '.tsx', '.css'])) {
      const text = readFileSync(file, 'utf8');
      if (/color-mix\(|\blighten\(|\bdarken\(|\bhsl\(/.test(text)) offenders.push(file.replace(root, 'src'));
    }
    expect(offenders).toEqual([]);
  });

  it('the role objects canvas code reads resolve through the semantic tokens', () => {
    expect(PALETTE.void).toBe(SEMANTIC['--color-bg-primary']);
    expect(PALETTE.deepNavy).toBe(SEMANTIC['--color-bg-secondary']);
    expect(PALETTE.celestialBlue).toBe(SEMANTIC['--color-primary']);
    expect(PALETTE.orbitBlue).toBe(SEMANTIC['--color-primary-hover']);
    expect(PALETTE.sky).toBe(SEMANTIC['--color-primary-soft']);
    expect(PALETTE.ice).toBe(SEMANTIC['--color-accent-bright']);
    expect(PALETTE.starlight).toBe(SEMANTIC['--color-text-secondary']);
    expect(PALETTE.celestialCyan).toBe(SEMANTIC['--color-accent-cyan']);
    expect(PALETTE.warningCoral).toBe(SEMANTIC['--color-warning']);
    expect(PALETTE.sunlitAmber).toBe(SEMANTIC['--color-accent-warm']);
    expect(PALETTE.warmCream).toBe(SEMANTIC['--color-accent-gold']);
    expect(MAP.player).toBe(SEMANTIC['--color-primary']);
    expect(MAP.undiscovered).toBe(SEMANTIC['--color-border']);
    expect(MAP.discovered).toBe(SEMANTIC['--discovery-common']);
    expect(MAP.hazard).toBe(SEMANTIC['--color-warning']);
    expect(MAP.otherPlayer).toBe(SEMANTIC['--color-accent-warm']);
    expect(MAP.background).toBe(SEMANTIC['--color-bg-deep']);
    expect(MAP.star).toBe(SEMANTIC['--color-accent-bright']);
    expect(RARITY_COLOR.common).toBe(SEMANTIC['--discovery-common']);
    expect(RARITY_COLOR.uncommon).toBe(SEMANTIC['--discovery-uncommon']);
    expect(RARITY_COLOR.rare).toBe(SEMANTIC['--discovery-rare']);
    expect(RARITY_COLOR.exotic).toBe(SEMANTIC['--discovery-exceptional']);
    expect(STAR_COLOR['yellow dwarf']).toBe(OFFICIAL.cream);
    expect(STAR_COLOR['orange dwarf']).toBe(SEMANTIC['--color-accent-warm']);
    expect(STAR_COLOR['blue giant']).toBe(SEMANTIC['--color-primary-soft']);
  });

  it('button semantics (47.21): primary, secondary, danger and selected states read their component tokens; no gradients or pills', () => {
    const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');
    expect(ui).toMatch(/\.btn-primary \{ --btn-bg: var\(--button-primary-bg\); --btn-fg: var\(--button-primary-text\)/);
    expect(ui).toMatch(/\.btn-primary:hover \{ background: var\(--button-primary-hover\)/);
    expect(ui).toMatch(/\.btn-secondary \{ --btn-bg: var\(--button-secondary-bg\); --btn-fg: var\(--button-secondary-text\)/);
    expect(ui).toMatch(/\.btn-secondary:hover \{ background: var\(--button-secondary-hover\)/);
    expect(ui).toMatch(/\.btn-danger \{ --btn-bg: var\(--button-danger-bg\); --btn-fg: var\(--button-danger-text\)/);
    expect(ui).toMatch(/\.btn:disabled[^\n]*cursor: not-allowed/);
    for (const sel of ["\\.opt\\[aria-pressed='true'\\]", "\\.ptab\\[aria-selected='true'\\]", "\\.swatch\\[aria-checked='true'\\]"]) {
      expect(ui).toMatch(new RegExp(`${sel}[^\\n]*background: var\\(--control-selected-bg\\)`));
    }
    // state semantics: warnings are --color-warning, errors --color-danger, success --color-success, importance --color-accent-gold
    expect(ui).toMatch(/\.tag-warn \{ border-color: var\(--color-warning\)/);
    expect(ui).toMatch(/\.toast-warn \{ border-left-color: var\(--color-warning\)/);
    expect(ui).toMatch(/\.toast-err \{ border-left-color: var\(--color-danger\)/);
    expect(ui).toMatch(/\.toast-ok \{ border-left-color: var\(--color-success\)/);
    expect(ui).toMatch(/\.tag-first \{ border-color: var\(--color-accent-gold\)/);
    expect(ui).toMatch(/\.tag-rare \{ border-color: var\(--discovery-rare\)/);
    expect(ui).toMatch(/\.tag-exotic \{ border-color: var\(--discovery-exceptional\)/);
    const globals = css();
    expect(globals).toMatch(/:focus-visible \{ outline: 3px solid var\(--color-focus\)/);
    expect(globals).toMatch(/\.input:focus \{ outline: none; border-color: var\(--input-border-focus\)/);
    expect(globals).toMatch(/\.input::placeholder \{ color: var\(--input-placeholder\)/);
    for (const f of STYLE_FILES) {
      const text = readFileSync(join(process.cwd(), f), 'utf8');
      expect(text, f).not.toMatch(/linear-gradient\((?!90deg, var\(--color-border\))/); // only the pixel dash separators
      for (const m of text.matchAll(/border-radius:\s*([^;}]+)/g)) expect(['0', '0px', '50%'], `${f} ${m[0]}`).toContain(m[1].trim()); // 0 for controls, 50% only for the hero orbit rings
      expect(text, f).not.toMatch(/9999px/);
    }
  });

  it('pixel-art ramps are the supplied ramps (47.14)', () => {
    expect([...RAMPS.blue]).toEqual(['#001233', '#001845', '#002855', '#0353a4', '#0466c8', '#a9def9', '#fffffc']);
    expect([...RAMPS.ocean]).toEqual(['#184e77', '#1e6091', '#168aad', '#34a0a4', '#52b69a', '#99d98c']);
    expect([...RAMPS.warm]).toEqual(['#e27396', '#ff99c8', '#ffd6a5', '#fcf6bd', '#fffffc']);
    expect([...RAMPS.mint]).toEqual(['#184e77', '#34a0a4', '#76c893', '#b5e48c', '#d0f4de']);
  });

  it('purple-derived accents never reach the interface: not in tokens, not in buttons, not in customization swatches', () => {
    for (const hex of Object.values(SEMANTIC)) expect(PURPLE_DERIVED.has(hex.toLowerCase()), hex).toBe(false);
    for (const c of COLORS) {
      expect(PURPLE_DERIVED.has(c.hex.toLowerCase()), c.name).toBe(false);
      expect(PURPLE_DERIVED.has(c.shade.toLowerCase()), c.name).toBe(false);
    }
    for (const hex of [...Object.values(PALETTE), ...Object.values(MAP), ...Object.values(RARITY_COLOR)]) expect(PURPLE_DERIVED.has(hex.toLowerCase())).toBe(false);
  });

  it('procedural planets only use official colours, keep a deep blue sky and ground, and never lead with purple (47.13)', () => {
    const g = generateGalaxy('just-need-some-space');
    const deepBlues = new Set<string>([OFFICIAL.inkBlack, OFFICIAL.prussianBlue, OFFICIAL.prussianBlue2, OFFICIAL.prussianBlue3, OFFICIAL.prussianDeep, OFFICIAL.regalNavy, OFFICIAL.yaleBlue]);
    for (const s of g.systems)
      for (const p of s.planets) {
        for (const hex of [...p.palette.ramp, p.palette.sky, p.palette.ground]) expect(APPROVED_HEXES.has(hex.toLowerCase()), `${p.name} ${hex}`).toBe(true);
        expect(deepBlues.has(p.palette.sky), `${p.name} sky`).toBe(true);
        expect(deepBlues.has(p.palette.ground), `${p.name} ground`).toBe(true);
        // a purple-derived colour may only ever be a single accent step, never shadow or base
        expect(PURPLE_DERIVED.has(p.palette.ramp[0].toLowerCase()) || PURPLE_DERIVED.has(p.palette.ramp[1].toLowerCase()), p.name).toBe(false);
        expect(p.palette.ramp.filter((h) => PURPLE_DERIVED.has(h.toLowerCase())).length).toBeLessThanOrEqual(1);
      }
  });

  it('text and controls keep WCAG contrast on the surfaces they sit on (47.18, 47.21 accessibility tokens)', () => {
    const T = SEMANTIC;
    const surfaces = [T['--color-bg-primary'], T['--color-bg-secondary'], T['--color-bg-inset'], T['--color-bg-deep'], T['--color-surface-dark']];
    // primary and secondary text on every structural surface
    for (const bg of surfaces) {
      expect(contrast(T['--color-text-primary'], bg), bg).toBeGreaterThan(7);
      expect(contrast(T['--color-text-secondary'], bg), bg).toBeGreaterThan(7);
      expect(contrast(T['--color-text-support'], bg), bg).toBeGreaterThan(4.5);
    }
    // muted text only where it passes: page background and inset wells (it fails on panels, 4.45:1)
    for (const bg of [T['--color-bg-primary'], T['--color-bg-inset'], T['--color-bg-deep']]) expect(contrast(T['--color-text-muted'], bg), bg).toBeGreaterThan(4.5);
    expect(contrast(T['--color-text-muted'], T['--color-bg-secondary'])).toBeLessThan(4.5); // documents why --color-text-support exists
    // text on the tertiary (hover) surface
    expect(contrast(T['--color-text-primary'], T['--color-bg-tertiary'])).toBeGreaterThan(4.5);
    expect(contrast(T['--color-text-secondary'], T['--color-bg-tertiary'])).toBeGreaterThan(4.5);
    // buttons
    expect(contrast(T['--button-primary-text'], T['--button-primary-bg'])).toBeGreaterThan(4.5);
    expect(contrast(T['--button-primary-text'], T['--button-primary-hover'])).toBeGreaterThan(4.5);
    expect(contrast(T['--button-primary-text'], T['--color-primary-active'])).toBeGreaterThan(4.5);
    expect(contrast(T['--button-secondary-text'], T['--button-secondary-bg'])).toBeGreaterThan(4.5);
    expect(contrast(T['--color-text-primary'], T['--button-secondary-hover'])).toBeGreaterThan(4.5);
    expect(contrast(T['--button-danger-text'], T['--button-danger-bg'])).toBeGreaterThan(4.5);
    expect(contrast(T['--button-danger-text'], T['--button-danger-hover'])).toBeGreaterThan(4.5);
    expect(contrast(T['--color-bg-deep'], T['--color-success'])).toBeGreaterThan(4.5);
    expect(contrast(T['--color-bg-deep'], T['--color-accent-mint'])).toBeGreaterThan(4.5);
    // selected controls
    expect(contrast(T['--control-selected-text'], T['--control-selected-bg'])).toBeGreaterThan(4.5);
    expect(contrast(T['--control-selected-border'], T['--control-selected-bg'])).toBeGreaterThan(3);
    // inputs
    expect(contrast(T['--input-text'], T['--input-bg'])).toBeGreaterThan(7);
    expect(contrast(T['--input-placeholder'], T['--input-bg'])).toBeGreaterThan(4.5);
    expect(contrast(T['--input-border-focus'], T['--input-bg'])).toBeGreaterThan(3);
    // accents used as text on panels and wells: discovery, rarity, warning, links, positive, warm
    for (const fg of [T['--color-accent-cyan'], T['--color-accent-gold'], T['--color-warning'], T['--color-primary-soft'], T['--color-success'], T['--color-accent-warm'], T['--discovery-common']]) {
      for (const bg of [T['--color-bg-secondary'], T['--color-bg-inset']]) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThan(4.5);
    }
    // danger red is a fill / border colour: visible against every surface (3:1 for UI components), never relied on as small text
    for (const bg of surfaces) expect(contrast(T['--color-danger'], bg), bg).toBeGreaterThan(3);
    // focus ring (Electric Aqua) is visible on every surface including the primary and selected fills
    for (const bg of [...surfaces, T['--color-primary'], T['--control-selected-bg']]) expect(contrast(T['--color-focus'], bg), bg).toBeGreaterThan(3);
    // borders read against panels and the page
    for (const bg of [T['--color-bg-primary'], T['--color-bg-secondary']]) expect(contrast(T['--color-border'], bg), bg).toBeGreaterThan(1.9);
    // HUD and nav
    expect(contrast(T['--hud-text'], T['--hud-bg'])).toBeGreaterThan(7);
    expect(contrast(T['--hud-accent'], T['--hud-bg'])).toBeGreaterThan(7);
    expect(contrast(T['--nav-text'], T['--nav-bg'])).toBeGreaterThan(7);
    expect(contrast(T['--nav-text-active'], T['--nav-bg'])).toBeGreaterThan(7);
  });
});
