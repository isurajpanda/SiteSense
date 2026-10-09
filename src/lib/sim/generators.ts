import type { Building, ScenarioParams, SensorDef, SiteConfig } from '@/types/domain';
import { bucketNoise, bucketRandom } from './prng';
import { TOTAL_POINTS, SIM_MINUTES_PER_TICK } from './clock';

const MIN = 60 * 1000;

function hourOfDay(t: number): number {
  return new Date(t).getHours() + new Date(t).getMinutes() / 60;
}

function dayOfWeek(t: number): number {
  return new Date(t).getDay();
}

function isWeekend(t: number): boolean {
  const d = dayOfWeek(t);
  return d === 0 || d === 6;
}

/** Gaussian-ish noise in [-1, 1] */
function noise(seed: number, key: string, t: number): number {
  return bucketNoise(seed, key, Math.floor(t / (SIM_MINUTES_PER_TICK * MIN)));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Deterministic spike events: a few per day at plausible hours. */
function spikeActive(seed: number, key: string, t: number, hour: number, magnitude: number): number {
  const dayBucket = Math.floor(t / (24 * 60 * MIN));
  const r = bucketRandom(seed, `${key}-spike`, dayBucket);
  const spikeHour = 7 + Math.floor(bucketRandom(seed, `${key}-spike-hr`, dayBucket) * 14);
  if (Math.abs(hour - spikeHour) < 1.2 && r > 0.55) {
    const dist = Math.abs(hour - spikeHour);
    return magnitude * Math.max(0, 1 - dist / 1.2) * (0.6 + r * 0.6);
  }
  return 0;
}

export function genPm25(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  const weekend = isWeekend(t);
  let v = 34;
  v += 14 * Math.exp(-((h - 8) ** 2) / 3);
  v += 18 * Math.exp(-((h - 19) ** 2) / 4);
  if (b.type === 'canteen') {
    v += 16 * Math.exp(-((h - 12.5) ** 2) / 1.5) + 10 * Math.exp(-((h - 19) ** 2) / 2);
  }
  if (b.type === 'parking' || b.id === 'gate-main') v += 9;
  if (b.type === 'sports') v -= 8;
  if (b.type === 'solar') v -= 5;
  if (weekend) v *= 0.85;
  v += noise(seed, `pm25-${b.id}`, t) * 5;
  v += spikeActive(seed, `pm25-${b.id}`, t, h, 22);
  v *= p.pm25Multiplier;
  if (p.rainMm > 5) v *= 0.7;
  return Math.max(5, v);
}

export function genTemp(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  let v = p.temperatureC - 4 + 7 * Math.exp(-((h - 14.5) ** 2) / 8);
  if (b.type === 'workshop') v += 3;
  if (b.type === 'solar') v += 4;
  v += noise(seed, `temp-${b.id}`, t) * 0.8;
  return v;
}

export function genHumidity(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  let v = 72 - 14 * Math.exp(-((h - 14) ** 2) / 10);
  if (p.rainMm > 2) v += 18 * Math.min(1, p.rainMm / 20);
  v += noise(seed, `hum-${b.id}`, t) * 4;
  return clamp(v, 20, 98);
}

export function genOccupancy(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  const weekend = isWeekend(t);
  const cap = Math.max(1, b.capacity);
  let frac = 0;
  switch (b.type) {
    case 'academic':
      frac = h >= 8 && h < 17 ? 0.75 + 0.15 * Math.sin(h) : h >= 17 && h < 20 ? 0.2 : 0.03;
      if (weekend) frac *= 0.15;
      break;
    case 'library':
      frac =
        h >= 9 && h < 13
          ? 0.55
          : h >= 16 && h < 20
            ? 0.8
            : h >= 7 && h < 9
              ? 0.2
              : 0.05;
      if (weekend) frac *= 0.7;
      break;
    case 'admin':
      frac = h >= 9 && h < 17 ? 0.7 : 0.02;
      if (weekend) frac = 0.01;
      break;
    case 'lab':
    case 'workshop':
      frac = h >= 9 && h < 17 ? 0.6 : h >= 17 && h < 21 ? 0.15 : 0.02;
      if (weekend) frac *= 0.2;
      break;
    case 'hostel':
      frac =
        h >= 22 || h < 7
          ? 0.92
          : h >= 7 && h < 9
            ? 0.5
            : h >= 9 && h < 16
              ? 0.18
              : h >= 16 && h < 22
                ? 0.55
                : 0.9;
      break;
    case 'canteen':
      frac =
        h >= 8 && h < 10
          ? 0.5
          : h >= 12 && h < 14
            ? 0.95
            : h >= 18 && h < 20
              ? 0.85
              : h >= 10 && h < 12
                ? 0.25
                : 0.05;
      break;
    case 'auditorium':
      frac = h >= 10 && h < 12 ? 0.7 : h >= 17 && h < 20 ? 0.85 : 0.02;
      break;
    case 'sports':
      frac = h >= 6 && h < 8 ? 0.4 : h >= 16 && h < 19 ? 0.7 : h >= 10 && h < 16 ? 0.15 : 0.02;
      if (weekend) frac = Math.min(1, frac + 0.25);
      break;
    case 'residential':
      frac = h >= 21 || h < 8 ? 0.8 : h >= 8 && h < 18 ? 0.3 : 0.55;
      break;
    case 'ward':
      frac = 0.75 + 0.1 * Math.sin(h / 3);
      break;
    case 'icu':
      frac = 0.9;
      break;
    case 'ot':
      frac = h >= 8 && h < 18 ? 0.6 : 0.05;
      break;
    case 'emergency':
      frac = 0.35 + 0.2 * Math.sin(h / 4);
      break;
    case 'pharmacy':
      frac = h >= 9 && h < 20 ? 0.4 : 0.05;
      break;
    case 'cafeteria':
      frac = h >= 12 && h < 14 ? 0.8 : h >= 18 && h < 20 ? 0.7 : 0.1;
      break;
    case 'lab-diagnostic':
      frac = h >= 8 && h < 18 ? 0.55 : 0.1;
      break;
    case 'plant':
      frac = 0.3;
      break;
    default:
      frac = 0.05;
  }
  frac *= p.occupancyMultiplier * p.crowdMultiplier;
  const surge = spikeActive(seed, `occ-${b.id}`, t, h, 0.25);
  frac = clamp(frac + surge, 0, 1.15);
  return Math.round(cap * frac);
}

export function genBin(b: Building, t: number, p: ScenarioParams, seed: number, prev: number): number {
  const h = hourOfDay(t);
  const idx = Math.floor(t / (SIM_MINUTES_PER_TICK * MIN));
  const isCollectionRound = (hh: number) => (hh === 8 || hh === 16) && new Date(t).getMinutes() < 20;
  if (isCollectionRound(Math.floor(h)) && bucketRandom(seed, `bin-collect-${b.id}`, idx) > 0.3) {
    return 8 + bucketRandom(seed, `bin-${b.id}`, idx) * 6;
  }
  let rate = 0.35;
  if (b.type === 'canteen') rate = h >= 12 && h < 14 ? 9 : h >= 18 && h < 20 ? 7 : 1.2;
  else if (b.type === 'hostel') rate = h >= 19 && h < 23 ? 5.5 : h >= 7 && h < 9 ? 3 : 0.8;
  else if (b.type === 'auditorium') rate = h >= 17 && h < 21 ? 6 : 0.5;
  else if (b.type === 'academic' || b.type === 'library') rate = h >= 9 && h < 17 ? 1.6 : 0.3;
  else if (b.type === 'ward' || b.type === 'emergency') rate = 2.2;
  else if (b.type === 'cafeteria') rate = h >= 12 && h < 14 ? 6 : 1;
  else if (b.type === 'waste') rate = 1.5;
  else rate = 0.4;
  rate *= p.wasteMultiplier;
  if (p.truckAvailability < 1) rate *= 1 + (1 - p.truckAvailability) * 0.8;
  const fill = prev + rate * (SIM_MINUTES_PER_TICK / 60) + noise(seed, `bin-${b.id}`, t) * 0.4;
  return clamp(fill, 0, 100);
}

export function genEnergy(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  const occ = genOccupancy(b, t, p, seed) / Math.max(1, b.capacity);
  const tempLoad = Math.max(0, (p.temperatureC - 26) / 12);
  const base = b.type === 'solar' ? 0 : 4 + b.floorArea / 900;
  let load = base * (0.35 + occ * 1.1) * (1 + tempLoad * 1.6);
  if (b.type === 'lab' || b.type === 'workshop' || b.type === 'plant') load *= 1.8;
  if (b.type === 'solar') {
    load = -Math.max(0, 55 * Math.sin(((h - 6) / 12) * Math.PI)) * (p.rainMm > 5 ? 0.4 : 1);
  }
  if (h < 6 || h > 22) load *= 0.45;
  load *= p.energyMultiplier;
  load += noise(seed, `energy-${b.id}`, t) * 1.5;
  return Math.max(b.type === 'solar' ? -60 : 0, load);
}

export function genWater(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  const occ = genOccupancy(b, t, p, seed);
  let flow = 8 + occ * 0.35;
  if (b.type === 'hostel') flow += h >= 6 && h < 9 ? 120 : h >= 18 && h < 22 ? 90 : 0;
  if (b.type === 'canteen') flow += h >= 11 && h < 14 ? 150 : 0;
  if (b.type === 'workshop') flow += 30;
  if (b.type === 'plant') flow += 60;
  flow *= p.waterMultiplier;
  if (p.rainMm > 10) flow *= 0.85;
  flow += noise(seed, `water-${b.id}`, t) * 3;
  return Math.max(0, flow);
}

export function genParking(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  const weekend = isWeekend(t);
  let frac = h >= 8 && h < 18 ? 0.55 + 0.2 * Math.sin(h / 2) : 0.12;
  if (weekend) frac *= 0.5;
  frac *= p.parkingMultiplier * p.crowdMultiplier;
  frac += spikeActive(seed, `park-${b.id}`, t, h, 0.3);
  return clamp(frac, 0, 1.1);
}

export function genTraffic(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  let v = 30;
  if (h >= 8 && h < 10) v = 160;
  else if (h >= 12 && h < 14) v = 110;
  else if (h >= 17 && h < 19) v = 150;
  else if (h >= 21 && h < 23) v = 60;
  v *= p.congestionMultiplier * p.crowdMultiplier;
  v += noise(seed, `traffic-${b.id}`, t) * 12;
  return Math.max(0, v);
}

export function genCongestion(t: number, p: ScenarioParams, seed: number): number {
  const h = hourOfDay(t);
  let v = 0.25;
  if (h >= 8 && h < 10) v = 0.75;
  else if (h >= 12 && h < 14) v = 0.55;
  else if (h >= 17 && h < 19) v = 0.8;
  else if (h >= 21 && h < 23) v = 0.4;
  if (p.rainMm > 8) v += 0.15;
  v *= p.congestionMultiplier;
  v += noise(seed, 'congestion', t) * 0.05;
  return clamp(v, 0, 1);
}

export function genCo2(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const occ = genOccupancy(b, t, p, seed);
  return 420 + occ * 0.35 + noise(seed, `co2-${b.id}`, t) * 15;
}

export function genBeds(b: Building, t: number, p: ScenarioParams, seed: number): number {
  const occ = genOccupancy(b, t, p, seed);
  return Math.round(occ + noise(seed, `beds-${b.id}`, t) * 2);
}

export function genBiomed(b: Building, t: number, _p: ScenarioParams, seed: number, prev: number): number {
  const h = hourOfDay(t);
  const idx = Math.floor(t / (SIM_MINUTES_PER_TICK * MIN));
  if (h === 9 && new Date(t).getMinutes() < 20 && bucketRandom(seed, `biomed-${b.id}`, idx) > 0.4) {
    return 10;
  }
  const rate = h >= 8 && h < 20 ? 2.4 : 0.7;
  return clamp(prev + rate * (SIM_MINUTES_PER_TICK / 60) + noise(seed, `biomed-${b.id}`, t) * 0.3, 0, 100);
}

export function genFlow(b: Building, t: number, _p: ScenarioParams, seed: number): number {
  return genWater(b, t, _p, seed);
}

type GeneratorFn = (b: Building, t: number, p: ScenarioParams, seed: number, prev: number) => number;

export function generatorFor(kind: SensorDef['kind']): GeneratorFn {
  switch (kind) {
    case 'pm25':
    case 'aqi':
      return (b, t, p, s) => genPm25(b, t, p, s);
    case 'temp':
      return (b, t, p, s) => genTemp(b, t, p, s);
    case 'humidity':
      return (b, t, p, s) => genHumidity(b, t, p, s);
    case 'occupancy':
    case 'beds':
      return (b, t, p, s) => (kind === 'beds' ? genBeds(b, t, p, s) : genOccupancy(b, t, p, s));
    case 'bin':
    case 'waste-biomed':
      return (b, t, p, s, prev) =>
        kind === 'waste-biomed' ? genBiomed(b, t, p, s, prev) : genBin(b, t, p, s, prev);
    case 'energy':
      return (b, t, p, s) => genEnergy(b, t, p, s);
    case 'water':
    case 'flow':
      return (b, t, p, s) => genWater(b, t, p, s);
    case 'parking':
      return (b, t, p, s) => genParking(b, t, p, s);
    case 'traffic':
      return (b, t, p, s) => genTraffic(b, t, p, s);
    case 'co2':
      return (b, t, p, s) => genCo2(b, t, p, s);
    default:
      return () => 0;
  }
}

export interface SeriesGenResult {
  sensorId: string;
  buildingId: string;
  points: Array<{ t: number; value: number }>;
}

/**
 * Generate the full 7-day history for one sensor, walking forward so
 * stateful signals (bins) carry over. Deterministic for a given seed.
 */
export function generateSensorSeries(
  _site: SiteConfig,
  building: Building,
  sensor: SensorDef,
  startTime: number,
  params: ScenarioParams,
  seed: number,
): SeriesGenResult {
  const fn = generatorFor(sensor.kind);
  const points: Array<{ t: number; value: number }> = [];
  let prev = sensor.kind === 'bin' || sensor.kind === 'waste-biomed' ? 20 : 0;
  for (let i = 0; i < TOTAL_POINTS; i++) {
    const t = startTime + i * SIM_MINUTES_PER_TICK * MIN;
    const v = fn(building, t, params, seed, prev);
    points.push({ t, value: Math.round(v * 100) / 100 });
    prev = v;
  }
  return { sensorId: sensor.id, buildingId: building.id, points };
}
