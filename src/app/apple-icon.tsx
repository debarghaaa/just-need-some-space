import { ImageResponse } from 'next/og';
import { SEMANTIC } from '@/game/palette';
import { BRAND_ART_H, BRAND_ART_W, BRAND_RUNS } from '@/game/brand-art';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// The site mark (the pixel galaxy) at 4 px per cell, centred on Ink Black.
export default function AppleIcon() {
  const px = 4;
  const left = (180 - px * BRAND_ART_W) / 2;
  const top = (180 - px * BRAND_ART_H) / 2;
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: SEMANTIC['--color-bg-primary'], display: 'flex', position: 'relative' }}>
        {BRAND_RUNS.map(([y, x, len, fill]) => (
          <div key={`${x}-${y}`} style={{ position: 'absolute', left: left + x * px, top: top + y * px, width: len * px, height: px, background: fill }} />
        ))}
      </div>
    ),
    size,
  );
}
