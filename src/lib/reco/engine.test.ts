import { describe, it, expect } from 'vitest';
import { runEngine, type EngineInput } from './engine';
import { campusSite } from '@/config/sites/campus';
import type { Alert, BinEta, Report } from '@/types/domain';

function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    site: campusSite,
    buildings: campusSite.buildings,
    binEtas: [],
    alerts: [],
    openReports: [],
    tasks: [],
    params: campusSite.scenarioDefaults,
    parkingOccupancyPct: 50,
    congestionIndex: 0.3,
    avgPm25: 40,
    totalPeople: 1000,
    energyAnomalyBuildings: [],
    waterLeakBuildings: [],
    hour: 14,
    ...overrides,
  };
}

describe('runEngine', () => {
  it('produces a waste-reroute recommendation when a bin is near overflow', () => {
    const binEtas: BinEta[] = [
      { binId: 'bin-hostel-e', buildingId: 'hostel-east', etaMinutes: 90, confidence: 'high', fillRatePerHour: 8, currentFill: 82 },
    ];
    const recs = runEngine(baseInput({ binEtas }));
    const waste = recs.find((r) => r.type === 'waste-reroute');
    expect(waste).toBeDefined();
    expect(waste!.plainLanguage).toContain('Hostel E');
    expect(waste!.plainLanguage).toContain('overflow');
    expect(waste!.owner).toBe('operations');
  });

  it('produces an air-quality advisory when PM2.5 is elevated', () => {
    const alert: Alert = {
      id: 'a1', t: Date.now(), buildingId: 'canteen', buildingName: 'Canteen', sensorId: 'pm25',
      sensorLabel: 'PM2.5', severity: 'warning', message: 'PM2.5 high', observed: 80, expected: 60,
      threshold: 60, unit: 'µg/m³', method: 'threshold', window: 'instant', confidence: 0.8, assumptions: [], acknowledged: false,
    };
    const recs = runEngine(baseInput({ avgPm25: 85, alerts: [alert] }));
    const advisory = recs.find((r) => r.type === 'air-advisory');
    expect(advisory).toBeDefined();
    expect(advisory!.plainLanguage).toContain('PM2.5');
  });

  it('produces an overflow-parking recommendation when parking is nearly full', () => {
    const recs = runEngine(baseInput({ parkingOccupancyPct: 97 }));
    const parking = recs.find((r) => r.type === 'overflow-parking');
    expect(parking).toBeDefined();
    expect(parking!.severity).toBe('critical');
  });

  it('produces a water-leak recommendation for leak-signature buildings', () => {
    const recs = runEngine(baseInput({ waterLeakBuildings: ['hostel-south'] }));
    const leak = recs.find((r) => r.type === 'water-leak');
    expect(leak).toBeDefined();
    expect(leak!.plainLanguage).toContain('Hostel S');
  });

  it('produces a traffic-retime recommendation under congestion', () => {
    const recs = runEngine(baseInput({ congestionIndex: 0.85 }));
    const traffic = recs.find((r) => r.type === 'traffic-retime');
    expect(traffic).toBeDefined();
  });

  it('escalates safety reports', () => {
    const report: Report = {
      id: 'r1', trackingId: 'SSR-TEST', t: Date.now(), category: 'safety', buildingId: 'sports',
      buildingName: 'Sports Complex', note: 'sharp edges', hasPhoto: false, status: 'received', anonymous: true, upvotes: 0,
    };
    const recs = runEngine(baseInput({ openReports: [report] }));
    const esc = recs.find((r) => r.type === 'escalate-report');
    expect(esc).toBeDefined();
    expect(esc!.severity).toBe('critical');
  });

  it('produces an event-crowd recommendation for large crowds', () => {
    const recs = runEngine(baseInput({ params: { ...campusSite.scenarioDefaults, crowdMultiplier: 2.0 } }));
    const crowd = recs.find((r) => r.title.includes('crowd'));
    expect(crowd).toBeDefined();
  });

  it('returns an empty array when nothing is wrong', () => {
    const recs = runEngine(baseInput());
    expect(recs).toEqual([]);
  });

  it('every recommendation carries rationale, assumptions and confidence', () => {
    const binEtas: BinEta[] = [
      { binId: 'b1', buildingId: 'hostel-east', etaMinutes: 60, confidence: 'high', fillRatePerHour: 9, currentFill: 85 },
    ];
    const recs = runEngine(baseInput({ binEtas, parkingOccupancyPct: 98, congestionIndex: 0.9, waterLeakBuildings: ['hostel-south'] }));
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.rationale.length).toBeGreaterThan(0);
      expect(r.assumptions.length).toBeGreaterThan(0);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.plainLanguage.length).toBeGreaterThan(10);
    }
  });
});
