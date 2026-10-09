import { describe, it, expect } from 'vitest';
import { computeScorecard } from './scorecard';

const baseInput = {
  avgPm25: 45,
  binsAbove80Pct: 10,
  totalBins: 8,
  energyKw: 120,
  floorArea: 20000,
  waterLitresPerDay: 40000,
  occupancy: 2000,
  parkingOccupancyPct: 60,
  congestionIndex: 0.4,
  openReports: 2,
  resolvedReports7d: 8,
  totalReports7d: 10,
  wasteDiversionPct: 40,
  co2eKgPerDay: 2000,
  weights: { air: 0.2, waste: 0.15, energy: 0.2, water: 0.15, mobility: 0.15, resilience: 0.15 },
  trends: {},
};

describe('computeScorecard', () => {
  it('produces sub-scores within 0-100', () => {
    const sc = computeScorecard(baseInput);
    for (const v of Object.values(sc.subscores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('overall is the weighted sum of sub-scores', () => {
    const sc = computeScorecard(baseInput);
    const w = baseInput.weights;
    const expected =
      sc.subscores.air * w.air +
      sc.subscores.waste * w.waste +
      sc.subscores.energy * w.energy +
      sc.subscores.water * w.water +
      sc.subscores.mobility * w.mobility +
      sc.subscores.resilience * w.resilience;
    expect(sc.overall).toBe(Math.round(expected));
  });

  it('assigns a grade based on overall', () => {
    const sc = computeScorecard(baseInput);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(sc.grade);
  });

  it('worse air quality lowers the air sub-score', () => {
    const good = computeScorecard({ ...baseInput, avgPm25: 15 });
    const bad = computeScorecard({ ...baseInput, avgPm25: 200 });
    expect(good.subscores.air).toBeGreaterThan(bad.subscores.air);
  });

  it('more bins above 80% lowers the waste sub-score', () => {
    const clean = computeScorecard({ ...baseInput, binsAbove80Pct: 0 });
    const dirty = computeScorecard({ ...baseInput, binsAbove80Pct: 80 });
    expect(clean.subscores.waste).toBeGreaterThan(dirty.subscores.waste);
  });

  it('higher congestion lowers mobility', () => {
    const free = computeScorecard({ ...baseInput, congestionIndex: 0.1 });
    const jammed = computeScorecard({ ...baseInput, congestionIndex: 0.95 });
    expect(free.subscores.mobility).toBeGreaterThan(jammed.subscores.mobility);
  });

  it('passes through CO2e and diversion', () => {
    const sc = computeScorecard({ ...baseInput, co2eKgPerDay: 1234, wasteDiversionPct: 55 });
    expect(sc.co2eKgPerDay).toBe(1234);
    expect(sc.wasteDiversionPct).toBe(55);
  });
});
