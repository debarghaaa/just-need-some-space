import type { Metadata } from 'next';
import { OriginStory } from '@/components/site/OriginStory';
import { LinkButton, Panel } from '@/components/ui';
import { AstronautIcon } from '@/components/game/Sprites';
import { BRAND, COPY } from '@/game/copy';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="wrap">
      <div className="page-head about-head">
        <div className="about-head-copy">
          <p className="eyebrow">About</p>
          <h1>{BRAND}</h1>
          <p className="lede">A small multiplayer universe made of pixels, built for people who occasionally need to not be on Earth for a bit.</p>
        </div>
        <AstronautIcon scale={4} className="about-head-icon" label="An explorer in a pale blue suit, waving" />
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <p className="eyebrow" style={{ textAlign: 'center' }}>{COPY.origin.heading}</p>
        <OriginStory />
      </section>

      <section className="section">
        <div className="grid-2">
          <Panel title="What it is">
            <p className="dim">A shared, seeded galaxy. Rockets you assemble from pixel parts. Planets you land on, walk across, scan and pick things up from. A Codex that remembers who found what first. Other explorers who show up as themselves. Points that the server keeps, not you.</p>
          </Panel>
          <Panel title="What it is not">
            <p className="dim">Not a shooter. Not a trading sim. No chat, no guilds, no housing, no economy, no loot boxes. The scope is deliberately small so that everything in it actually works.</p>
          </Panel>
          <Panel title="How it is made">
            <p className="dim">Every sprite is drawn at runtime from small grids and deterministic noise. No photographs, no generated images, no 3D. The interface uses a fixed palette: void black, deep navy, celestial blue, sky, ice and starlight, with a little cyan, gold, orange and coral for the things that matter.</p>
          </Panel>
          <Panel title="Where it is going">
            <p className="dim">The generator already takes any system index; the five-system limit is a single constant. More systems, more biomes and more things to find are the obvious next steps. Nothing is promised until it ships.</p>
          </Panel>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <LinkButton href="/how-it-works" variant="ghost" size="lg">How it works</LinkButton>{' '}
        <LinkButton href="/universe" variant="primary" size="lg">Enter the universe</LinkButton>
      </section>
    </div>
  );
}
