import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/** Font system: exactly two families (Courier Prime typewriter for reading, Pixelify Sans for the game voice), both self-hosted. */
describe('typography', () => {
  it('ships exactly two font families', () => {
    const files = readdirSync('public/fonts').filter((f) => f.endsWith('.woff2'));
    expect(files.sort()).toEqual([
      'courier-prime-latin-400-italic.woff2',
      'courier-prime-latin-400-normal.woff2',
      'courier-prime-latin-700-italic.woff2',
      'courier-prime-latin-700-normal.woff2',
      'pixelify-sans-latin-wght-normal.woff2',
    ]);
  });
  it('declares both through next/font and nothing else', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout.match(/localFont\(/g)?.length).toBe(2);
    expect(layout.includes('pixelify-sans')).toBe(true);
    expect(layout.includes('courier-prime-latin')).toBe(true);
    expect(layout.includes('inter-latin')).toBe(false);
    expect(layout.includes('googleapis')).toBe(false);
  });
  it('routes every font token to one of the two families (no third family in CSS)', () => {
    const globals = readFileSync('src/styles/globals.css', 'utf8');
    expect(globals.includes('--font-display: var(--font-pixel)')).toBe(true);
    expect(globals.includes('--font-body: var(--font-typewriter)')).toBe(true);
    expect(globals.includes('--font-mono: var(--font-typewriter)')).toBe(true);
    expect(globals.includes('--font-sans')).toBe(false);
    for (const f of ['src/styles/globals.css', 'src/styles/ui.css', 'src/styles/site.css']) {
      const css = readFileSync(f, 'utf8');
      const decls = css.match(/font-family:[^;]+;/g) ?? [];
      for (const d of decls) expect(d.includes('var(--font-')).toBe(true);
      expect(css.includes('@import')).toBe(false);
      expect(css.includes('@font-face')).toBe(false);
    }
  });
  it('keeps the pixel face out of long-form body copy', () => {
    const globals = readFileSync('src/styles/globals.css', 'utf8');
    expect(/body \{[^}]*font-family: var\(--font-body\)/.test(globals)).toBe(true);
  });
});
