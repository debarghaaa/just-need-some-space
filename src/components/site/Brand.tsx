import { BRAND } from '@/game/copy';
import { BRAND_ART_H, BRAND_ART_W, BRAND_RUNS } from '@/game/brand-art';

/** The mark: the pixel galaxy, drawn inline as crisp SVG rects so it never depends on an asset. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * BRAND_ART_H) / BRAND_ART_W)} viewBox={`0 0 ${BRAND_ART_W} ${BRAND_ART_H}`} preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {BRAND_RUNS.map(([y, x, len, fill]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={len} height="1" fill={fill} />
      ))}
    </svg>
  );
}

export function BrandName() {
  return <span>{BRAND}</span>;
}
