import type { BinEta, SeriesPoint } from '@/types/domain';

/**
 * Bin overflow ETA: linear fill-rate extrapolation over the recent window,
 * scaled by a time-of-day multiplier (fills faster at meal times).
 */
export function binEta(series: SeriesPoint[], currentFill: number, capacityPct = 100): Omit<BinEta, 'binId' | 'buildingId'> {
  const windowPts = series.slice(-16);
  if (windowPts.length < 4) {
    return { etaMinutes: null, confidence: 'low', fillRatePerHour: 0, currentFill };
  }
  const first = windowPts[0];
  const last = windowPts[windowPts.length - 1];
  const hours = (last.t - first.t) / 3600000;
  const rawRate = hours > 0 ? (last.value - first.value) / hours : 0;

  const h = new Date(last.t).getHours() + new Date(last.t).getMinutes() / 60;
  const todMultiplier =
    h >= 12 && h < 14 ? 1.6 : h >= 18 && h < 21 ? 1.4 : h >= 7 && h < 9 ? 1.2 : h >= 22 || h < 6 ? 0.4 : 1;
  const fillRatePerHour = rawRate * todMultiplier;

  if (fillRatePerHour <= 0.5 || currentFill >= capacityPct) {
    return {
      etaMinutes: currentFill >= capacityPct ? 0 : null,
      confidence: 'low',
      fillRatePerHour: Math.round(fillRatePerHour * 10) / 10,
      currentFill,
    };
  }
  const remaining = capacityPct - currentFill;
  const etaMinutes = Math.round((remaining / fillRatePerHour) * 60);
  const confidence = rawRate > 3 ? 'high' : rawRate > 1 ? 'moderate' : 'low';
  return { etaMinutes, confidence, fillRatePerHour: Math.round(fillRatePerHour * 10) / 10, currentFill };
}
