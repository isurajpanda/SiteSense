import type { Forecast, ForecastPoint, SeriesPoint } from '@/types/domain';
import { SIM_MINUTES_PER_TICK } from '@/lib/sim/clock';

const MIN = 60 * 1000;
const SEASON = 96; // 24h at 15-min resolution

/**
 * Holt-Winters additive (triple exponential smoothing) with a 24h seasonal
 * cycle, plus a residual-std prediction interval.
 * Label: "Holt-Winters additive, 24h seasonality".
 */
export function holtWinters(
  series: SeriesPoint[],
  horizonHours: number,
  label: string,
  sensorId: string,
  buildingId: string,
  unit: string,
  assumptions: string[],
): Forecast {
  const values = series.map((p) => p.value);
  const n = values.length;
  const alpha = 0.35;
  const beta = 0.08;
  const gamma = 0.12;

  const seasonals: number[] = new Array(SEASON).fill(0);
  for (let i = 0; i < SEASON; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i; j < n; j += SEASON) {
      sum += values[j];
      count++;
    }
    seasonals[i] = count > 0 ? sum / count : 0;
  }
  const overallMean = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  for (let i = 0; i < SEASON; i++) seasonals[i] = seasonals[i] - overallMean || 0;

  let level = values.slice(0, SEASON).reduce((a, b) => a + b, 0) / SEASON;
  let trend = (values[SEASON] - values[0]) / SEASON;

  for (let t = 0; t < n; t++) {
    const s = seasonals[t % SEASON];
    const newLevel = alpha * (values[t] - s) + (1 - alpha) * (level + trend);
    const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
    seasonals[t % SEASON] = gamma * (values[t] - newLevel) + (1 - gamma) * s;
    level = newLevel;
    trend = newTrend;
  }

  const residuals: number[] = [];
  for (let t = Math.max(SEASON, n - SEASON * 2); t < n; t++) {
    const fit = level + trend * (t - n) + seasonals[t % SEASON];
    residuals.push(values[t] - fit);
  }
  const resStd =
    Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, residuals.length)) || 1;

  const steps = Math.round((horizonHours * 60) / SIM_MINUTES_PER_TICK);
  const lastT = series[n - 1].t;
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= steps; h++) {
    const seasonal = seasonals[(n + h - 1) % SEASON];
    const value = level + trend * h + seasonal;
    const margin = 1.28 * resStd * Math.sqrt(1 + h / SEASON);
    points.push({
      t: lastT + h * SIM_MINUTES_PER_TICK * MIN,
      value: Math.round(value * 100) / 100,
      lower: Math.round((value - margin) * 100) / 100,
      upper: Math.round((value + margin) * 100) / 100,
    });
  }

  return {
    sensorId,
    buildingId,
    label,
    unit,
    model: 'Holt-Winters additive (24h seasonality)',
    horizonHours,
    windowHours: Math.round((n * SIM_MINUTES_PER_TICK) / 60),
    points,
    assumptions,
  };
}

/** Seasonal-naive fallback when series is too short for Holt-Winters. */
export function seasonalNaive(
  series: SeriesPoint[],
  horizonHours: number,
  label: string,
  sensorId: string,
  buildingId: string,
  unit: string,
  assumptions: string[],
): Forecast {
  const n = series.length;
  const lastT = series[n - 1].t;
  const steps = Math.round((horizonHours * 60) / SIM_MINUTES_PER_TICK);
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= steps; h++) {
    const ref = series[n - 1 - ((h - 1) % SEASON)];
    const value = ref?.value ?? 0;
    points.push({ t: lastT + h * SIM_MINUTES_PER_TICK * MIN, value, lower: value * 0.85, upper: value * 1.15 });
  }
  return {
    sensorId,
    buildingId,
    label,
    unit,
    model: 'Seasonal naive (24h)',
    horizonHours,
    windowHours: Math.round((n * SIM_MINUTES_PER_TICK) / 60),
    points,
    assumptions: [...assumptions, 'Series too short for Holt-Winters; seasonal-naive used.'],
  };
}

export function forecastSeries(
  series: SeriesPoint[],
  horizonHours: number,
  label: string,
  sensorId: string,
  buildingId: string,
  unit: string,
  assumptions: string[],
): Forecast {
  if (series.length === 0) {
    return {
      sensorId,
      buildingId,
      label,
      unit,
      model: 'insufficient data',
      horizonHours,
      windowHours: 0,
      points: [],
      assumptions: [...assumptions, 'No history for this sensor yet; forecast unavailable.'],
    };
  }
  if (series.length >= SEASON * 2) {
    return holtWinters(series, horizonHours, label, sensorId, buildingId, unit, assumptions);
  }
  return seasonalNaive(series, horizonHours, label, sensorId, buildingId, unit, assumptions);
}
