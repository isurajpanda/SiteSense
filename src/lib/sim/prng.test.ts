import { describe, it, expect } from 'vitest';
import { mulberry32, bucketNoise, bucketRandom, hashString } from './prng';

describe('mulberry32 PRNG', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });

  it('outputs values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('bucketNoise / bucketRandom', () => {
  it('is deterministic per (seed, key, bucket)', () => {
    expect(bucketNoise(42, 'pm25', 7)).toEqual(bucketNoise(42, 'pm25', 7));
    expect(bucketRandom(42, 'pm25', 7)).toEqual(bucketRandom(42, 'pm25', 7));
  });

  it('varies across buckets', () => {
    const values = new Set(Array.from({ length: 20 }, (_, i) => bucketNoise(42, 'k', i)));
    expect(values.size).toBeGreaterThan(10);
  });

  it('bucketNoise stays within [-1, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const v = bucketNoise(7, 'k', i);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('hashString', () => {
  it('is deterministic and non-negative', () => {
    expect(hashString('abc')).toEqual(hashString('abc'));
    expect(hashString('abc')).toBeGreaterThanOrEqual(0);
  });
});
