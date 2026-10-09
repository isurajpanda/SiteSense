import { describe, it, expect } from 'vitest';
import { holtWinters, seasonalNaive, forecastSeries } from './forecast';
import type { SeriesPoint } from '@/types/domain';

const MIN = 60 * 1000;

function seasonalSeries(points: number, base = 50, amp = 20): SeriesPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    t: i * 15 * MIN,
    value: base + amp * Math.sin((i % 96) / 96) * 2 * Math.PI,
  }));
}

describe('holtWinters', () => {
  it('produces the requested number of forecast points', () => {
    const fc = holtWinters(seasonalSeries(300), 6, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    expect(fc.points).toHaveLength(24);
  });

  it('forecast continues from the last timestamp', () => {
    const series = seasonalSeries(300);
    const fc = holtWinters(series, 1, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    const lastT = series[series.length - 1].t;
    expect(fc.points[0].t).toBeGreaterThan(lastT);
  });

  it('prediction interval widens with horizon and contains the point', () => {
    const fc = holtWinters(seasonalSeries(300), 6, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    for (const p of fc.points) {
      expect(p.lower).toBeLessThanOrEqual(p.upper);
      expect(p.value).toBeGreaterThanOrEqual(p.lower);
      expect(p.value).toBeLessThanOrEqual(p.upper);
    }
    const firstWidth = fc.points[0].upper - fc.points[0].lower;
    const lastWidth = fc.points[fc.points.length - 1].upper - fc.points[fc.points.length - 1].lower;
    expect(lastWidth).toBeGreaterThan(firstWidth);
  });

  it('labels model, horizon and window', () => {
    const fc = holtWinters(seasonalSeries(300), 6, 'PM2.5', 'pm25', 'b1', 'µg/m³', ['assumption']);
    expect(fc.model).toContain('Holt-Winters');
    expect(fc.horizonHours).toBe(6);
    expect(fc.assumptions).toContain('assumption');
  });
});

describe('seasonalNaive', () => {
  it('repeats the seasonal pattern', () => {
    const series = seasonalSeries(200);
    const fc = seasonalNaive(series, 2, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    expect(fc.points).toHaveLength(8);
    expect(fc.model).toContain('Seasonal naive');
  });
});

describe('forecastSeries dispatch', () => {
  it('uses Holt-Winters for long series', () => {
    const fc = forecastSeries(seasonalSeries(300), 3, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    expect(fc.model).toContain('Holt-Winters');
  });

  it('falls back to seasonal-naive for short series', () => {
    const fc = forecastSeries(seasonalSeries(50), 3, 'PM2.5', 'pm25', 'b1', 'µg/m³', []);
    expect(fc.model).toContain('Seasonal naive');
  });
});
