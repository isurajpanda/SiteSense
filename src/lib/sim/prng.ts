export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic noise in [-1, 1] for a given seed, key and integer bucket. */
export function bucketNoise(seed: number, key: string, bucket: number): number {
  const rng = mulberry32((seed ^ Math.imul(hashString(key), bucket)) >>> 0);
  return rng() * 2 - 1;
}

/** Smooth pseudo-random in [0,1] from seed+key+bucket, for event decisions. */
export function bucketRandom(seed: number, key: string, bucket: number): number {
  const rng = mulberry32((seed ^ Math.imul(hashString(key), bucket * 2654435761)) >>> 0);
  return rng();
}
