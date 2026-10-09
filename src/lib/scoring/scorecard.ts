import type { Scorecard, ScoringConfig, SeriesPoint } from '@/types/domain';

export interface ScorecardInput {
  avgPm25: number;
  binsAbove80Pct: number;
  totalBins: number;
  energyKw: number;
  floorArea: number;
  waterLitresPerDay: number;
  occupancy: number;
  parkingOccupancyPct: number;
  congestionIndex: number;
  openReports: number;
  resolvedReports7d: number;
  totalReports7d: number;
  wasteDiversionPct: number;
  co2eKgPerDay: number;
  weights: ScoringConfig['weights'];
  trends: Record<string, SeriesPoint[]>;
}

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function computeScorecard(input: ScorecardInput): Scorecard {
  const w = input.weights;
  const air = clamp01to100(100 - (input.avgPm25 / 150) * 100);
  const waste = clamp01to100(
    100 * (1 - input.binsAbove80Pct / Math.max(1, input.totalBins)) * 0.6 +
      input.wasteDiversionPct * 0.4,
  );
  const energyIntensity = input.energyKw / Math.max(1, input.floorArea / 1000);
  const energy = clamp01to100(100 - energyIntensity * 8);
  const waterPerCapita = input.waterLitresPerDay / Math.max(1, input.occupancy);
  const water = clamp01to100(100 - Math.max(0, waterPerCapita - 40) * 1.2);
  const mobility = clamp01to100(
    100 * (1 - input.congestionIndex) * 0.6 + 100 * (1 - input.parkingOccupancyPct / 100) * 0.4,
  );
  const reportResolution =
    input.totalReports7d > 0 ? input.resolvedReports7d / input.totalReports7d : 0.8;
  const resilience = clamp01to100(reportResolution * 70 + (1 - Math.min(1, input.openReports / 10)) * 30);

  const subscores = { air, waste, energy, water, mobility, resilience };
  const overall = Math.round(
    air * w.air + waste * w.waste + energy * w.energy + water * w.water + mobility * w.mobility + resilience * w.resilience,
  );
  const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'E';

  return {
    overall,
    grade,
    subscores,
    trends: input.trends as Scorecard['trends'],
    co2eKgPerDay: Math.round(input.co2eKgPerDay),
    wasteDiversionPct: Math.round(input.wasteDiversionPct),
    assumptions: [
      'Scores are heuristic composites for decision support, not certified audits.',
      'CO2e uses the configured grid emission factor (default 0.72 kg/kWh, India grid average per CEA).',
      'Weights are editable by the user and change the overall score immediately.',
      'All inputs are simulated in this demo.',
    ],
  };
}
