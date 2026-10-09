import { create } from 'zustand';
import type {
  Alert,
  AuditEntry,
  CongestionMap,
  Recommendation,
  ScenarioParams,
  ScenarioResult,
  ScenarioSnapshot,
  SeriesPoint,
  Task,
  TickerEvent,
} from '@/types/domain';
import { getSite } from '@/config/sites';
import { generateSensorSeries, generatorFor } from '@/lib/sim/generators';
import { injectDemoAnomalies, liveAnomalyValue, type SeriesMap } from '@/lib/sim/anomalyInjector';
import { rollingZScore, shouldFire } from '@/lib/models/anomaly';
import { binEta } from '@/lib/models/eta';
import { runEngine } from '@/lib/reco/engine';
import { TOTAL_POINTS, SIM_MINUTES_PER_TICK, simMinutesPerTick } from '@/lib/sim/clock';
import { useReportStore } from './useReportStore';
import { useSettingsStore } from './useSettingsStore';

const MIN = 60 * 1000;
const MAX_HISTORY = TOTAL_POINTS + 96;

export interface Kpis {
  totalPeople: number;
  campusAqi: number;
  binsAbove80: number;
  openReports: number;
  parkingOccupancyPct: number;
  energyKw: number;
  waterLph: number;
  congestion: number;
}

interface SimState {
  simTime: number;
  history: Record<string, SeriesPoint[]>;
  alerts: Alert[];
  recommendations: Recommendation[];
  tasks: Task[];
  audit: AuditEntry[];
  ticker: TickerEvent[];
  binStates: Record<string, number>;
  parkingStates: Record<string, number>;
  congestion: CongestionMap;
  kpis: Kpis;
  scenario: ScenarioResult | null;
  scenarioParams: ScenarioParams | null;
  scrubTime: number | null;
  lastAlertTimes: Record<string, number>;
  initialized: boolean;

  init: (siteId: string) => void;
  tick: () => void;
  setScrubTime: (t: number | null) => void;
  acceptReco: (id: string) => void;
  dismissReco: (id: string) => void;
  snoozeReco: (id: string) => void;
  addTask: (t: Omit<Task, 'id' | 't'>) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;
  runScenario: (params: ScenarioParams, name: string, description: string) => void;
  resetScenario: () => void;
  triggerDemoEvent: () => void;
  reseed: () => void;
  logAudit: (actor: 'admin' | 'operations' | 'sustainability' | 'reporter', action: string, detail: string) => void;
}

function skey(buildingId: string, sensorId: string): string {
  return `${buildingId}:${sensorId}`;
}

function computeKpis(
  siteId: string,
  history: Record<string, SeriesPoint[]>,
  binStates: Record<string, number>,
  parkingStates: Record<string, number>,
  congestion: number,
): Kpis {
  const site = getSite(siteId);
  let totalPeople = 0;
  let pmSum = 0;
  let pmCount = 0;
  let energyKw = 0;
  let waterLph = 0;
  for (const b of site.buildings) {
    for (const s of b.sensors) {
      const series = history[skey(b.id, s.id)];
      if (!series || series.length === 0) continue;
      const v = series[series.length - 1].value;
      if (s.kind === 'occupancy') totalPeople += v;
      if (s.kind === 'pm25') {
        pmSum += v;
        pmCount++;
      }
      if (s.kind === 'energy') energyKw += v;
      if (s.kind === 'water') waterLph += v;
    }
  }
  const binsAbove80 = Object.values(binStates).filter((v) => v > 80).length;
  const parkingVals = Object.values(parkingStates);
  const parkingOccupancyPct =
    parkingVals.length > 0 ? (parkingVals.reduce((a, b) => a + b, 0) / parkingVals.length) * 100 : 0;
  return {
    totalPeople: Math.round(totalPeople),
    campusAqi: pmCount > 0 ? Math.round(pmSum / pmCount) : 0,
    binsAbove80,
    openReports: useReportStore.getState().reports.filter((r) => r.status !== 'resolved').length,
    parkingOccupancyPct: Math.round(parkingOccupancyPct),
    energyKw: Math.round(energyKw),
    waterLph: Math.round(waterLph),
    congestion: Math.round(congestion * 100) / 100,
  };
}

export const useSimStore = create<SimState>()((set, get) => ({
  simTime: Date.now(),
  history: {},
  alerts: [],
  recommendations: [],
  tasks: [],
  audit: [],
  ticker: [],
  binStates: {},
  parkingStates: {},
  congestion: {},
  kpis: { totalPeople: 0, campusAqi: 0, binsAbove80: 0, openReports: 0, parkingOccupancyPct: 0, energyKw: 0, waterLph: 0, congestion: 0.3 },
  scenario: null,
  scenarioParams: null,
  scrubTime: null,
  lastAlertTimes: {},
  initialized: false,

  init: (siteId) => {
    const site = getSite(siteId);
    const seed = useSettingsStore.getState().seed;
    const params = site.scenarioDefaults;
    const startTime = Date.now() - TOTAL_POINTS * SIM_MINUTES_PER_TICK * MIN;
    const alignedStart = Math.floor(startTime / (SIM_MINUTES_PER_TICK * MIN)) * SIM_MINUTES_PER_TICK * MIN;

    const series: SeriesMap = new Map();
    for (const b of site.buildings) {
      for (const s of b.sensors) {
        const result = generateSensorSeries(site, b, s, alignedStart, params, seed);
        series.set(skey(b.id, s.id), result.points);
      }
    }
    injectDemoAnomalies(site, series, alignedStart + TOTAL_POINTS * SIM_MINUTES_PER_TICK * MIN);

    const history: Record<string, SeriesPoint[]> = {};
    const binStates: Record<string, number> = {};
    const parkingStates: Record<string, number> = {};
    for (const [k, pts] of series) {
      history[k] = pts;
      const [bid, sid] = k.split(':');
      const last = pts[pts.length - 1].value;
      if (sid === 'bin' || sid === 'waste-biomed') {
        const bin = site.bins.find((x) => x.buildingId === bid);
        if (bin) binStates[bin.id] = last;
      }
      if (sid === 'parking') {
        const lot = site.parkingLots.find((x) => x.buildingId === bid);
        if (lot) parkingStates[lot.id] = last * 100;
      }
    }

    const simTime = alignedStart + TOTAL_POINTS * SIM_MINUTES_PER_TICK * MIN;
    const congestion: import('@/types/domain').CongestionMap = {};
    for (const r of site.roads) congestion[r.id] = 0.3;
    const kpis = computeKpis(siteId, history, binStates, parkingStates, 0.3);

    set({
      simTime,
      history,
      binStates,
      parkingStates,
      congestion,
      kpis,
      alerts: [],
      recommendations: [],
      ticker: [],
      scenario: null,
      scenarioParams: null,
      scrubTime: null,
      lastAlertTimes: {},
      initialized: true,
    });

    get().logAudit('admin', 'Simulation initialised', `Site: ${site.name}, seed ${seed}, 7-day history generated.`);
    get().tick();
  },

  tick: () => {
    const state = get();
    if (!state.initialized) return;
    const { running, speed } = useSettingsStore.getState();
    if (!running || state.scrubTime !== null) return;

    const site = getSite(useSettingsStore.getState().siteId);
    const seed = useSettingsStore.getState().seed;
    const params = state.scenarioParams ?? site.scenarioDefaults;
    const stepMs = simMinutesPerTick(speed) * MIN;
    const newTime = state.simTime + stepMs;

    const history: Record<string, SeriesPoint[]> = { ...state.history };
    const binStates = { ...state.binStates };
    const parkingStates = { ...state.parkingStates };
    const newAlerts: Alert[] = [];
    const lastAlertTimes = { ...state.lastAlertTimes };

    for (const b of site.buildings) {
      for (const s of b.sensors) {
        const k = skey(b.id, s.id);
        const series = history[k];
        if (!series) continue;
        const fn = generatorFor(s.kind);
        const prev = series[series.length - 1].value;
        let v = fn(b, newTime, params, seed, prev);
        v = liveAnomalyValue(site, b.id, s.id, newTime, v);
        const point = { t: newTime, value: Math.round(v * 100) / 100 };
        const next = [...series, point];
        if (next.length > MAX_HISTORY) next.shift();
        history[k] = next;

        if (s.kind === 'bin' || s.kind === 'waste-biomed') {
          const bin = site.bins.find((x) => x.buildingId === b.id);
          if (bin) binStates[bin.id] = v;
        }
        if (s.kind === 'parking') {
          const lot = site.parkingLots.find((x) => x.buildingId === b.id);
          if (lot) parkingStates[lot.id] = v * 100;
        }

        const result = rollingZScore(next, 32, site.thresholds.energyZScore);
        const isPm = s.kind === 'pm25';
        const threshold = isPm
          ? v > site.thresholds.pm25Critical
            ? site.thresholds.pm25Critical
            : site.thresholds.pm25Warning
          : site.thresholds.energyZScore;
        const fired =
          isPm ? v > site.thresholds.pm25Warning : result.isAnomaly;
        if (fired && shouldFire(lastAlertTimes, k, newTime, 2 * 60 * MIN)) {
          const severity = isPm
            ? v > site.thresholds.pm25Critical
              ? 'critical'
              : 'warning'
            : result.zScore > 0
              ? 'warning'
              : 'warning';
          const alert: Alert = {
            id: `al-${newTime}-${k}`,
            t: newTime,
            buildingId: b.id,
            buildingName: b.name,
            sensorId: s.id,
            sensorLabel: s.label,
            severity,
            message: isPm
              ? `${b.shortName}: PM2.5 at ${Math.round(v)} µg/m³ (${severity === 'critical' ? 'above critical' : 'above warning'} threshold ${threshold})`
              : `${b.shortName}: ${s.label} anomaly — observed ${result.observed} vs expected ${result.expected} ${s.unit} (z=${result.zScore})`,
            observed: Math.round(v * 10) / 10,
            expected: isPm ? threshold : result.expected,
            threshold,
            unit: s.unit,
            method: isPm ? 'threshold' : result.method,
            window: isPm ? 'instant' : `${result.window} points`,
            confidence: isPm ? 0.8 : Math.round(result.score * 100) / 100,
            assumptions: isPm
              ? ['Low-cost sensor reading, indicative only.', 'CPCB India category bands used.']
              : ['Rolling window 32 points (8h).', 'EWMA-smoothed baseline.', 'Threshold z=3.'],
            acknowledged: false,
          };
          newAlerts.push(alert);
        }
      }
    }

    const congestion = { ...state.congestion };
    const h = new Date(newTime).getHours() + new Date(newTime).getMinutes() / 60;
    for (const r of site.roads) {
      const seedOffset = r.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
      const base =
        h >= 8 && h < 10 ? 0.75 : h >= 12 && h < 14 ? 0.55 : h >= 17 && h < 19 ? 0.8 : h >= 21 && h < 23 ? 0.4 : 0.25;
      let v = (base + seedOffset * 0.07) * params.congestionMultiplier;
      if (params.rainMm > 8) v += 0.15;
      congestion[r.id] = Math.min(1, Math.max(0, v));
    }
    const avgCongestion = Object.values(congestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(congestion).length);

    const kpis = computeKpis(site.id, history, binStates, parkingStates, avgCongestion);

    const alerts = [...newAlerts, ...state.alerts].slice(0, 60);
    const ticker: TickerEvent[] = [
      ...newAlerts.map((a) => ({ id: a.id, t: a.t, message: a.message, severity: a.severity })),
      ...state.ticker,
    ].slice(0, 30);

    set({ simTime: newTime, history, binStates, parkingStates, congestion, kpis, alerts, ticker, lastAlertTimes });

    if (newAlerts.length > 0) {
      get().logAudit('admin', 'Alert fired', newAlerts.map((a) => a.message).join(' | '));
    }

    runEnginePass(set, get);
  },

  setScrubTime: (t) => set({ scrubTime: t }),

  acceptReco: (id) => {
    const reco = get().recommendations.find((r) => r.id === id);
    if (!reco) return;
    const task: Task = {
      id: `task-${Date.now()}`,
      t: Date.now(),
      title: reco.title,
      description: reco.plainLanguage,
      buildingId: reco.buildingIds[0] ?? '',
      buildingName: getSite(useSettingsStore.getState().siteId).buildings.find((b) => b.id === reco.buildingIds[0])?.shortName ?? '',
      status: 'new',
      source: 'recommendation',
      sourceId: reco.id,
    };
    set((s) => ({
      recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, status: 'accepted', taskId: task.id } : r)),
      tasks: [task, ...s.tasks],
    }));
    get().logAudit('operations', 'Recommendation accepted', `${reco.title} → task ${task.id}`);
  },

  dismissReco: (id) => {
    set((s) => ({
      recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, status: 'dismissed' } : r)),
    }));
    get().logAudit('operations', 'Recommendation dismissed', id);
  },

  snoozeReco: (id) => {
    set((s) => ({
      recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, status: 'snoozed' } : r)),
    }));
    get().logAudit('operations', 'Recommendation snoozed', id);
  },

  addTask: (t) => {
    const task: Task = { ...t, id: `task-${Date.now()}`, t: Date.now() };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    get().logAudit('operations', 'Task created', task.title);
  },

  updateTaskStatus: (id, status) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }));
    get().logAudit('operations', 'Task updated', `${id} → ${status}`);
  },

  runScenario: (params, name, description) => {
    const site = getSite(useSettingsStore.getState().siteId);
    const state = get();

    const snapshot = (p: ScenarioParams): ScenarioSnapshot => {
      let totalPeople = 0;
      let pmSum = 0;
      let pmCount = 0;
      let binsAbove80 = 0;
      let energyKw = 0;
      let waterLitres = 0;
      let parkingSum = 0;
      let parkingN = 0;
      for (const b of site.buildings) {
        for (const s of b.sensors) {
          const series = state.history[skey(b.id, s.id)];
          if (!series) continue;
          const v = series[series.length - 1].value;
          if (s.kind === 'occupancy') totalPeople += v * p.occupancyMultiplier * p.crowdMultiplier;
          if (s.kind === 'pm25') {
            pmSum += v * p.pm25Multiplier;
            pmCount++;
          }
          if (s.kind === 'energy') energyKw += v * p.energyMultiplier;
          if (s.kind === 'water') waterLitres += v * p.waterMultiplier;
        }
      }
      for (const v of Object.values(state.binStates)) {
        if (v * p.wasteMultiplier > 80) binsAbove80++;
      }
      for (const v of Object.values(state.parkingStates)) {
        parkingSum += Math.min(100, v * p.parkingMultiplier * p.crowdMultiplier);
        parkingN++;
      }
      const congestion = Math.min(
        1,
        (0.25 + (p.congestionMultiplier - 1) * 0.4 + (p.rainMm > 8 ? 0.15 : 0)) * p.congestionMultiplier,
      );
      return {
        totalPeople: Math.round(totalPeople),
        avgPm25: pmCount > 0 ? Math.round(pmSum / pmCount) : 0,
        binsAbove80,
        openReports: useReportStore.getState().reports.filter((r) => r.status !== 'resolved').length,
        parkingOccupancyPct: parkingN > 0 ? Math.round(parkingSum / parkingN) : 0,
        energyKw: Math.round(energyKw),
        congestionIndex: Math.round(congestion * 100) / 100,
        waterLitres: Math.round(waterLitres),
      };
    };

    const baseline = snapshot(site.scenarioDefaults);
    const projected = snapshot(params);

    const newAlerts: Alert[] = [];
    if (projected.avgPm25 > site.thresholds.pm25Warning) {
      newAlerts.push({
        id: `sc-al-pm-${Date.now()}`,
        t: Date.now(),
        buildingId: 'canteen',
        buildingName: 'Canteen and Food Court',
        sensorId: 'pm25',
        sensorLabel: 'PM2.5',
        severity: projected.avgPm25 > site.thresholds.pm25Critical ? 'critical' : 'warning',
        message: `Scenario "${name}": campus PM2.5 projected at ${projected.avgPm25} µg/m³`,
        observed: projected.avgPm25,
        expected: site.thresholds.pm25Warning,
        threshold: site.thresholds.pm25Warning,
        unit: 'µg/m³',
        method: 'scenario-projection',
        window: 'scenario',
        confidence: 0.7,
        assumptions: ['Projection from current state with scenario multipliers.'],
        acknowledged: false,
      });
    }
    if (projected.parkingOccupancyPct > site.thresholds.parkingWarningPct * 100) {
      newAlerts.push({
        id: `sc-al-park-${Date.now()}`,
        t: Date.now(),
        buildingId: 'parking',
        buildingName: 'Main Parking Lot',
        sensorId: 'parking',
        sensorLabel: 'Parking occupancy',
        severity: 'warning',
        message: `Scenario "${name}": parking projected at ${projected.parkingOccupancyPct}%`,
        observed: projected.parkingOccupancyPct,
        expected: site.thresholds.parkingWarningPct * 100,
        threshold: site.thresholds.parkingWarningPct * 100,
        unit: '%',
        method: 'scenario-projection',
        window: 'scenario',
        confidence: 0.7,
        assumptions: ['Projection from current state with scenario multipliers.'],
        acknowledged: false,
      });
    }

    const engineRecs = runEngine({
      site,
      buildings: site.buildings,
      binEtas: site.bins.map((bin) => {
        const series = state.history[skey(bin.buildingId, 'bin')] ?? [];
        const eta = binEta(series, state.binStates[bin.id] ?? 0);
        return { binId: bin.id, buildingId: bin.buildingId, ...eta };
      }),
      alerts: newAlerts,
      openReports: useReportStore.getState().reports.filter((r) => r.status !== 'resolved'),
      tasks: state.tasks,
      params,
      parkingOccupancyPct: projected.parkingOccupancyPct,
      congestionIndex: projected.congestionIndex,
      avgPm25: projected.avgPm25,
      totalPeople: projected.totalPeople,
      energyAnomalyBuildings: [],
      waterLeakBuildings: [],
      hour: new Date().getHours(),
    });

    const result: ScenarioResult = {
      id: `sc-${Date.now()}`,
      name,
      description,
      params,
      baseline,
      projected,
      newAlerts,
      newRecommendations: engineRecs.map((r) => ({ ...r, id: `sc-${r.id}` })),
    };

    set({ scenario: result, scenarioParams: params });
    get().logAudit('admin', 'Scenario run', `${name}: PM2.5 ${baseline.avgPm25}→${projected.avgPm25}, parking ${baseline.parkingOccupancyPct}%→${projected.parkingOccupancyPct}%`);
  },

  resetScenario: () => {
    set({ scenario: null, scenarioParams: null });
    get().logAudit('admin', 'Scenario reset', 'Returned to live baseline.');
  },

  triggerDemoEvent: () => {
    const site = getSite(useSettingsStore.getState().siteId);
    const state = get();
    const hostelC = site.buildings.find((b) => b.id === 'hostel-east');
    if (!hostelC) return;
    const bin = site.bins.find((x) => x.buildingId === 'hostel-east');
    if (!bin) return;
    const k = skey('hostel-east', 'bin');
    const series = state.history[k];
    if (!series) return;
    const boosted = series.map((p) => ({ ...p, value: Math.min(100, p.value + 12) }));
    const history = { ...state.history, [k]: boosted };
    const binStates = { ...state.binStates, [bin.id]: Math.min(100, (state.binStates[bin.id] ?? 0) + 12) };
    const alert: Alert = {
      id: `al-demo-${Date.now()}`,
      t: state.simTime,
      buildingId: 'hostel-east',
      buildingName: hostelC.name,
      sensorId: 'bin',
      sensorLabel: 'Bin fill level',
      severity: 'critical',
      message: `Hostel E bin fill jumped to ${Math.round(state.binStates[bin.id] ?? 0) + 12}% — overflow imminent`,
      observed: Math.round((state.binStates[bin.id] ?? 0) + 12),
      expected: 70,
      threshold: site.thresholds.binFillCritical,
      unit: '%',
      method: 'demo-event',
      window: 'instant',
      confidence: 0.9,
      assumptions: ['Manually triggered demo event.'],
      acknowledged: false,
    };
    set({
      history,
      binStates,
      alerts: [alert, ...state.alerts].slice(0, 60),
      ticker: [{ id: alert.id, t: alert.t, message: alert.message, severity: 'critical' as const }, ...state.ticker].slice(0, 30),
    });
    get().logAudit('admin', 'Demo event triggered', 'Hostel E bin overflow surge.');
  },

  reseed: () => {
    const newSeed = Math.floor(Math.random() * 100000);
    useSettingsStore.getState().setSeed(newSeed);
    get().init(useSettingsStore.getState().siteId);
  },

  logAudit: (actor, action, detail) => {
    const entry: AuditEntry = { id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, t: Date.now(), actor, action, detail };
    set((s) => ({ audit: [entry, ...s.audit].slice(0, 100) }));
  },
}));

type Set = (fn: (s: SimState) => Partial<SimState>) => void;
type Get = () => SimState;

function runEnginePass(set: Set, get: Get) {
  const state = get();
  const site = getSite(useSettingsStore.getState().siteId);
  const params = state.scenarioParams ?? site.scenarioDefaults;
  const hour = new Date(state.simTime).getHours();

  const binEtas = site.bins.map((bin) => {
    const series = state.history[skey(bin.buildingId, 'bin')] ?? [];
    const eta = binEta(series, state.binStates[bin.id] ?? 0);
    return { binId: bin.id, buildingId: bin.buildingId, ...eta };
  });

  const energyAnomalyBuildings = state.alerts
    .filter((a) => a.sensorLabel === 'Energy' && Date.now() - a.t < 6 * 3600000)
    .map((a) => a.buildingId);
  const waterLeakBuildings = site.buildings
    .filter((b) => {
      if (b.type !== 'hostel' && b.type !== 'residential') return false;
      const series = state.history[skey(b.id, 'water')];
      if (!series || series.length < 4) return false;
      const nightFlow = series.slice(-4).reduce((a, p) => a + p.value, 0) / 4;
      return nightFlow > site.thresholds.waterLeakFlow;
    })
    .map((b) => b.id);

  const recs = runEngine({
    site,
    buildings: site.buildings,
    binEtas,
    alerts: state.alerts,
    openReports: useReportStore.getState().reports.filter((r) => r.status !== 'resolved'),
    tasks: state.tasks,
    params,
    parkingOccupancyPct: state.kpis.parkingOccupancyPct,
    congestionIndex: Object.values(state.congestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(state.congestion).length),
    avgPm25: state.kpis.campusAqi,
    totalPeople: state.kpis.totalPeople,
    energyAnomalyBuildings,
    waterLeakBuildings,
    hour,
  });

  const existing = new Set(state.recommendations.filter((r) => r.status === 'open').map((r) => `${r.type}:${r.buildingIds[0]}`));
  const fresh = recs.filter((r) => !existing.has(`${r.type}:${r.buildingIds[0]}`));
  if (fresh.length > 0) {
    set((s) => ({ recommendations: [...fresh, ...s.recommendations].slice(0, 40) }));
  }
}
