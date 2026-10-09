import type { SeriesPoint } from '@/types/domain';

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  expected: number;
  observed: number;
  method: string;
  window: number;
  zScore: number;
}

/**
 * Rolling z-score with EWMA smoothing.
 * Compares the latest value against a rolling mean/std of the previous
 * `window` points (default 32 ≈ 8h at 15-min resolution).
 */
export function rollingZScore(
  series: SeriesPoint[],
  window = 32,
  threshold = 3,
  ewmaAlpha = 0.3,
): AnomalyResult {
  if (series.length < window + 1) {
    return {
      isAnomaly: false,
      score: 0,
      expected: series[series.length - 1]?.value ?? 0,
      observed: series[series.length - 1]?.value ?? 0,
      method: 'rolling-zscore',
      window,
      zScore: 0,
    };
  }
  const recent = series.slice(-window - 1);
  const observed = recent[recent.length - 1].value;
  const history = recent.slice(0, -1).map((p) => p.value);

  let mean = history[0];
  for (let i = 1; i < history.length; i++) mean = mean + ewmaAlpha * (history[i] - mean);
  const variance =
    history.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, history.length - 1);
  const std = Math.sqrt(variance) || 1e-6;
  const zScore = (observed - mean) / std;

  return {
    isAnomaly: Math.abs(zScore) >= threshold,
    score: Math.min(1, Math.abs(zScore) / (threshold * 2)),
    expected: Math.round(mean * 100) / 100,
    observed,
    method: 'rolling-zscore+ewma',
    window,
    zScore: Math.round(zScore * 100) / 100,
  };
}

/**
 * Simplified isolation-forest-style score for multivariate points.
 * Documents as illustrative: random-axis splits over a small ensemble of
 * shallow trees, score = average path length normalised. Not a real IF
 * implementation — good enough to rank odd combinations of
 * (energy, occupancy, hour-of-day).
 */
export function isolationScore(points: number[][], sampleSize = 32): number {
  if (points.length < 8) return 0;
  const sample = points.slice(-sampleSize);
  const dims = points[0].length;
  const trees = 12;
  const maxDepth = 6;

  function pathLength(point: number[], depth: number): number {
    if (depth >= maxDepth || sample.length <= 1) return depth;
    const dim = Math.floor(Math.random() * dims);
    const values = sample.map((p) => p[dim]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return depth;
    const split = min + Math.random() * (max - min);
    const goesLeft = point[dim] < split;
    const next = sample.filter((p) => (p[dim] < split) === goesLeft);
    if (next.length <= 1) return depth;
    const saved = sample.length;
    sample.length = 0;
    sample.push(...next);
    const result = pathLength(point, depth + 1);
    sample.length = saved;
    sample.push(...next);
    return result;
  }

  const target = points[points.length - 1];
  let total = 0;
  for (let i = 0; i < trees; i++) total += pathLength(target, 0);
  const avgPath = total / trees;
  const n = sample.length;
  const c = 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  const score = Math.pow(2, -avgPath / (c || 1));
  return Math.min(1, Math.max(0, score));
}

/** Cooldown-aware dedupe: one alert per sensor per cooldown window. */
export function shouldFire(
  lastAlertTime: Record<string, number>,
  sensorKey: string,
  t: number,
  cooldownMs: number,
): boolean {
  const last = lastAlertTime[sensorKey];
  if (last === undefined || t - last >= cooldownMs) {
    lastAlertTime[sensorKey] = t;
    return true;
  }
  return false;
}
