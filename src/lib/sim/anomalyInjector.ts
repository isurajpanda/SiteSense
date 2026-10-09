import type { SiteConfig } from '@/types/domain';
import { TOTAL_POINTS, SIM_MINUTES_PER_TICK } from './clock';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export type SeriesMap = Map<string, Array<{ t: number; value: number }>>;

function key(buildingId: string, sensorId: string): string {
  return `${buildingId}:${sensorId}`;
}

/**
 * Scheduled demo anomalies so the demo always has a story to tell.
 * Applied to the most recent day of history (and live ticks continue them).
 * All modifications are deterministic.
 */
export function injectDemoAnomalies(_site: SiteConfig, series: SeriesMap, liveStart: number): void {
  const lastDayStart = liveStart - DAY;

  // 1. Hostel E bin: rapid fill on the last day so it approaches 100% around 16:00.
  const hostelCBin = series.get(key('hostel-east', 'bin'));
  if (hostelCBin) {
    for (const pt of hostelCBin) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 9 && h < 16) pt.value = Math.min(100, pt.value + 6.5);
      }
    }
  }

  // 2. Canteen PM2.5 spike at lunch on the last day.
  const canteenPm = series.get(key('canteen', 'pm25'));
  if (canteenPm) {
    for (const pt of canteenPm) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 12 && h < 13.5) pt.value += 55 * Math.sin(((h - 12) / 1.5) * Math.PI);
      }
    }
  }

  // 3. Hostel S water leak: constant elevated night flow on the last day.
  const hostelBWater = series.get(key('hostel-south', 'water'));
  if (hostelBWater) {
    for (const pt of hostelBWater) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 23 || h < 5) pt.value += 55;
      }
    }
  }

  // 4. Science Labs energy anomaly: equipment left on after hours on the last day.
  const csEnergy = series.get(key('science-labs', 'energy'));
  if (csEnergy) {
    for (const pt of csEnergy) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 21 || h < 6) pt.value += 28;
      }
    }
  }

  // 5. Parking surge before an event on the last day afternoon.
  const parking = series.get(key('parking', 'parking'));
  if (parking) {
    for (const pt of parking) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 14 && h < 18) pt.value = Math.min(1.05, pt.value + 0.35);
      }
    }
  }

  // 6. Auditorium event energy + occupancy bump on the last day evening.
  const audEnergy = series.get(key('auditorium', 'energy'));
  if (audEnergy) {
    for (const pt of audEnergy) {
      if (pt.t >= lastDayStart) {
        const h = new Date(pt.t).getHours() + new Date(pt.t).getMinutes() / 60;
        if (h >= 17 && h < 21) pt.value += 30;
      }
    }
  }
}

/** Live-tick anomaly continuation: keeps injected signatures going after history ends. */
export function liveAnomalyValue(
  _site: SiteConfig,
  buildingId: string,
  sensorId: string,
  t: number,
  baseValue: number,
): number {
  const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  if (buildingId === 'hostel-south' && sensorId === 'water' && (h >= 23 || h < 5)) return baseValue + 55;
  if (buildingId === 'science-labs' && sensorId === 'energy' && (h >= 21 || h < 6)) return baseValue + 28;
  if (buildingId === 'canteen' && sensorId === 'pm25' && h >= 12 && h < 13.5)
    return baseValue + 55 * Math.sin(((h - 12) / 1.5) * Math.PI);
  return baseValue;
}

export { TOTAL_POINTS, SIM_MINUTES_PER_TICK };
