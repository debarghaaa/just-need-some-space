/**
 * Every line of interface copy in one place. Headline first, supporting line second.
 * Rules: no em dashes anywhere, functional labels stay functional, humor lives in the second line.
 */
export const BRAND = 'JUST NEED SOME SPACE.';

export const COPY = {
  landing: { head: 'YOU ARE CURRENTLY ON EARTH.', sub: 'Unfortunately.' },
  planetCreate: { head: 'NAME YOUR PLANET.', sub: 'Please choose something better than Earth.' },
  joinMultiplayer: { head: 'OTHER PEOPLE DETECTED.', sub: 'Do you still wish to proceed?' },
  launch: { head: 'ESCAPE ROUTE CALCULATED.', sub: 'Destination: somewhere else.' },
  planetFound: { head: 'NEW WORLD FOUND.', sub: 'Finally. Some peace and quiet.' },
  friendInvite: { head: 'ARE YOU SURE?', sub: 'You just escaped everyone.' },
  returnEarth: { head: 'WHY ARE WE GOING BACK?' },

  signalLost: { head: 'SIGNAL LOST.', sub: 'The universe is still here. Your connection isn\u2019t.' },
  reconnect: 'RECONNECT',
  saveFailed: { head: 'THAT DISCOVERY DIDN\u2019T STICK.', sub: 'Try saving it again.' },

  emptyCodex: { head: 'NOT MUCH HERE YET.', sub: 'Go find something strange.' },
  emptyInventory: { head: 'YOUR SHIP IS SUSPICIOUSLY EMPTY.' },
  emptyDiscoveries: { head: 'YOU HAVEN\u2019T FOUND ANYTHING YET.', sub: 'That\u2019s okay. Space is quite large.' },
  emptyFriends: { head: 'NO ONE YET.', sub: 'Which was sort of the point. Invites arrive here.' },
  nobodyNearby: { head: 'NOBODY ELSE HERE.', sub: 'Enjoy it while it lasts.' },

  loading: ['CALCULATING ORBIT...', 'LOOKING FOR SOMEWHERE ELSE...', 'SCANNING THE VERY LARGE AMOUNT OF NOTHING...', 'GENERATING A PLANET YOU DEFINITELY DID NOT ASK FOR...'],

  playerDetected: 'PLAYER DETECTED',

  customize: {
    title: 'CUSTOMIZE YOURSELF',
    rocket: 'MAKE THE ROCKET YOURS',
    astronaut: 'PICK SOMETHING THAT LOOKS LIKE YOU',
    name: 'PLAYER NAME',
    nameHint: 'WHAT SHOULD EVERYONE ELSE CALL YOU?',
    save: 'SAVE CHANGES',
    saved: { head: 'CONFIGURATION SAVED.', sub: 'Looks like yours now.' },
    failed: { head: 'COULDN\u2019T SAVE THAT.', sub: 'The universe forgot for a second.' },
    retry: 'TRY AGAIN',
  },

  guest: {
    entering: { head: 'NO ACCOUNT NEEDED.', sub: 'A guest explorer is being issued. You can add an email later to keep it.' },
    failed: { head: 'COULDN\u2019T OPEN THE DOOR.', sub: 'Guest access is unavailable right now. You can still log in or create an account.' },
    blocked: 'The browser did not store the session cookie. Allow cookies for this site and try again.',
    bounced: 'A guest session was issued but the server never received it. Allow cookies for this site and try again.',
    tag: 'Guest',
    logoutWarning: { head: 'THIS EXPLORER HAS NO PASSWORD.', sub: 'Logging out loses this rocket, these points and this planet for good. Add an email and password in Settings first if you want to keep them.' },
  },

  origin: {
    heading: 'THE REASON THIS EXISTS',
    paragraphs: [
      ['It started with a story.'],
      ['A sentence.', 'A tiny digital cry for help.'],
      ['\u201cYou all irritate me. I need my own planet.\u201d'],
      ['Fair enough.'],
      ['So we did the most reasonable thing possible.'],
      ['We built one.'],
      [
        'Then one became a solar system.',
        'The solar system became a galaxy.',
        'The galaxy became a place where you could build rockets, discover strange worlds, meet people who don\u2019t irritate you (fortunately), disappear for a while, and make somewhere that feels entirely yours.',
      ],
      ['JUST NEED SOME SPACE. isn\u2019t really about escaping Earth.'],
      ['It\u2019s about having somewhere else to go.'],
      ['Somewhere quiet.', 'Somewhere weird.', 'Somewhere you can name a moon after your worst enemy and then immediately forget why you were angry.'],
      ['Welcome to somewhere else.'],
    ],
  },
} as const;

export function loadingLine(seed: number): string {
  return COPY.loading[Math.abs(seed) % COPY.loading.length];
}

/**
 * Loading copy catalogue (section 44). General pool, context pools, and a small rare pool.
 * Some lines have a natural follow-up; the rotation honours those so the jokes land in order.
 * The catalogue is kept intact for reference; by request the loading screen itself shows only the
 * single word HARNESSMOGGING (see components/site/LoadingScreen.tsx).
 */
export const LOADING = {
  general: [
    'HARNESSMOGGING...',
    'CALCULATING WHERE WE LEFT THE ROCKET...',
    'ASKING THE UNIVERSE NICELY...',
    'LOOKING FOR SOMEWHERE BETTER...',
    'COOLING THE ENGINES...',
    'WARMING UP THE REGRETS...',
    'CHECKING THE ORBIT...',
    'ASKING SPACE FOR DIRECTIONS...',
    'COUNTING THE STARS. LOST COUNT.',
    'GENERATING SOMETHING PROBABLY UNNECESSARY...',
    'ESCAPING EARTH...',
    'STILL ESCAPING EARTH...',
    'ALMOST FAR ENOUGH AWAY...',
    'SEARCHING FOR A QUIETER PLANET...',
    'CALIBRATING THE VIBES...',
    'LOADING THE VERY LARGE AMOUNT OF NOTHING...',
    'MAKING SURE THIS IS ACTUALLY A PLANET...',
    'REMEMBERING WHERE WE PARKED...',
    'DEFINITELY NOT GOING BACK TO EARTH...',
    'ASKING THE ROCKET TO BEHAVE...',
    'CALCULATING ORBITAL NONSENSE...',
    'CHECKING FOR OTHER PEOPLE...',
    'OH NO. OTHER PEOPLE.',
    'PRETENDING THAT WAS INTENTIONAL...',
    'SCANNING THE COSMOS...',
    'LOOKING FOR SOMETHING WEIRD...',
    'SUMMONING A NEW PLANET...',
    'POLITELY IGNORING GRAVITY...',
    'PACKING SOME SPACE SNACKS...',
    'THIS SEEMS IMPORTANT.',
    'PROBABLY.',
  ],
  context: {
    universe: ['OPENING THE DOOR...', 'LOOKING FOR SOMEWHERE ELSE...', 'LEAVING EARTH BEHIND...'],
    system: ['CALCULATING ORBIT...', 'FINDING THE GOOD PLANETS...', 'CHECKING THE LOCAL COSMIC TRAFFIC...'],
    planet: ['DROPPING OUT OF ORBIT...', 'LOOKING FOR A SAFE PLACE TO LAND...', 'LANDING SOMEWHERE THAT DEFINITELY EXISTS...'],
    terrain: ['PAINTING THE PLANET PIXEL BY PIXEL...', 'ADDING ROCKS FOR SOME REASON...', 'GENERATING SOMETHING STRANGE...'],
    multiplayer: ['SEARCHING FOR OTHER EXPLORERS...', 'CHECKING WHO ELSE IS OUT THERE...', 'OH. SOMEONE FOUND YOU.'],
    saving: ['WRITING THAT DOWN...', 'ADDING IT TO THE CODEX...', 'PROOF THAT YOU WERE ACTUALLY THERE...'],
  },
  rare: [
    'YOU ARE THE FIRST PERSON TO SEE THIS MESSAGE.',
    'THIS PLANET HAS NEVER SEEN YOU BEFORE.',
    'WE DEFINITELY KNOW WHAT WE\u2019RE DOING.',
    'DO NOT THINK ABOUT HOW LARGE SPACE IS.',
    'EARTH IS STILL THERE. SORRY.',
    'YOU COULD ALWAYS TURN BACK.',
    'BUT WHY WOULD YOU?',
    'SOMEWHERE OUT THERE, SOMEONE IS ALSO AVOIDING EARTH.',
  ],
  followUp: {
    'ESCAPING EARTH...': 'STILL ESCAPING EARTH...',
    'STILL ESCAPING EARTH...': 'ALMOST FAR ENOUGH AWAY...',
    'CHECKING FOR OTHER PEOPLE...': 'OH NO. OTHER PEOPLE.',
    'OH NO. OTHER PEOPLE.': 'PRETENDING THAT WAS INTENTIONAL...',
    'THIS SEEMS IMPORTANT.': 'PROBABLY.',
    'YOU COULD ALWAYS TURN BACK.': 'BUT WHY WOULD YOU?',
  } as Record<string, string>,
  subline: 'somewhere else, obviously',
  longWait: { line: 'Still working.', head: 'DON\u2019T WORRY. SPACE IS PATIENT.' },
  back: 'BACK',
  cancel: 'CANCEL',
} as const;

export type LoadingContext = keyof typeof LOADING.context | 'generic';

const RARE_CHANCE = 0.06;

/** Next line for a loading rotation. Context lines lead, general lines follow, rare lines are rare. */
export function nextLoadingLine(ctx: LoadingContext, prev: string | null, shown: number, random: () => number = Math.random): string {
  if (prev && LOADING.followUp[prev]) return LOADING.followUp[prev];
  const contextual: readonly string[] = ctx === 'generic' ? [] : LOADING.context[ctx];
  // The first line is deterministic (context opener, or HARNESSMOGGING) so server and client agree.
  if (shown === 0) return contextual[0] ?? LOADING.general[0];
  if (random() < RARE_CHANCE) {
    const r = LOADING.rare[Math.floor(random() * LOADING.rare.length)];
    if (r !== prev && !isFollowUp(r)) return r;
  }
  // Alternate contextual and general so a system load still feels like a system load.
  const useContext = contextual.length > 0 && shown % 2 === 1;
  const pool: readonly string[] = useContext ? contextual : LOADING.general;
  let pick = pool[Math.floor(random() * pool.length)];
  if (pick === prev) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
  // Never start mid-sequence: walk back to the opener of a chain.
  for (let guard = 0; guard < 4 && isFollowUp(pick); guard++) pick = Object.keys(LOADING.followUp).find((k) => LOADING.followUp[k] === pick) ?? pick;
  return pick;
}

function isFollowUp(line: string): boolean {
  return Object.values(LOADING.followUp).includes(line);
}
