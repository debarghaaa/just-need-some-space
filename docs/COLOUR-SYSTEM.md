# Colour system: the official website colour system (spec 47)

`src/game/palette.ts` is the single source of truth. `OFFICIAL` holds the 47 supplied colours
(47.1 to 47.7) under unique names; `PALETTE`, `MAP`, `RARITY_COLOR`, `STAR_COLOR` and `RAMPS`
assign them to roles. `src/styles/globals.css` mirrors the role colours as CSS tokens. Canvas and
SVG code import the TypeScript values directly. `tests/palette.test.ts` fails the build on any hex
or `rgba()` literal outside the supplied set, on any computed colour (`color-mix`, `lighten`), on a
purple-derived colour reaching a token, button or swatch, and on any contrast pair below the floor.

Identity: deep navy + celestial blues + teal and sea-green + controlled pastel accents + warm
celestial highlights. Blue is space, teal is life, cyan is discovery, warm is energy, pastel is
strangeness (47.15).

## Foundation and hierarchy (47.1, 47.2, 47.8)

| Role | Official colour | Hex | Token | Where |
| --- | --- | --- | --- | --- |
| Page and game background | Ink Black | `#0d1b2a` | `--bg-0` | body, nav foundation, loading screen, stage backgrounds |
| Panels, cards, HUD | Prussian Blue | `#1b263b` | `--bg-1` | panels, inputs, nav drawer, secondary buttons |
| Inset rows and wells | Prussian Blue 2 | `#001845` | `--bg-2` / `--space` | stat wells, tags, planet rows, toasts, map and planet skies |
| Hover surface, secondary panels | Regal Navy | `#023e7d` | `--bg-3` | structural hover, secondary-button hover |
| Borders and inactive states | Dusk Blue | `#415a77` | `--line-strong` | panel borders, input borders, undiscovered map objects |
| Quiet separators | Prussian Blue | `#1b263b` | `--line` | section rules, table rules |
| Primary text | Alabaster Grey | `#e0e1dd` | `--ink` | body, headings |
| Secondary text | Lavender Grey | `#979dac` | `--ink-dim` | ledes, labels, hints (5.6:1 on panels) |
| Subdued text, secondary nav | Dusty Denim | `#778da9` | `--ink-mute` | nav links, footer links, disabled (5.1:1 on Ink Black) |
| Primary interaction | Smart Blue | `#0466c8` | `--blue-2` | primary buttons, current nav underline, selection, the player on maps |
| Hover, map highlights | Sapphire | `#0353a4` | `--blue-3` | button hover, galaxy arms |
| Selected controls | Cerulean | `#1a759f` | `--blue-4` | pressed options, selected tab, selected swatch, selected planet row |
| Cool information | Icy Blue | `#a9def9` | `--sky` | links, panel titles, focus ring, selected map labels |
| Brightest cool light | Porcelain | `#fffffc` | `--sky-2` / `--ice` | stars, primary-button text, selected-surface text |

Balance target (47.9): 60 to 70% deep blue and navy, 15 to 20% celestial blue and ocean,
10 to 15% environmental colour (inside planets), 3 to 8% warm and pastel accents.

## Semantic accents (47.3, 47.6, 47.12, 47.19)

| Meaning | Official colour | Hex | Token |
| --- | --- | --- | --- |
| Discovery, scanning, unusual | Electric Aqua | `#9bf6ff` | `--cyan` |
| Rarity, rewards, stars | Cream | `#fdffb6` | `--amber` |
| Warm light, other players, engines | Apricot Cream | `#ffd6a5` | `--amber-2` / `--orange` |
| Discovery markers on maps (visited stars, found planets) | Ocean Mist | `#52b69a` | `--green` |
| Importance: warm rarity highlight, first finds | Lemon Chiffon | `#fcf6bd` | `--warm-cream` |
| Warning, danger, destructive | Petal Rouge | `#e27396` | `--red` |
| Warnings (tags, toasts, notices), danger hover | Pink Mist | `#ea9ab2` | `--red-2` |
| Success, positive state, common finds | Ocean Mist | `#52b69a` | `--green` |
| Environmental, biological | Emerald | `#76c893` | `--green-2` |
| Exploration highlight, uncommon finds | Tropical Teal | `#34a0a4` | `--teal` |

Rarity (47.12): COMMON Ocean Mist, UNCOMMON Tropical Teal, RARE Electric Aqua, EXCEPTIONAL Cream.
Every rarity is also written as a label and drawn as a distinct 12 px icon; colour is never alone.

Stars (47.15): red dwarf Petal Rouge, orange dwarf Apricot Cream, yellow dwarf Cream, white star
Porcelain, blue giant Icy Blue. Warm stars have a Lemon Chiffon core; cool stars a Porcelain core.

## Buttons (47.11)

Primary: Smart Blue fill, Porcelain text, Regal Navy pixel line; hover Sapphire. Secondary:
Prussian Blue fill, Alabaster text, Dusk Blue line; hover Regal Navy. Ghost: transparent, Porcelain
text. Selected: Cerulean fill with Porcelain text. Danger: Petal Rouge with Ink Black text, hover
Pink Mist. Positive: Ocean Mist with Ink Black text, hover Emerald. All rectangular, no gradients.

## Customization swatches (47.10)

Eight stable swatch ids shared by rocket regions and suit parts: Icy Blue, Emerald, Dusty Denim, Smart
Blue, Prussian Blue, Teal, Cream, Electric Aqua. Primary suits favour Prussian Blue / Dusty Denim / Smart
Blue; secondary parts may use Teal, Emerald, Icy Blue; Cream and Electric Aqua are the accents. Every
shade and highlight is an official colour (no computed tints).

## Planets (47.13, 47.14)

Each biome carries one or two palettes `{ ramp: [shadow, base, light, highlight], ground, sky }`;
`ground` and `sky` are always one of the deep official blues, so the walkable surface and the space
behind a planet stay in the foundation family. Archetypes: ocean (Prussian Blue 3, Baltic, Cerulean,
Ocean Mist / Yale, Bondi, Tropical Teal, Icy Aqua), forest (Regal Navy, Emerald, Light Green, Tea
Green), flower (Regal Navy, Emerald, Baby Pink, Frosted Mint), ice (Ink Black, Prussian Blue, Baby
Blue Ice, Icy Blue, Porcelain), desert (Prussian Blue, Petal Rouge, Apricot Cream, Cream / Dust
Grey), twilight (Prussian Blue 2, Cerulean, Periwinkle, Baby Blue Ice, Cream), strange alien (Regal
Navy, Tropical Teal, Electric Aqua / Mauve, Lemon Chiffon), cinder (warm ramp), clay canyon (Pink
Mist, Cotton Rose, Dust Grey) and two quiet slate worlds. Periwinkle and Mauve only ever occupy the
light or highlight step, never shadow, base, ground or sky.

Ramps exported from `RAMPS` are the supplied ones verbatim: blue, ocean, warm, mint.

## Accessibility (47.18)

Measured pairs (WCAG relative luminance): Alabaster on Ink Black 13.2:1, on Prussian Blue 11.5:1;
Lavender Grey on Prussian Blue 5.6:1; Dusty Denim on Ink Black 5.1:1 (never used on panels for
small text); Porcelain on Smart Blue 5.6:1, on Sapphire 7.5:1, on Cerulean 5.1:1; Ink Black on Petal
Rouge 5.9:1, on Ocean Mist 7.0:1; Electric Aqua, Cream, Petal Rouge, Icy Blue, Emerald and Apricot
Cream all above 4.5:1 on panels; the Icy Blue focus ring is above 3:1 on every surface including
the primary button. Errors, rarity, presence and discovery state always carry a label, icon or
outline as well as a colour.

## Not used

No neon purple, magenta or hot pink glow; no purple-blue gradients; no `color-mix`, no computed
tints; no pills. Mauve, Mauve 2 and Periwinkle exist only as single accent steps inside two planet
palettes.
