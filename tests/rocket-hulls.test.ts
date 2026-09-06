import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BODIES, ENGINES, FINS, DECALS, STARTER_ROCKETS, WINGED_BODIES, validateRocket, type RocketConfig } from '@/game/rockets';
import { flameSpans, rocketPalette, rocketRows } from '@/game/pixel';
import { HERO_ROCKET_H, HERO_ROCKET_MAP, HERO_ROCKET_ROWS, HERO_ROCKET_W } from '@/game/hero-rocket-art';
import { APPROVED_HEXES } from '@/game/palette';

const GLYPH_CHARS = new Set(['.', 'b', 's', 'h', 'w', 'a', 'v', 'W', 'd', 'F', 'E', 'e', 'D']);

describe('rocket hulls (eight bodies, including the five winged ships)', () => {
  it('lists the eight hulls and validates each of them', () => {
    expect(BODIES.map((b) => b.id)).toEqual(['stub', 'needle', 'barrel', 'delta', 'cruiser', 'interceptor', 'hauler', 'lancer']);
    for (const b of BODIES) {
      const cfg = validateRocket({ body: b.id, engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal: 'none' });
      expect(cfg?.body).toBe(b.id);
    }
    expect(validateRocket({ body: 'saucer', engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal: 'none' })).toBeNull();
  });

  it('renders every body / engine / fin / decal combination on the 24 by 32 grid with known glyph characters only', () => {
    for (const b of BODIES)
      for (const e of ENGINES)
        for (const f of FINS)
          for (const d of DECALS) {
            const cfg: RocketConfig = { body: b.id, engine: e.id, fins: f.id, color: 'slate', accent: 'cream', decal: d.id };
            const rows = rocketRows(cfg);
            expect(rows).toHaveLength(32);
            for (const row of rows) {
              expect(row).toHaveLength(24);
              for (const ch of row) expect(GLYPH_CHARS.has(ch)).toBe(true);
            }
          }
  });

  it('keeps the winged hulls inside the sprite: nothing painted below the nozzle rows, nozzles sit where the flame is drawn', () => {
    for (const body of WINGED_BODIES) {
      const cfg: RocketConfig = { body, engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal: 'none' };
      const rows = rocketRows(cfg);
      for (let y = 27; y < 32; y++) expect(rows[y]).toBe('.'.repeat(24));
      // the nozzle bottoms (row 25 or 26) must be engine-coloured over every flame span
      for (const [x0, x1] of flameSpans(cfg)) {
        const under = rows[26].slice(x0, x1 + 1) + rows[25].slice(x0, x1 + 1);
        expect(under.replace(/[Ee]/g, '')).toBe('');
      }
      // wings are recoloured by the fin choice: the F glyph must exist in the hull art
      expect(rows.some((r) => r.includes('F'))).toBe(true);
    }
  });

  it('paints decals only on the fuselage of the winged hulls (never on wings or nozzles)', () => {
    for (const body of WINGED_BODIES) {
      const plain = rocketRows({ body, engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal: 'none' });
      for (const decal of ['stripe', 'ring', 'number'] as const) {
        const rows = rocketRows({ body, engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal });
        let painted = 0;
        rows.forEach((row, y) => {
          for (let x = 0; x < 24; x++) {
            if (row[x] !== 'D') continue;
            painted++;
            expect(['b', 's', 'h', 'w', 'a', 'v', 'W', 'd'].includes(plain[y][x])).toBe(true);
          }
        });
        expect(painted).toBeGreaterThan(0);
      }
    }
  });

  it('ships eight starter presets, each valid, each using only approved colours', () => {
    expect(STARTER_ROCKETS).toHaveLength(8);
    const names = new Set(STARTER_ROCKETS.map((s) => s.name));
    expect(names.size).toBe(8);
    for (const s of STARTER_ROCKETS) {
      expect(validateRocket(s.config)).not.toBeNull();
      expect(s.blurb.includes('\u2014')).toBe(false);
      for (const hex of Object.values(rocketPalette(s.config))) expect(APPROVED_HEXES.has(hex.toLowerCase())).toBe(true);
    }
    // the two reference ships
    expect(STARTER_ROCKETS.find((s) => s.name === 'The Arrowhead')?.config.body).toBe('delta');
    expect(STARTER_ROCKETS.find((s) => s.name === 'The Gunmetal')?.config.body).toBe('cruiser');
  });

  it('mirrors the hull ids in the database constraint (migration 0004)', () => {
    const sql = readFileSync('supabase/migrations/0004_rocket_hulls.sql', 'utf8');
    for (const b of BODIES) expect(sql.includes(`'${b.id}'`)).toBe(true);
  });
});

describe('homescreen rocket (hero-rocket-art.ts)', () => {
  it('is a complete 20 x 32 glyph in official colours with every character mapped', () => {
    expect(HERO_ROCKET_ROWS.length).toBe(HERO_ROCKET_H);
    for (const row of HERO_ROCKET_ROWS) {
      expect(row.length).toBe(HERO_ROCKET_W);
      for (const ch of row) if (ch !== '.') expect(HERO_ROCKET_MAP[ch], `glyph ${ch}`).toBeDefined();
    }
    for (const hex of Object.values(HERO_ROCKET_MAP)) expect(APPROVED_HEXES.has(hex.toLowerCase()), hex).toBe(true);
    // the flame sits under the nozzle on the last rows, warm and short (47.6)
    expect(HERO_ROCKET_ROWS[HERO_ROCKET_H - 1].includes('A')).toBe(true);
  });
});

describe('classic hulls in the cute style', () => {
  const classic = ['stub', 'needle', 'barrel'] as const;
  it('gives every classic hull a nose cap in the fin colour, a porthole with a glint, an accent band and a dark outline', () => {
    for (const body of classic) {
      const rows = rocketRows({ body, engine: 'single', fins: 'swept', color: 'cream', accent: 'ochre', decal: 'none' });
      const text = rows.join('');
      expect(text).toContain('W'); // porthole glint
      expect(text).toContain('v'); // porthole shade
      expect(rows.some((r) => /a{6,}/.test(r))).toBe(true); // accent band across the hull
      expect(rows[1].includes('F') || rows[2].includes('F')).toBe(true); // nose cap uses the fin colour
      // the outline: every painted cell above the flame rows touches only painted cells or outline cells
      rows.slice(0, 27).forEach((row, y) => {
        for (let x = 0; x < 24; x++) {
          if (row[x] === '.' || row[x] === 'd') continue;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
            if (nx < 0 || nx >= 24 || ny < 0 || ny > 26) continue;
            expect(rows[ny][nx]).not.toBe('.');
          }
        }
      });
      // the outline never spills into the flame rows
      expect(rows.slice(27).every((r) => !r.includes('d'))).toBe(true);
    }
  });
  it('keeps decals inside the classic fuselage and below the porthole', () => {
    for (const body of classic) {
      for (const decal of ['stripe', 'ring', 'number'] as const) {
        const rows = rocketRows({ body, engine: 'single', fins: 'swept', color: 'navy', accent: 'cream', decal });
        let painted = 0;
        rows.forEach((row, y) => {
          for (let x = 0; x < 24; x++) {
            if (row[x] !== 'D') continue;
            painted++;
            expect(y).toBeGreaterThanOrEqual(15);
            expect(y).toBeLessThan(22);
          }
        });
        expect(painted).toBeGreaterThan(0);
      }
    }
  });
});
