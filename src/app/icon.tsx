import { ImageResponse } from 'next/og';
import { SEMANTIC } from '@/game/palette';
import { BRAND_ICON_H, BRAND_ICON_RUNS, BRAND_ICON_W } from '@/game/brand-art';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// The site mark (the pixel galaxy, 27 x 27 reduction) at 1 px per cell, centred on Ink Black. Not a letter, not an emoji.
export default function Icon() {
  const px = 1;
  const left = Math.floor((32 - px * BRAND_ICON_W) / 2);
  const top = Math.floor((32 - px * BRAND_ICON_H) / 2);
  return new ImageResponse(
    (
      <div style={{ width: 32, height: 32, background: SEMANTIC['--color-bg-primary'], display: 'flex', position: 'relative' }}>
        {BRAND_ICON_RUNS.map(([y, x, len, fill]) => (
          <div key={`${x}-${y}`} style={{ position: 'absolute', left: left + x * px, top: top + y * px, width: len * px, height: px, background: fill }} />
        ))}
      </div>
    ),
    size,
  );
}
