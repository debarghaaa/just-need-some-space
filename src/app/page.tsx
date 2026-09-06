import Link from 'next/link';
import { LinkButton, Panel, Tag } from '@/components/ui';
import { Reveal } from '@/components/ui/Reveal';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { HeroSolar } from '@/components/site/HeroSolar';
import { EarthArtSprite } from '@/components/game/Sprites';
import { OriginStory } from '@/components/site/OriginStory';
import { HomeDemos } from '@/components/site/HomeDemos';
import { BRAND, COPY } from '@/game/copy';
import { POINT_RULES } from '@/game/rules';
import { universeSeed } from '@/lib/env';
import { getViewer } from '@/server/profile';
import { isBackendConfigured } from '@/lib/env';

export default async function HomePage() {
  const viewer = isBackendConfigured() ? await getViewer() : null;
  const seed = universeSeed();
  const enterHref = '/universe';
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">A multiplayer pixel universe</p>
            <h1>
              JUST NEED SOME SPACE<span className="period">.</span>
            </h1>
            <p className="lede">A multiplayer pixel-art universe where you build your rocket, explore strange worlds, collect resources, meet other explorers, and find somewhere that feels like yours.</p>
            <div className="hero-ctas">
              <LinkButton href={enterHref} variant="primary" size="lg">
                Enter the universe <PixelIcon name="arrow" size={12} />
              </LinkButton>
              <LinkButton href="/how-it-works" variant="ghost" size="lg">
                How it works
              </LinkButton>
            </div>
            {!viewer ? <p className="small muted" style={{ margin: '0.75rem 0 0' }}>No account needed to start. You get a guest explorer straight away and can add an email later.</p> : null}
            <div className="hero-status" aria-live="off">
              <EarthArtSprite scale={1} className="hero-status-earth" label="Earth, in pixels. You are on it." />
              <div className="hero-status-copy">
                <span className="display-xs">{COPY.landing.head}</span>
                <small>{COPY.landing.sub}</small>
              </div>
            </div>
          </div>
          <HeroSolar seed={seed} />
        </div>
      </section>

      <section className="section" id="gameplay">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">Core loop</p>
            <h2>Build. Launch. Land. Look around. Leave a mark.</h2>
            <p className="lede">Five things, in order. Everything else in the game is one of these five wearing a different hat.</p>
          </Reveal>
          <ol className="step-list" style={{ marginTop: '2rem', maxWidth: 720 }}>
            {[
              ['Build your rocket', 'Eight hulls, from a stubby classic to a wide delta wing, three engines, three fins, eight swatches across five colour regions, three decals. Every combination renders instantly as pixel art and is saved to your account.'],
              ['Pick a system', 'One galaxy, five star systems to start with. Every system is generated from a seed, so the planet you found is the same planet your friend will find.'],
              ['Land on a planet', 'Each world has a biome, gravity, temperature, an atmosphere of some description, resources and a handful of points of interest.'],
              ['Scan and collect', 'Walk around on foot. Scan formations, ruins, signals, flora, creatures and anomalies. Collect common, rare and exotic resources.'],
              ['Meet other explorers', 'Anyone in the same system or on the same planet shows up as themselves: their rocket, their name. Wave. Or don\u2019t.'],
            ].map(([head, body]) => (
              <Reveal as="li" key={head}>
                <strong>{head}</strong>
                <span className="dim">{body}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <HomeDemos seed={seed} />

      <section className="section" id="multiplayer">
        <div className="wrap">
          <div className="feature">
            <Reveal>
              <p className="eyebrow">Multiplayer</p>
              <h2>Other people. In moderation.</h2>
              <p>Everyone plays in the same universe. When you are in orbit around a star or standing on a planet, the other real players in that same place are shown with their actual rocket and their actual name, updated live from the server.</p>
              <p>Get close to someone and a small prompt appears: <span className="mono warm">{COPY.playerDetected}</span>. You can approach, wave, or send a friend invite. That is the entire social system for now. No chat. No trading. No guilds. It is a quiet universe on purpose.</p>
              <div className="row" style={{ marginTop: '1rem' }}>
                <Tag kind="player">Real player</Tag>
                <Tag kind="system">System</Tag>
                <Tag kind="proc">Generated</Tag>
              </div>
              <p className="small muted" style={{ marginTop: '0.75rem' }}>Every entity in the game is labelled as one of these three, so you always know whether you are talking to a person, the game, or a rock.</p>
            </Reveal>
            <Reveal>
              <div className="feature-art" style={{ display: 'block' }}>
                <div className="dialogue" style={{ maxWidth: 360, margin: '0 auto' }}>
                  <div className="dialogue-head warm">{COPY.playerDetected}</div>
                  <div className="dialogue-sub">
                    <span className="display-xs" style={{ color: 'var(--color-text-secondary)' }}>wren_ok</span> <Tag kind="player">Real player</Tag>
                  </div>
                  <div className="row" style={{ marginTop: '0.75rem' }}>
                    <span className="btn btn-sm btn-secondary" aria-hidden="true">Approach</span>
                    <span className="btn btn-sm" aria-hidden="true">Wave</span>
                    <span className="btn btn-sm btn-ghost" aria-hidden="true">Invite</span>
                  </div>
                </div>
                <p className="small muted" style={{ textAlign: 'center', marginTop: '1rem', marginBottom: 0 }}>What the prompt looks like in play. Preview only.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="points">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">Points</p>
            <h2>Scored by the server, not by you.</h2>
            <p className="lede">Every discovery is written to the database once and paid once. The values below are the actual rules the server uses.</p>
          </Reveal>
          <Reveal>
            <Panel tight raised className="mono" as="div">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th className="num">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Discover a planet', POINT_RULES.planet_discovered],
                    ['Visit a new system', POINT_RULES.system_visited],
                    ['Fully scan a planet', POINT_RULES.planet_fully_scanned],
                    ['Discover a point of interest', POINT_RULES.site_discovered],
                    ['Collect a common resource', POINT_RULES.resource_common],
                    ['Collect a rare resource', POINT_RULES.resource_rare],
                    ['Collect an exotic resource', POINT_RULES.resource_exotic],
                  ].map(([label, pts]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="num amber">+{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Reveal>
        </div>
      </section>

      <section className="section" id="origin">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow" style={{ textAlign: 'center' }}>{COPY.origin.heading}</p>
          </Reveal>
          <OriginStory />
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2>{viewer ? 'Your rocket is where you left it.' : 'Ready to leave?'}</h2>
            <p className="lede" style={{ marginInline: 'auto' }}>
              {viewer ? 'The universe has not changed. That is rather the point of it.' : `${BRAND} is free to play. An account keeps your rocket, your discoveries and your points.`}
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <LinkButton href={enterHref} variant="primary" size="lg">
                Enter the universe <PixelIcon name="arrow" size={12} />
              </LinkButton>
              {!viewer ? (
                <Link href="/login" className="btn btn-ghost btn-lg">
                  I already have an account
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
