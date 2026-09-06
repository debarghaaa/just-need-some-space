import { describe, expect, it } from 'vitest';
import { generateGalaxy, generatePlanet, generateSystem, idToSlug, MVP_SYSTEM_COUNT, parseId, resolvePlanet, resolveSystem, slugToId } from '@/game/universe';
import { validateRocket } from '@/game/rockets';
import { POINT_RULES } from '@/game/rules';
import { COPY } from '@/game/copy';

const SEED = 'just-need-some-space';

describe('deterministic universe', () => {
  it('generates the same galaxy for the same seed', () => {
    const a = JSON.stringify(generateGalaxy(SEED));
    const b = JSON.stringify(generateGalaxy(SEED));
    expect(a).toBe(b);
  });
  it('changes with the seed', () => {
    expect(JSON.stringify(generateGalaxy(SEED))).not.toBe(JSON.stringify(generateGalaxy('other')));
  });
  it('has five systems with 3 to 5 planets each', () => {
    const g = generateGalaxy(SEED);
    expect(g.systems).toHaveLength(MVP_SYSTEM_COUNT);
    for (const s of g.systems) {
      expect(s.planets.length).toBeGreaterThanOrEqual(3);
      expect(s.planets.length).toBeLessThanOrEqual(5);
    }
  });
  it('scales beyond the MVP window without changing existing systems', () => {
    const five = generateGalaxy(SEED, 5);
    const fifty = generateGalaxy(SEED, 50);
    expect(fifty.systems).toHaveLength(50);
    expect(JSON.stringify(fifty.systems.slice(0, 5))).toBe(JSON.stringify(five.systems));
  });
  it('planets have sites, nodes and a palette that never leads with purple', () => {
    const g = generateGalaxy(SEED);
    for (const s of g.systems)
      for (const p of s.planets) {
        expect(p.sites.length).toBeGreaterThan(0);
        expect(p.nodes.length).toBeGreaterThan(0);
        // shadow, base, sky and ground are never purple-ish (red and blue both clearly above green);
        // the official Periwinkle / Mauve accents may only appear as the light or highlight step (47.4)
        for (const hex of [p.palette.ramp[0], p.palette.ramp[1], p.palette.sky, p.palette.ground]) {
          const n = parseInt(hex.slice(1), 16);
          const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
          expect(r > gg + 40 && b > gg + 40).toBe(false);
        }
      }
  });
  it('ids round-trip through slugs and parse', () => {
    expect(idToSlug('planet:3:1')).toBe('3-1');
    expect(slugToId('planet', '3-1')).toBe('planet:3:1');
    expect(parseId('site:1:2:3')).toEqual({ type: 'site', sys: 1, planet: 2, index: 3 });
    expect(parseId('nope')).toBeNull();
    expect(parseId('planet:x:1')).toBeNull();
  });
  it('resolves only systems inside the MVP window', () => {
    expect(resolveSystem(SEED, 'system:0')?.id).toBe('system:0');
    expect(resolveSystem(SEED, `system:${MVP_SYSTEM_COUNT}`)).toBeNull();
    expect(resolvePlanet(SEED, 'planet:0:99')).toBeNull();
  });
  it('individual generators match the galaxy output', () => {
    const g = generateGalaxy(SEED);
    const s = generateSystem(SEED, 2);
    expect(JSON.stringify(s)).toBe(JSON.stringify(g.systems[2]));
    const p = generatePlanet(SEED, 2, 0, s.planets[0].orbitRadius);
    expect(p.id).toBe(s.planets[0].id);
    expect(p.name).toBe(s.planets[0].name);
  });
});

describe('rockets', () => {
  it('accepts catalogue parts and rejects unknown ones', () => {
    expect(validateRocket({ body: 'stub', engine: 'twin', fins: 'box', color: 'moss', accent: 'rust', decal: 'ring' })).not.toBeNull();
    expect(validateRocket({ body: 'saucer', engine: 'twin', fins: 'box', color: 'moss', accent: 'rust', decal: 'ring' })).toBeNull();
    expect(validateRocket({ body: 'stub', engine: 'twin', fins: 'box', color: 'purple', accent: 'rust', decal: 'ring' })).toBeNull();
    expect(validateRocket(null)).toBeNull();
  });
});

describe('rules and copy', () => {
  it('matches the point values in the brief', () => {
    expect(POINT_RULES.planet_discovered).toBe(100);
    expect(POINT_RULES.resource_rare).toBe(25);
    expect(POINT_RULES.resource_exotic).toBe(50);
    expect(POINT_RULES.system_visited).toBe(150);
    expect(POINT_RULES.planet_fully_scanned).toBe(75);
  });
  it('contains no em dashes anywhere in copy', () => {
    expect(JSON.stringify(COPY)).not.toContain('\u2014');
  });
  it('keeps the origin story verbatim', () => {
    const text = COPY.origin.paragraphs.flat().join('\n');
    expect(text).toContain('\u201cYou all irritate me. I need my own planet.\u201d');
    expect(text).toContain('We built one.');
    expect(text).toContain('JUST NEED SOME SPACE. isn\u2019t really about escaping Earth.');
    expect(text).toContain('Welcome to somewhere else.');
  });
});
