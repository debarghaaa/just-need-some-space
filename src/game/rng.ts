/**
 * Deterministic hashing and PRNG. Everything in the universe derives from
 * UNIVERSE_SEED + hierarchical coordinates, so identical inputs must yield identical worlds
 * on the server (where points are awarded) and in the browser (where they are drawn).
 */

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function seedFrom(...parts: Array<string | number>): number {
  return mix32(fnv1a(parts.map(String).join('|')));
}

export function shortHash(str: string): string {
  return mix32(fnv1a(str)).toString(16).padStart(8, '0').slice(0, 6);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly fn: () => number;
  constructor(public readonly seed: number) {
    this.fn = mulberry32(seed);
  }
  next(): number {
    return this.fn();
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
  child(...parts: Array<string | number>): Rng {
    return new Rng(seedFrom(this.seed, ...parts));
  }
}

/** Stable 2D value noise used by the pixel renderers. */
export function hashNoise(x: number, y: number, seed: number): number {
  let h = seedFrom(seed, x, y);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
