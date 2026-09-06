# Typography

Two families, no more: a typewriter face for reading and a pixel face for the game voice. Both are
self-hosted from `public/fonts` through `next/font/local` (no third-party requests, which keeps the CSP's
`font-src 'self'` honest). Licences: `public/fonts/LICENSES.md`.

| Role | Family | Token | Where |
| --- | --- | --- | --- |
| Reading | Courier Prime (400 / 700, with true italics) | `--font-body` | body copy, descriptions, navigation drawer text, forms, hints, Terms, Privacy, About, Codex entries |
| Game voice | Pixelify Sans (wght 400-700) | `--font-display` | page and section titles, buttons, nav links, player names and nameplates, HUD labels, tags, table headers, toasts and dialogue heads, loading word, stats and points |
| Data | Courier Prime (monospaced by nature) | `--font-mono` | kept as a token name only; resolves to the same typewriter face so no third family is ever loaded |

## Hierarchy

Size, weight, spacing, case and line height do the work; there is no third face and no colour-only emphasis.

- `h1` 1.85 to 3 rem (hero 2.4 to 4.4 rem), weight 600, line-height 1.15 to 1.3, uppercase
- `h2` 1.4 to 2 rem, `h3` 1.2 rem, `h4` 1.05 rem, weight 500, uppercase, letter-spacing 0.02em
- Buttons 1 rem (small 0.85, large 1.15), weight 500, letter-spacing 0.05em, uppercase
- Labels, eyebrows, breadcrumbs, tags, HUD: 0.8 to 0.95 rem, letter-spacing 0.06 to 0.08em, uppercase
- Body 1 rem Courier Prime, line-height 1.6, measure capped at 68ch; ledes 1.125 rem; small 0.875 rem
- Numbers in stats, points and tables use the pixel face with tabular figures so columns stay aligned

## Rules

- Pixel face for short, loud things; the typewriter face for anything a person reads for more than a line
  or two. The two share a hard-edged, mechanical rhythm (fixed pitch next to a pixel grid), which is why
  they sit together without a third face to bridge them.
- Long-form pixel text is limited to the origin story's closing lines, at 1.5 rem with 1.5 line height.
- Canvas text (nameplates, map counters) reads the `--font-pixel` variable through `canvasFont()` in
  `src/game/pixel.ts`, so the maps match the DOM. Before the font loads it falls back to monospace.
- No decorative, handwritten or sci-fi display faces; do not add a second pixel font.
- `tests/typography.test.ts` fails the build if a third family, an `@import` or an `@font-face` appears.
