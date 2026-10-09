import { describe, it, expect } from 'vitest';
import { binEta } from './eta';
import type { SeriesPoint } from '@/types/domain';

const MIN = 60 * 1000;

describe('binEta', () => {
  it('estimates a finite ETA when fill is rising', () => {
    const now = new Date('2026-10-01T13:00:00').getTime();
    const series: SeriesPoint[] = Array.from({ length: 16 }, (_, i) => ({
      t: now - (15 - i) * 15 * MIN,
      value: 40 + i * 2,
    }));
    const eta = binEta(series, 60);
    expect(eta.etaMinutes).not.toBeNull();
    expect(eta.etaMinutes).toBeGreaterThan(0);
    expect(eta.fillRatePerHour).toBeGreaterThan(0);
  });

  it('returns null ETA when fill is not rising', () => {
    const now = new Date('2026-10-01T13:00:00').getTime();
    const series: SeriesPoint[] = Array.from({ length: 16 }, (_, i) => ({
      t: now - (15 - i) * 15 * MIN,
      value: 50 - i * 0.5,
    }));
    const eta = binEta(series, 40);
    expect(eta.etaMinutes).toBeNull();
  });

  it('returns 0 ETA when already full', () => {
    const now = new Date('2026-10-01T13:00:00').getTime();
    const series: SeriesPoint[] = Array.from({ length: 16 }, (_, i) => ({
      t: now - (15 - i) * 15 * MIN,
      value: 90 + i,
    }));
    const eta = binEta(series, 100);
    expect(eta.etaMinutes).toBe(0);
  });

  it('is confident with a strong fill rate', () => {
    const now = new Date('2026-10-01T13:00:00').getTime();
    const series: SeriesPoint[] = Array.from({ length: 16 }, (_, i) => ({
      t: now - (15 - i) * 15 * MIN,
      value: 20 + i * 5,
    }));
    const eta = binEta(series, 50);
    expect(eta.confidence).toBe('high');
  });

  it('handles very short series gracefully', () => {
    const eta = binEta([{ t: 0, value: 50 }], 50);
    expect(eta.etaMinutes).toBeNull();
    expect(eta.confidence).toBe('low');
  });
});
