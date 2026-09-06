import { OFFICIAL } from './palette';

/**
 * The site mark: the supplied pixel galaxy (a tilted spiral with a bright core and a few loose
 * stars), extracted from the source grid and re-mapped onto the official colour system. Artwork,
 * so it reads the raw palette like the planet ramps do (47.13): the core is Alabaster Grey and
 * Honeydew, the arms Light Blue, Lavender Grey, Dusty Denim, Slate Grey and Blue Slate, the dust
 * lanes Dusk Blue and Twilight Indigo, with Tropical Teal specks. The source's violet tones are
 * folded into the blue-grey family (47: blue stays dominant, purple never leads). '.' is
 * transparent. Drawn inline by BrandMark (SVG) and apple-icon.tsx (PNG); BRAND_ICON_ROWS is a
 * 27 x 27 reduction for the 32 px favicon. The logo never depends on an image asset.
 */
export const BRAND_ART_W = 40;
export const BRAND_ART_H = 31;
export const BRAND_ART_ROWS: readonly string[] = [
  '........t...............................',
  '................t....t...t..............',
  '...................tt..tt.tsssttt.......',
  '...........t.........t......tsdgs.......',
  '.......t................t....tsglllt....',
  '............t......u..t.u.tt....glblut..',
  '..................t.sgduddlgtt...gdbutt.',
  '.......t..ut....tudllbdglssbldstttlbllu.',
  '.........ghg.ttdsdudbsdbbt.ssdlgt.glbltt',
  '....t....ghg.sdsuuglhhbbbbggulblgtsblltt',
  '..........utgdutslbbbhhbbbbllgblgugbbbtt',
  '..........ugstdblbhhahhhbbhbgdlddsdlbl..',
  '.........slutllbbbhhhahhhbbllbblggbbggt.',
  '........ustsblbbhhhhhhahhbbbgbllslbbds..',
  '.......ssuubllbhhhhahhahbblgbbdsslbgtt..',
  't....tsduubglbbhhhaaaahbhhllllgsdlgut...',
  '.....slssllgllhbbhhhhhhbbbdbllulllss....',
  '..t.usugllglslalbbhhhbhblllggullsss.....',
  '...tddtslldl.ghbbbbbhbbllldssllggs......',
  '...suusblsgbgtllbhblblbbsutsdlgss.......',
  '..tgdtsldssglutusglblleuuusllldu........',
  '..ustugdlssgdbbdlblldsusggllguu.......t.',
  '..ssusslblssggblldstusglllgss...........',
  't.ssutugbldgssssssssllllsgsu.....tt.....',
  '..ugt.tggbbllllblbllldggss..............',
  '..tst.ttsglblllllggdgsus................',
  '...s....tsdggsggsssstut.................',
  '...us.....ttuuttuu.t..........s.....t...',
  '....u......t..........t......sbt........',
  '......t....t..................t.........',
  '.t..............t.......t.......t.......',
];

export const BRAND_ICON_W = 27;
export const BRAND_ICON_H = 27;
export const BRAND_ICON_ROWS: readonly string[] = [
  '..............t............',
  '...........................',
  '.....t....t................',
  '.............t.ttttut......',
  '.....t........t.t..tdgtt...',
  '........t...t..tt...tgblt..',
  '.......t.tttusdsdgdst.glst.',
  '.....tggttsdsllldtgdgttlbst',
  '......ggususlbhbblgdbdtlbtt',
  '......tssslbbhhhbblglgslbut',
  '.....tsuglbhhhaabblblglbdt.',
  '....tsullbhhaahhbblbdsblu..',
  't..tdsdllbbhaahhhlllsdlst..',
  '...ssdgddhbbhhhblllsldst...',
  '..ssuldltbbbbhbldgsddst....',
  '.tsuslsdguggllldusllgt.....',
  '.tsuglgglblblgusglgut....t.',
  '.tstsblgsgssssllggt...t....',
  '.tg.uslbllllldggut.........',
  '.ts.ttggggggsutt...........',
  '..ut..tttttttt.t...tg...t..',
  '...ttt...t..........t......',
  '..t.............t.t..t.....',
  '...........................',
  '........t.........t........',
  '.............t.............',
  '..................t........',
];

export const BRAND_ART_COLORS: Readonly<Record<string, string>> = {
  a: OFFICIAL.alabasterGrey, // core
  h: OFFICIAL.honeydew, // inner glow
  b: OFFICIAL.lightBlue, // bright arm
  l: OFFICIAL.lavenderGrey, // arm
  d: OFFICIAL.dustyDenim, // arm
  g: OFFICIAL.slateGrey, // arm shadow
  s: OFFICIAL.blueSlate, // outer arm
  u: OFFICIAL.duskBlue, // dust lane
  t: OFFICIAL.twilightIndigo, // faint dust and distant stars
  e: OFFICIAL.tropicalTeal, // star-forming specks
};

export type BrandRun = readonly [y: number, x: number, length: number, fill: string];

/** Horizontal runs of same-coloured cells: a few rects per row instead of one per cell. */
export function brandRuns(rows: readonly string[]): BrandRun[] {
  return rows.flatMap((row, y) => {
    const runs: BrandRun[] = [];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      const start = x;
      while (x < row.length && row[x] === ch) x++;
      runs.push([y, start, x - start, BRAND_ART_COLORS[ch]]);
    }
    return runs;
  });
}

export const BRAND_RUNS: readonly BrandRun[] = brandRuns(BRAND_ART_ROWS);
export const BRAND_ICON_RUNS: readonly BrandRun[] = brandRuns(BRAND_ICON_ROWS);
