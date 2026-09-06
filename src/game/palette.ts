/**
 * OFFICIAL WEBSITE COLOUR SYSTEM (spec 47), in two layers (47.21).
 *
 *   RAW PALETTE      `OFFICIAL`: the approved hexadecimal colours, one entry per supplied value.
 *   SEMANTIC TOKENS  `SEMANTIC`: what each colour means in the interface. One entry per CSS custom
 *                    property declared in src/styles/globals.css `:root`, same names, same values.
 *
 * Designers think in semantic roles; developers implement with semantic tokens. CSS consumes
 * `var(--token)`. Canvas and SVG code import `SEMANTIC`, or the role objects below (`PALETTE`,
 * `MAP`, `RARITY_COLOR`, `STAR_COLOR`), which resolve through the same tokens. Planet palettes and
 * pixel ramps (47.13, 47.14) draw from the raw palette directly: they are artwork, not interface.
 *
 * tests/palette.test.ts fails the build on any colour outside `OFFICIAL`, on any CSS colour token
 * that is not mirrored in `SEMANTIC`, on any `var(--x)` that is not declared, and on any contrast
 * pair below the floor. Nothing is invented, mixed or "tuned": a new colour needs a reason, a
 * semantic role, proof that no existing token serves, an accessibility check and a place here.
 *
 * Hierarchy (47.8) and balance (47.9):
 *   1. primary        deep navy and blue                         60 to 70%
 *   2. secondary      celestial blue, cyan, teal, ocean          15 to 20%
 *   3. environmental  green, mint, aqua, pastel blue, cream      10 to 15% (mostly inside planets)
 *   4. special        pink, coral, cream-golds, lavender-derived  3 to 8%
 *
 * Lighting rule (47.15): BLUE = SPACE, TEAL = LIFE, CYAN = DISCOVERY, WARM = ENERGY, PASTEL = STRANGENESS.
 */

/** Every official colour, with its official name (47.1 to 47.7, plus the 47.21 danger red). The
 *  duplicated "prussian-blue" names in the brief get unique internal names here, values untouched. */
export const OFFICIAL = {
  // 47.1 primary dark blue foundation
  inkBlack: '#0d1b2a', // page + game backgrounds, navigation foundation, loading screens
  prussianBlue: '#1b263b', // panels, cards, interface containers, HUD surfaces
  duskBlue: '#415a77', // borders, secondary controls, inactive states
  dustyDenim: '#778da9', // secondary text, subdued details, disabled states
  alabasterGrey: '#e0e1dd', // primary light text, readable labels

  // 47.2 deep celestial blue
  smartBlue: '#0466c8', // active primary interactions, selected objects, primary actions
  sapphire: '#0353a4', // hover states, stronger emphasis, map highlights
  regalNavy: '#023e7d', // deep navigation states, pressed primary, secondary panels
  prussianDeep: '#002855', // the brief's second "prussian-blue": elevated dark surfaces
  prussianBlue2: '#001845', // inset rows, wells, HUD containers
  prussianBlue3: '#001233', // darkest space: deep-space scenes, overlays
  twilightIndigo: '#33415c', // supporting hierarchy: quiet separators
  blueSlate: '#5c677d', // supporting hierarchy: disabled controls
  slateGrey: '#7d8597', // supporting hierarchy
  lavenderGrey: '#979dac', // supporting hierarchy: supporting text on panels

  // 47.3 teal, green and ocean (nature, water, discoveries, positive states)
  limeCream: '#d9ed92',
  lightGreen: '#b5e48c',
  lightGreen2: '#99d98c',
  emerald: '#76c893',
  oceanMist: '#52b69a',
  tropicalTeal: '#34a0a4',
  bondiBlue: '#168aad',
  cerulean: '#1a759f',
  balticBlue: '#1e6091',
  yaleBlue: '#184e77',

  // 47.4 soft celestial pastels (sparingly: strange planets, distant nebulae)
  babyPink: '#ff99c8',
  lemonChiffon: '#fcf6bd',
  frostedMint: '#d0f4de',
  icyBlue: '#a9def9',
  mauve: '#e4c1f9', // occasional environmental accent only, never a brand colour

  // 47.5 petal and soft environmental (planets and decoration only, never nav or buttons)
  petalRouge: '#e27396',
  pinkMist: '#ea9ab2',
  petalFrost: '#efcfe3',
  beige: '#eaf2d7',
  lightBlue: '#b3dee2',

  // 47.6 soft warm celestial (stars, sunlight, rewards, warm planets)
  powderBlush: '#ffadad',
  apricotCream: '#ffd6a5', // warm planetary light, sunlight, engine warmth, sunsets
  cream: '#fdffb6', // stars and star cores in artwork (the interface gold is Lemon Chiffon, 47.21)
  teaGreen: '#caffbf',
  electricAqua: '#9bf6ff', // unusual discoveries, scanning, restrained technical highlights
  babyBlueIce: '#a0c4ff',
  periwinkle: '#bdb2ff', // secondary environmental accent only
  mauve2: '#ffc6ff', // secondary environmental accent only
  porcelain: '#fffffc', // high-contrast text, very bright celestial elements, selected UI surfaces

  // 47.7 mint, grey and pink atmospheric (subtle variation, separators, decorative pixels)
  icyAqua: '#bcf4de',
  honeydew: '#cde5d7',
  dustGrey: '#ded6d1',
  cottonRose: '#eec6ca',
  cherryBlossom: '#ffb7c3',

  // 47.21 semantic token table: the one red
  coralRed: '#d9564a', // --color-danger: critical errors and destructive actions (fills and borders, never small text)
} as const;

/**
 * SEMANTIC TOKENS (47.21). Keys are the CSS custom properties declared in globals.css `:root`;
 * values are the raw palette entries they resolve to. Core tokens first, then component tokens.
 * The guard test resolves every CSS declaration (including `var()` chains) and compares it here.
 */
export const SEMANTIC = {
  // Backgrounds
  '--color-bg-primary': OFFICIAL.inkBlack, // main website and game background
  '--color-bg-secondary': OFFICIAL.prussianBlue, // sections, cards, panels, HUD containers
  '--color-bg-tertiary': OFFICIAL.duskBlue, // hover surface of structural controls (primary text only on top)
  '--color-bg-deep': OFFICIAL.prussianBlue3, // deep-space scenes, map backgrounds, game stages
  '--color-bg-inset': OFFICIAL.prussianBlue2, // inset rows, wells, chips, option controls (same value as --hud-bg)
  '--color-surface-dark': OFFICIAL.prussianDeep, // elevated dark surfaces: toasts, raised panels

  // Borders
  '--color-border': OFFICIAL.duskBlue, // standard borders and dividers
  '--color-border-active': OFFICIAL.smartBlue, // active and selected borders, current-page underline
  '--color-border-subtle': OFFICIAL.prussianBlue, // quiet dividers on the page background

  // Text
  '--color-text-primary': OFFICIAL.porcelain, // main headings, critical text, HUD
  '--color-text-secondary': OFFICIAL.alabasterGrey, // body text and readable secondary content
  '--color-text-muted': OFFICIAL.dustyDenim, // supporting text on Ink Black or inset wells only (4.45:1 on panels)
  '--color-text-support': OFFICIAL.lavenderGrey, // supporting text that may sit on panels (5.6:1 on Prussian Blue)
  '--color-text-disabled': OFFICIAL.blueSlate, // disabled controls

  // Interactive
  '--color-primary': OFFICIAL.smartBlue, // primary actions and interactions, the player on maps
  '--color-primary-hover': OFFICIAL.sapphire,
  '--color-primary-active': OFFICIAL.regalNavy, // pressed or active primary state, primary pixel line
  '--color-primary-soft': OFFICIAL.icyBlue, // soft blue highlights, links, section labels
  '--color-secondary': OFFICIAL.cerulean, // secondary interactive states: selected controls

  // Celestial
  '--color-accent-cyan': OFFICIAL.electricAqua, // discovery, scanning, technology
  '--color-accent-teal': OFFICIAL.tropicalTeal, // exploration and environmental states
  '--color-accent-green': OFFICIAL.emerald, // life, vegetation, positive environmental states
  '--color-accent-mint': OFFICIAL.frostedMint, // soft environmental highlights

  // Warm
  '--color-accent-warm': OFFICIAL.apricotCream, // sunlight, warmth, engine energy, other players
  '--color-accent-gold': OFFICIAL.lemonChiffon, // rare discoveries, rewards, points
  '--color-accent-bright': OFFICIAL.porcelain, // exceptional highlights, stars

  // States
  '--color-warning': OFFICIAL.petalRouge, // warnings and attention states
  '--color-danger': OFFICIAL.coralRed, // critical errors and destructive actions
  '--color-success': OFFICIAL.emerald, // successful actions and positive states
  '--color-focus': OFFICIAL.electricAqua, // keyboard focus indicators
  '--color-overlay': OFFICIAL.prussianBlue3, // modal and overlay backgrounds

  // Buttons
  '--button-primary-bg': OFFICIAL.smartBlue,
  '--button-primary-hover': OFFICIAL.sapphire,
  '--button-primary-text': OFFICIAL.porcelain,
  '--button-primary-line': OFFICIAL.regalNavy,
  '--button-secondary-bg': OFFICIAL.prussianBlue,
  '--button-secondary-hover': OFFICIAL.duskBlue,
  '--button-secondary-text': OFFICIAL.alabasterGrey,
  '--button-danger-bg': OFFICIAL.coralRed,
  '--button-danger-hover': OFFICIAL.petalRouge,
  '--button-danger-text': OFFICIAL.prussianBlue3, // Porcelain on Coral Red is 3.9:1; Prussian Blue 3 is 4.7:1
  '--button-disabled-bg': OFFICIAL.prussianBlue,
  '--button-disabled-text': OFFICIAL.blueSlate,

  // Inputs
  '--input-bg': OFFICIAL.prussianBlue,
  '--input-border': OFFICIAL.duskBlue,
  '--input-border-focus': OFFICIAL.electricAqua,
  '--input-text': OFFICIAL.porcelain,
  '--input-placeholder': OFFICIAL.lavenderGrey, // Dusty Denim on the input surface is 4.45:1; Lavender Grey is 5.6:1

  // Navigation
  '--nav-bg': OFFICIAL.inkBlack,
  '--nav-text': OFFICIAL.alabasterGrey,
  '--nav-text-active': OFFICIAL.porcelain,
  '--nav-accent': OFFICIAL.smartBlue,

  // Game HUD
  '--hud-bg': OFFICIAL.prussianBlue2,
  '--hud-border': OFFICIAL.duskBlue,
  '--hud-text': OFFICIAL.porcelain,
  '--hud-accent': OFFICIAL.electricAqua,

  // Discovery (always paired with a label or an icon)
  '--discovery-common': OFFICIAL.oceanMist,
  '--discovery-uncommon': OFFICIAL.cerulean,
  '--discovery-rare': OFFICIAL.electricAqua,
  '--discovery-exceptional': OFFICIAL.lemonChiffon,

  // Planet / environment (canonical meanings; biome ramps in universe.ts use the raw palette, 47.13)
  '--planet-water': OFFICIAL.bondiBlue,
  '--planet-ocean': OFFICIAL.oceanMist,
  '--planet-vegetation': OFFICIAL.emerald,
  '--planet-foliage-light': OFFICIAL.lightGreen,
  '--planet-ice': OFFICIAL.icyBlue,
  '--planet-sand': OFFICIAL.apricotCream,
  '--planet-sunset': OFFICIAL.petalRouge,

  // Links and selected controls
  '--link-text': OFFICIAL.icyBlue,
  '--link-hover': OFFICIAL.alabasterGrey,
  '--control-selected-bg': OFFICIAL.cerulean,
  '--control-selected-text': OFFICIAL.porcelain,
  '--control-selected-border': OFFICIAL.icyBlue, // Smart Blue would vanish on Cerulean (1.1:1)
} as const;

export type SemanticToken = keyof typeof SEMANTIC;

/**
 * Role palette for canvas and SVG code. Keys are the stable role names the renderers read; values
 * resolve through the semantic tokens (artwork-only roles point at the raw palette and say so).
 */
export const PALETTE = {
  void: SEMANTIC['--color-bg-primary'], // page and stage backgrounds
  space: OFFICIAL.prussianBlue2, // artwork only: the dark metal step of rocket hulls (47.14 blue ramp)
  deepNavy: SEMANTIC['--color-bg-secondary'], // panels, nameplate frames
  celestialBlue: SEMANTIC['--color-primary'], // primary interaction, the player
  orbitBlue: SEMANTIC['--color-primary-hover'], // stronger emphasis, galaxy arms
  sky: SEMANTIC['--color-primary-soft'], // cool information, soft highlights
  ice: SEMANTIC['--color-accent-bright'], // brightest cool light, stars
  starlight: SEMANTIC['--color-text-secondary'], // readable text on canvas
  celestialCyan: SEMANTIC['--color-accent-cyan'], // discovery and scanning
  solarGold: OFFICIAL.cream, // artwork only: yellow dwarf stars, the middle of an engine flame (47.6)
  warningCoral: SEMANTIC['--color-warning'], // attention; also the visible colour of an unmapped glyph char
  sunlitAmber: SEMANTIC['--color-accent-warm'], // sunlight, engine warmth, other players
  warmCream: SEMANTIC['--color-accent-gold'], // warm star cores, rewards
} as const;

/** 47.14 pixel-art ramps, exactly as supplied: shadow -> base -> light -> highlight. */
export const RAMPS = {
  blue: [OFFICIAL.prussianBlue3, OFFICIAL.prussianBlue2, OFFICIAL.prussianDeep, OFFICIAL.sapphire, OFFICIAL.smartBlue, OFFICIAL.icyBlue, OFFICIAL.porcelain] as const,
  ocean: [OFFICIAL.yaleBlue, OFFICIAL.balticBlue, OFFICIAL.bondiBlue, OFFICIAL.tropicalTeal, OFFICIAL.oceanMist, OFFICIAL.lightGreen2] as const,
  warm: [OFFICIAL.petalRouge, OFFICIAL.babyPink, OFFICIAL.apricotCream, OFFICIAL.lemonChiffon, OFFICIAL.porcelain] as const,
  mint: [OFFICIAL.yaleBlue, OFFICIAL.tropicalTeal, OFFICIAL.emerald, OFFICIAL.lightGreen, OFFICIAL.frostedMint] as const,
} as const;

/** Map / exploration semantics (47.10, 47.12, 47.21). Shapes and labels always accompany these colours. */
export const MAP = {
  undiscovered: SEMANTIC['--color-border'], // inactive state
  discovered: SEMANTIC['--discovery-common'], // explored, alive
  player: SEMANTIC['--color-primary'], // you, the selected system
  hazard: SEMANTIC['--color-warning'],
  otherPlayer: SEMANTIC['--color-accent-warm'], // a real person is a warm thing you find
  background: SEMANTIC['--color-bg-deep'], // the map is deep space
  star: SEMANTIC['--color-accent-bright'],
} as const;

/** Discovery colour system (47.21). Always paired with a label, icon or outline. */
export const RARITY_COLOR = {
  common: SEMANTIC['--discovery-common'],
  uncommon: SEMANTIC['--discovery-uncommon'],
  rare: SEMANTIC['--discovery-rare'],
  exotic: SEMANTIC['--discovery-exceptional'], // the game's exceptional tier
} as const;

/** Star classes -> disc colour (47.15: warm light belongs to stars and suns). */
export const STAR_COLOR = {
  'red dwarf': OFFICIAL.petalRouge,
  'orange dwarf': PALETTE.sunlitAmber,
  'yellow dwarf': PALETTE.solarGold,
  'white star': PALETTE.ice,
  'blue giant': PALETTE.sky,
} as const;

/** Every official hex, lower-cased, for tests and the colour lint. */
export const APPROVED_HEXES: ReadonlySet<string> = new Set(Object.values(OFFICIAL).map((h) => h.toLowerCase()));
