import { describe, it, expect } from 'vitest';
import { rollingZScore, shouldFire, isolationScore } from './anomaly';
import type { SeriesPoint } from '@/types/domain';

function flatSeries(n: number, value: number): SeriesPoint[] {
  return Array.from({ length: n }, (_, i) => ({ t: i * 900000, value }));
}

describe('rollingZScore', () => {
  it('flags a clear spike as an anomaly', () => {
    const series = [...flatSeries(40, 10), { t: 36000000, value: 100 }];
    const result = rollingZScore(series, 32, 3);
    expect(result.isAnomaly).toBe(true);
    expect(result.observed).toBe(100);
    expect(result.expected).toBeCloseTo(10, 0);
  });

  it('does not flag stable data', () => {
    const series = flatSeries(50, 10);
    const result = rollingZScore(series, 32, 3);
    expect(result.isAnomaly).toBe(false);
  });

  it('returns a safe result for short series', () => {
    const result = rollingZScore(flatSeries(5, 10), 32, 3);
    expect(result.isAnomaly).toBe(false);
    expect(result.zScore).toBe(0);
  });

  it('detects a drop (negative z-score) as anomaly', () => {
    const series = [...flatSeries(40, 100), { t: 36000000, value: 10 }];
    const result = rollingZScore(series, 32, 3);
    expect(result.isAnomaly).toBe(true);
    expect(result.zScore).toBeLessThan(0);
  });
});

describe('shouldFire (cooldown dedupe)', () => {
  it('fires once then suppresses within cooldown', () => {
    const last = {};
    expect(shouldFire(last, 'a', 1000, 60000)).toBe(true);
    expect(shouldFire(last, 'a', 2000, 60000)).toBe(false);
    expect(shouldFire(last, 'a', 70000, 60000)).toBe(true);
  });

  it('tracks sensors independently', () => {
    const last = {};
    expect(shouldFire(last, 'a', 1000, 60000)).toBe(true);
    expect(shouldFire(last, 'b', 1000, 60000)).toBe(true);
  });
});

describe('isolationScore', () => {
  it('returns 0 for tiny input', () => {
    expect(isolationScore([[1, 2]])).toBe(0);
  });

  it('scores an outlier higher than inliers', () => {
    const points = Array.from({ length: 30 }, () => [Math.random() * 10, Math.random() * 10]);
    const inlierScore = isolationScore([...points, [5, 5]]);
    const outlierScore = isolationScore([...points, [1000, 1000]]);
    expect(outlierScore).toBeGreaterThan(inlierScore);
  });
});
