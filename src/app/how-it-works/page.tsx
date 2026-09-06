import type { Metadata } from 'next';
import { LinkButton, Panel, Tag } from '@/components/ui';
import { Reveal } from '@/components/ui/Reveal';
import { COPY } from '@/game/copy';
import { POINT_RULES } from '@/game/rules';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">How it works</p>
        <h1>THE WHOLE GAME, HONESTLY EXPLAINED.</h1>
        <p className="lede">No hidden systems. Here is exactly what happens when you play, what is stored, and what is not.</p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <ol className="step-list" style={{ maxWidth: 760 }}>
          {[
            ['Create an account', 'Email and password through Supabase Auth. Your session persists between visits. Password reset is by email link.'],
            ['Name your planet', `${COPY.planetCreate.head} ${COPY.planetCreate.sub} This is your home base name and shows on your profile.`],
            ['Build a rocket', 'Pick a body, engine, fins, hull colour, accent colour and decal. The pixel preview updates instantly. Saving writes it to your account; other players see it in orbit.'],
            ['Open the universe', 'One galaxy with five star systems. Each system is generated from a fixed seed, so everyone sees the same universe. Unvisited systems show only how many planets are signalling.'],
            ['Travel to a system', `The first time you enter a system it is recorded as a discovery and pays ${POINT_RULES.system_visited} points. The system map shows planets on their orbits; discovered ones are drawn in full, unknown ones dimmed.`],
            ['Land on a planet', `Landing identifies the planet, records it in the Codex with you as the discoverer, and pays ${POINT_RULES.planet_discovered} points. If nobody has landed there before, the Codex marks it as your first find.`],
            ['Walk, scan, collect', `On the surface you walk with WASD or arrows (or the touch pad). Stand next to a point of interest and press E to scan it (${POINT_RULES.site_discovered} points). Scan every site on a planet for a ${POINT_RULES.planet_fully_scanned} point bonus. Resource nodes pay ${POINT_RULES.resource_common}, ${POINT_RULES.resource_rare} or ${POINT_RULES.resource_exotic} points for common, rare and exotic and go to your inventory.`],
            ['Meet people', `Anyone in the same system or on the same planet appears as themselves. Get close and you see ${COPY.playerDetected}: approach, wave, or send a friend invite. Friends are listed on your profile.`],
            ['Leave when you like', 'Return to orbit, pick another planet or system. Your discoveries, inventory and points stay.'],
          ].map(([head, body]) => (
            <Reveal as="li" key={head}>
              <strong>{head}</strong>
              <span className="dim">{body}</span>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="grid-2">
          <Panel title="What is stored">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }} className="dim">
              <li>Your account (email, password hash) in Supabase Auth.</li>
              <li>Profile: username, display name, home planet name.</li>
              <li>Your rocket configuration.</li>
              <li>Discoveries: which systems, planets, sites and resources you found, and when.</li>
              <li>Inventory quantities and a points ledger.</li>
              <li>Friend invites and friendships.</li>
              <li>Presence: where you are right now, refreshed every few seconds while you play and removed when you leave.</li>
            </ul>
          </Panel>
          <Panel title="What is not stored">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }} className="dim">
              <li>The universe itself. Planets are regenerated from the seed every time; only your interactions with them are saved.</li>
              <li>Chat messages. There is no chat.</li>
              <li>Analytics profiles or advertising identifiers. There are none.</li>
            </ul>
          </Panel>
        </div>
      </section>

      <section className="section">
        <h2>Who is who</h2>
        <p className="dim">Everything you meet is labelled so you know what it is.</p>
        <div className="grid-3">
          <Panel tight><Tag kind="player">Real player</Tag><p className="small dim" style={{ margin: '0.5rem 0 0' }}>Another signed-in person, shown with their real username and rocket, updated live.</p></Panel>
          <Panel tight><Tag kind="system">System</Tag><p className="small dim" style={{ margin: '0.5rem 0 0' }}>Messages from the game itself: prompts, logs, errors.</p></Panel>
          <Panel tight><Tag kind="proc">Generated</Tag><p className="small dim" style={{ margin: '0.5rem 0 0' }}>Planets, sites, creatures and resources produced from the seed. Interesting, but not people.</p></Panel>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <LinkButton href="/signup" variant="primary" size="lg">Enter the universe</LinkButton>
      </section>
    </div>
  );
}
