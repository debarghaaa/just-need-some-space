'use client';
import { useMemo, useState } from 'react';
import { Reveal } from '@/components/ui/Reveal';
import { Tag } from '@/components/ui';
import { PlanetSprite, RocketSprite } from '@/components/game/Sprites';
import { BODIES, COLORS, ENGINES, FINS, type RocketConfig } from '@/game/rockets';
import { generateSystem, RARITY_LABEL } from '@/game/universe';

/** The configurator opens on a soft colourway: Icy Blue hull, Smart Blue nose and fins, Cream porthole and band, warm bell. */
const HOME_ROCKET: RocketConfig = { body: 'stub', engine: 'single', fins: 'swept', color: 'cream', accent: 'ochre', decal: 'none', engineColor: 'ochre', finColor: 'slate', decalColor: 'sky' };

/** Two interactive previews on the homepage: a live rocket configurator and a generated planet strip. */
export function HomeDemos({ seed }: { seed: string }) {
  const [cfg, setCfg] = useState<RocketConfig>(HOME_ROCKET);
  const system = useMemo(() => generateSystem(seed, 1), [seed]);
  const cycle = <K extends keyof RocketConfig>(key: K, list: ReadonlyArray<{ id: RocketConfig[K] }>) => {
    const i = list.findIndex((o) => o.id === cfg[key]);
    setCfg({ ...cfg, [key]: list[(i + 1) % list.length].id });
  };
  return (
    <>
      <section className="section" id="rocket">
        <div className="wrap feature">
          <Reveal>
            <p className="eyebrow">Rocket customization</p>
            <h2>Your rocket, drawn one pixel at a time.</h2>
            <p>Parts snap together on a 24 by 32 grid. Change anything and the sprite redraws instantly. This is the same renderer the game uses for your rocket on the system map and for other players in orbit.</p>
            <div className="opts" style={{ marginTop: '1rem' }}>
              <button type="button" className="opt" onClick={() => cycle('body', BODIES)}>Body: {BODIES.find((b) => b.id === cfg.body)!.name}</button>
              <button type="button" className="opt" onClick={() => cycle('engine', ENGINES)}>Engine: {ENGINES.find((b) => b.id === cfg.engine)!.name}</button>
              <button type="button" className="opt" onClick={() => cycle('fins', FINS)}>Fins: {FINS.find((b) => b.id === cfg.fins)!.name}</button>
              <button type="button" className="opt" onClick={() => cycle('color', COLORS)}>
                <span className="opt-swatch" style={{ background: COLORS.find((c) => c.id === cfg.color)!.hex }} />
                Hull: {COLORS.find((b) => b.id === cfg.color)!.name}
              </button>
            </div>
            <p className="small muted" style={{ marginTop: '0.75rem' }}>Preview only. Enter the universe to save a rocket to your explorer.</p>
          </Reveal>
          <Reveal>
            <div className="feature-art">
              <RocketSprite config={cfg} scale={7} flame={1} label="Rocket preview" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" id="planets">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">Planet exploration</p>
            <h2>{system.name}: {system.planets.length} worlds, none of them Earth.</h2>
            <p className="lede">Generated from the seed, drawn from a controlled palette. Land, walk, scan the strange bits, pick up what is lying around, leave when you feel like it.</p>
          </Reveal>
          <div className="grid-3" style={{ marginTop: '1.5rem' }}>
            {system.planets.map((p) => (
              <Reveal key={p.id}>
                <div className="panel panel-tight" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <PlanetSprite planet={p} chunk={2} radius={22} label={`${p.name}, ${p.biome}`} />
                  <div>
                    <div className="display-xs" style={{ marginBottom: '0.3rem' }}>{p.name}</div>
                    <div className="small dim">{p.biome}, {p.temperature} C, {p.gravity.toFixed(2)} g</div>
                    <div style={{ marginTop: '0.4rem' }}>
                      <Tag kind={p.rarity}>{RARITY_LABEL[p.rarity]}</Tag>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
