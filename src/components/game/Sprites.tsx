'use client';
import { useEffect, useRef } from 'react';
import { drawAstronautIcon, drawEarth, drawEarthArt, drawHeroRocket, drawPlanet, drawRocket, drawStar } from '@/game/pixel';
import type { RocketConfig } from '@/game/rockets';
import type { Planet } from '@/game/universe';
import { ASTRONAUT_ICON_H, ASTRONAUT_ICON_W } from '@/game/astronaut-art';
import { HERO_ROCKET_H, HERO_ROCKET_W } from '@/game/hero-rocket-art';

/** Canvas-backed sprites. Rendered client-side from seeds; nothing is fetched. */

function useCanvasPaint(paint: (target: HTMLCanvasElement) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    paint(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function blit(target: HTMLCanvasElement, src: HTMLCanvasElement) {
  target.width = src.width;
  target.height = src.height;
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
}

export function RocketSprite({ config, scale = 4, flame = 0, className, label }: { config: RocketConfig; scale?: number; flame?: 0 | 1 | 2; className?: string; label?: string }) {
  const ref = useCanvasPaint((t) => blit(t, drawRocket(config, scale, flame)), [config.body, config.engine, config.fins, config.color, config.accent, config.decal, config.engineColor, config.finColor, config.decalColor, scale, flame]);
  return <canvas ref={ref} className={className} role={label ? 'img' : 'presentation'} aria-label={label} style={{ width: 24 * scale, height: 32 * scale }} />;
}

export function PlanetSprite({ planet, chunk = 2, radius, className, label, style }: { planet: Planet; chunk?: number; radius?: number; className?: string; label?: string; style?: React.CSSProperties }) {
  const ref = useCanvasPaint((t) => blit(t, drawPlanet(planet, chunk, radius)), [planet.id, chunk, radius]);
  return <canvas ref={ref} className={className} role={label ? 'img' : 'presentation'} aria-label={label} style={style} />;
}

export function StarSprite({ color, radius, chunk = 2, className, style }: { color: string; radius: number; chunk?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useCanvasPaint((t) => blit(t, drawStar(color, radius, chunk)), [color, radius, chunk]);
  return <canvas ref={ref} className={className} aria-hidden="true" style={style} />;
}

/** The homescreen rocket: a chunky cartoon ship (hero-rocket-art.ts), drawn at an integer scale. */
export function HeroRocketSprite({ scale = 2, className, label }: { scale?: number; className?: string; label?: string }) {
  const ref = useCanvasPaint((t) => blit(t, drawHeroRocket(scale)), [scale]);
  return <canvas ref={ref} className={className} role={label ? 'img' : 'presentation'} aria-label={label} aria-hidden={label ? undefined : true} style={{ width: HERO_ROCKET_W * scale, height: HERO_ROCKET_H * scale }} />;
}

/** The explorer icon from the supplied astronaut artwork, drawn at an integer scale. */
export function AstronautIcon({ scale = 2, className, label }: { scale?: number; className?: string; label?: string }) {
  const ref = useCanvasPaint((t) => blit(t, drawAstronautIcon(scale)), [scale]);
  return (
    <canvas
      ref={ref}
      className={className}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: ASTRONAUT_ICON_W * scale, height: ASTRONAUT_ICON_H * scale }}
    />
  );
}

/** The supplied Earth artwork, drawn at an integer scale so every pixel stays square. */
export function EarthArtSprite({ scale = 1, className, label = 'Earth, in pixels' }: { scale?: number; className?: string; label?: string }) {
  const ref = useCanvasPaint((t) => blit(t, drawEarthArt(scale)), [scale]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ width: 62 * scale, height: 62 * scale }} />;
}

export function EarthSprite({ scale = 3, className }: { scale?: number; className?: string }) {
  const ref = useCanvasPaint((t) => blit(t, drawEarth(scale)), [scale]);
  return <canvas ref={ref} className={className} role="img" aria-label="Earth, in pixels" />;
}
