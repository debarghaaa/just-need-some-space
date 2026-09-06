import { describe, expect, it } from 'vitest';
import { COLORS, COLOR_BY_ID, DEFAULT_ROCKET, DEFAULT_SUIT, normalizeDisplayName, rocketColors, rocketFromRow, suitFromRow, validateRocket, validateSuit } from '@/game/rockets';
import { LOADING, nextLoadingLine } from '@/game/copy';
import { APPROVED_HEXES } from '@/game/palette';

describe('customization (section 45)', () => {
  it('offers eight curated swatches, all inside the official colour system (section 47.13)', () => {
    expect(COLORS).toHaveLength(8);
    for (const c of COLORS) {
      expect(APPROVED_HEXES.has(c.hex.toLowerCase())).toBe(true);
      expect(APPROVED_HEXES.has(c.shade.toLowerCase())).toBe(true);
    }
  });
  it('validates every rocket colour region against the allowed list', () => {
    const ok = validateRocket({ ...DEFAULT_ROCKET, engineColor: 'rust', finColor: 'ochre', decalColor: 'moss' });
    expect(ok?.engineColor).toBe('rust');
    expect(validateRocket({ ...DEFAULT_ROCKET, engineColor: 'purple' })).toBeNull();
    expect(validateRocket({ body: 'stub', engine: 'single', fins: 'swept', color: 'cream', accent: 'slate', decal: 'none', engine_color: '#ff00ff' })).toBeNull();
  });
  it('falls back per region when a colour is not set', () => {
    const c = rocketColors({ ...DEFAULT_ROCKET, engineColor: undefined, finColor: undefined, decalColor: undefined });
    expect(c.fins).toBe(DEFAULT_ROCKET.color);
    expect(c.decal).toBe(DEFAULT_ROCKET.accent);
    expect(COLOR_BY_ID[c.engine]).toBeDefined();
  });
  it('validates suits (camel and snake case) and rejects unknown ids', () => {
    expect(validateSuit(DEFAULT_SUIT)).toEqual(DEFAULT_SUIT);
    expect(validateSuit({ suit_primary: 'cream', suit_secondary: 'slate', suit_visor: 'sky', suit_pack: 'navy' })).toEqual({ primary: 'cream', secondary: 'slate', visor: 'sky', pack: 'navy' });
    expect(validateSuit({ ...DEFAULT_SUIT, visor: 'neon' })).toBeNull();
    expect(validateSuit(null)).toBeNull();
  });
  it('round-trips rows from the database', () => {
    const row = { body: 'barrel', engine: 'twin', fins: 'blade', color: 'navy', accent: 'ochre', decal: 'stripe', engine_color: 'rust', fin_color: 'moss', decal_color: 'cream' };
    const cfg = rocketFromRow(row);
    expect(cfg.finColor).toBe('moss');
    expect(validateRocket(cfg)).not.toBeNull();
    const suit = suitFromRow({ suit_primary: 'moss', suit_secondary: 'navy', suit_visor: 'ochre', suit_pack: 'rust' });
    expect(suit).toEqual({ primary: 'moss', secondary: 'navy', visor: 'ochre', pack: 'rust' });
  });
  it('normalizes display names: trims, rejects blank, control chars and over-long', () => {
    expect(normalizeDisplayName('  Captain Quiet  ').value).toBe('Captain Quiet');
    expect(normalizeDisplayName('   ').error).toBeTruthy();
    expect(normalizeDisplayName('x\u0007y').error).toBeTruthy();
    expect(normalizeDisplayName('a'.repeat(33)).error).toBeTruthy();
    expect(normalizeDisplayName('a'.repeat(32)).error).toBeNull();
  });
});

describe('loading copy (section 44)', () => {
  it('keeps the supplied catalogue intact', () => {
    expect(LOADING.general).toContain('HARNESSMOGGING...');
    expect(LOADING.general[0]).toBe('HARNESSMOGGING...');
    expect(LOADING.context.universe).toContain('LEAVING EARTH BEHIND...');
    expect(LOADING.subline).toBe('somewhere else, obviously');
    for (const pool of Object.values(LOADING.context)) expect(pool.length).toBeGreaterThan(0);
  });
  it('never repeats the previous line and starts deterministically', () => {
    const first = nextLoadingLine('planet', null, 0, () => 0.5);
    expect(first).toBe(LOADING.context.planet[0]);
    let prev = first;
    for (let i = 1; i < 40; i++) {
      const line = nextLoadingLine('planet', prev, i, Math.random);
      expect(line).not.toBe(prev);
      expect(line.length).toBeGreaterThan(0);
      prev = line;
    }
  });
});
