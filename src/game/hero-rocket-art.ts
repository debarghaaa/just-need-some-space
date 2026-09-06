import { OFFICIAL } from './palette';

/**
 * The homescreen rocket, 20 x 32: a chunky cartoon ship with a rounded Smart Blue nose cone, a big
 * round porthole with a glint, a warm Apricot Cream belly band, stubby swept fins, a Slate Grey
 * nozzle and a short soft flame. Drawn only in the official colour system, outlined in Prussian
 * Blue so it stays readable at 1 px per cell on the hero orbit. Decorative: the game's own rockets
 * are still built from the parts in rockets.ts.
 *
 * Glyph characters: n outline, h hull, s hull shade, l nose highlight, c nose, d nose shade,
 * w glint, g glass, G glass shade, b belly band, m nozzle light, e nozzle, A Y W flame, . transparent.
 */
export const HERO_ROCKET_W = 20;
export const HERO_ROCKET_H = 32;
export const HERO_ROCKET_ROWS: readonly string[] = [
  '........nnnn........',
  '......nnlcccnn......',
  '.....nlccccccdn.....',
  '.....nlccccccdn.....',
  '....nlcccccccddn....',
  '....ncccccccdddn....',
  '....nnnnnnnnnnnn....',
  '...nhhhhhhhhhhssn...',
  '...nhhhhnnnnhhssn...',
  '...nhhhnwwggGnssn...',
  '...nhhhnwgggGnssn...',
  '...nhhhngggGGnssn...',
  '...nhhhnGGGGGnssn...',
  '...nhhhhnnnnhhssn...',
  '...nhhhhhhhhhhssn...',
  '...nbbbbbbbbbbbbn...',
  '...nhhhhhhhhhhssn...',
  '..nnhhhhhhhhhhssnn..',
  '.nlcnhhhhhhhhhsncdn.',
  '.nlcnhhhhhhhhhsncdn.',
  'nlccnhhhhhhhhhsnccdn',
  'nlccnhhhhhhhhhsnccdn',
  'nlccnhhhhhhhhhsnccdn',
  'nnnnnhhhhhhhhhsnnnnn',
  '....nnnnnnnnnnnn....',
  '.....nmeeeeeemn.....',
  '....nmeeeeeeeemn....',
  '....nnnnnnnnnnnn....',
  '......AYWWWWYA......',
  '.......AYWWYA.......',
  '........AYYA........',
  '.........AA.........',
];

export const HERO_ROCKET_MAP: Record<string, string> = {
  n: OFFICIAL.prussianBlue,
  h: OFFICIAL.porcelain,
  s: OFFICIAL.alabasterGrey,
  l: OFFICIAL.icyBlue,
  c: OFFICIAL.smartBlue,
  d: OFFICIAL.sapphire,
  w: OFFICIAL.porcelain,
  g: OFFICIAL.icyBlue,
  G: OFFICIAL.cerulean,
  b: OFFICIAL.apricotCream,
  m: OFFICIAL.slateGrey,
  e: OFFICIAL.blueSlate,
  A: OFFICIAL.apricotCream, // 47.6 engine warmth: Apricot Cream -> Cream -> Porcelain, small, not neon
  Y: OFFICIAL.cream,
  W: OFFICIAL.porcelain,
};
