import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Info, Leaf, Droplets, Sun, ShieldAlert } from 'lucide-react';
import { getSite } from '@/config/sites';
import { useSimStore } from '@/store/useSimStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useReportStore } from '@/store/useReportStore';
import { computeScorecard } from '@/lib/scoring/scorecard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import Sparkline from '@/components/charts/Sparkline';
import { cn } from '@/lib/utils';

const SUBSCORE_META: Array<{ key: 'air' | 'waste' | 'energy' | 'water' | 'mobility' | 'resilience'; label: string; icon: typeof Leaf }> = [
  { key: 'air', label: 'Air', icon: Leaf },
  { key: 'waste', label: 'Waste', icon: Droplets },
  { key: 'energy', label: 'Energy', icon: Sun },
  { key: 'water', label: 'Water', icon: Droplets },
  { key: 'mobility', label: 'Mobility', icon: ShieldAlert },
  { key: 'resilience', label: 'Resilience', icon: ShieldAlert },
];

export default function SustainabilityPage() {
  const siteId = useSettingsStore((s) => s.siteId);
  const weights = useSettingsStore((s) => s.weights);
  const setWeight = useSettingsStore((s) => s.setWeight);
  const kpis = useSimStore((s) => s.kpis);
  const binStates = useSimStore((s) => s.binStates);
  const congestion = useSimStore((s) => s.congestion);
  const reports = useReportStore((s) => s.reports);
  const site = getSite(siteId);
  const [showMethod, setShowMethod] = useState(false);

  const scorecard = useMemo(() => {
    const totalBins = site.bins.length;
    const binsAbove80 = Object.values(binStates).filter((v) => v > 80).length;
    const floorArea = site.buildings.reduce((a, b) => a + b.floorArea, 0);
    const resolved7d = reports.filter((r) => r.status === 'resolved').length;
    const total7d = reports.length;
    const energyKwhPerDay = kpis.energyKw * 24;
    const co2e = energyKwhPerDay * site.emissions.gridFactorKgPerKwh;
    const trends = SUBSCORE_META.reduce(
      (acc, m) => {
        acc[m.key] = Array.from({ length: 14 }, (_, i) => ({
          t: i,
          value: 60 + 20 * Math.sin(i / 2 + m.key.length) + (i % 3) * 4,
        }));
        return acc;
      },
      {} as Record<string, { t: number; value: number }[]>,
    );
    return computeScorecard({
      avgPm25: kpis.campusAqi,
      binsAbove80Pct: (binsAbove80 / Math.max(1, totalBins)) * 100,
      totalBins,
      energyKw: kpis.energyKw,
      floorArea,
      waterLitresPerDay: kpis.waterLph * 24,
      occupancy: Math.max(1, kpis.totalPeople),
      parkingOccupancyPct: kpis.parkingOccupancyPct,
      congestionIndex: Object.values(congestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(congestion).length),
      openReports: reports.filter((r) => r.status !== 'resolved').length,
      resolvedReports7d: resolved7d,
      totalReports7d: total7d,
      wasteDiversionPct: 42,
      co2eKgPerDay: co2e,
      weights: {
        air: weights.air ?? 0.2,
        waste: weights.waste ?? 0.15,
        energy: weights.energy ?? 0.2,
        water: weights.water ?? 0.15,
        mobility: weights.mobility ?? 0.15,
        resilience: weights.resilience ?? 0.15,
      },
      trends,
    });
  }, [site, binStates, kpis, congestion, reports, weights]);

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Overall score', scorecard.overall],
      ['Grade', scorecard.grade],
      ...SUBSCORE_META.map((m) => [`Subscore ${m.label}`, scorecard.subscores[m.key]]),
      ['CO2e kg/day', scorecard.co2eKgPerDay],
      ['Waste diversion %', scorecard.wasteDiversionPct],
      ['Grid factor kg/kWh', site.emissions.gridFactorKgPerKwh],
      ['Generated', new Date().toISOString()],
      ['Note', 'Simulated data — decision support, not official measurements'],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitesense-sustainability-${site.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-[#000000] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-wider text-[#fafafa]">Sustainability Scorecard</h1>
            <p className="text-xs text-muted-foreground">
              {site.name} · heuristic composite for decision support, not a certified audit
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMethod(!showMethod)}>
              <Info size={13} /> How this is calculated
            </Button>
            <Button variant="default" size="sm" onClick={exportCsv}>
              <Download size={13} /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Back to HUD</Link>
            </Button>
          </div>
        </div>

        {showMethod && (
          <Card className="mb-4 border-data/30">
            <CardHeader>
              <CardTitle>How this is calculated</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>
                Overall = Σ (subscore × weight). Subscores are 0–100 heuristics: Air = 100 − (PM2.5/150)×100;
                Waste = 60% bin-headroom + 40% diversion; Energy = 100 − intensity×8; Water = 100 − per-capita
                excess×1.2; Mobility = 60% congestion + 40% parking headroom; Resilience = 70% report resolution +
                30% open-report headroom.
              </p>
              <p className="mt-2">
                CO2e = energy (kWh/day) × grid factor ({site.emissions.gridFactorKgPerKwh} kg/kWh, India grid
                average per CEA — configurable in site config). Weights below are editable and change the score
                immediately.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hud-corner md:col-span-1">
            <CardHeader>
              <CardTitle>Overall</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-24 w-24 items-center justify-center rounded-full border-4 font-display text-3xl font-bold',
                  scorecard.overall >= 70
                    ? 'border-ok/50 text-ok'
                    : scorecard.overall >= 55
                      ? 'border-warn/50 text-warn'
                      : 'border-crit/50 text-crit',
                )}
              >
                {scorecard.grade}
              </div>
              <div>
                <div className="font-display text-4xl tabular-nums text-[#fafafa]">{scorecard.overall}</div>
                <div className="text-xs text-muted-foreground">/ 100</div>
                <div className="mt-2 text-xs text-data">CO₂e ≈ {scorecard.co2eKgPerDay} kg/day</div>
                <div className="text-xs text-muted-foreground">
                  Waste diversion ≈ {scorecard.wasteDiversionPct}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hud-corner md:col-span-2">
            <CardHeader>
              <CardTitle>Sub-scores & trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUBSCORE_META.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="rounded border border-border bg-[#000000]/60 p-3">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-data" />
                      <span className="font-hud text-xs font-bold uppercase tracking-wider">{label}</span>
                      <span
                        className={cn(
                          'ml-auto font-display text-lg tabular-nums',
                          scorecard.subscores[key] >= 70
                            ? 'text-ok'
                            : scorecard.subscores[key] >= 55
                              ? 'text-warn'
                              : 'text-crit',
                        )}
                      >
                        {scorecard.subscores[key]}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Sparkline
                        data={scorecard.trends[key] ?? []}
                        color={scorecard.subscores[key] >= 70 ? '#00E5C3' : scorecard.subscores[key] >= 55 ? '#FFB020' : '#FF4D5E'}
                        width={200}
                        height={32}
                      />
                    </div>
                    <div className="mt-2">
                      <Slider
                        ariaLabel={`${label} weight`}
                        min={0}
                        max={0.4}
                        step={0.01}
                        value={weights[key] ?? 0.15}
                        onValueChange={(v) => setWeight(key, v)}
                      />
                      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>weight</span>
                        <span className="font-mono">{((weights[key] ?? 0.15) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="hud-corner">
            <CardHeader>
              <CardTitle>Climate resilience (illustrative)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-warn">Heat index exposure:</span> outdoor areas (sports
                ground, parking) see peak heat stress 12:00–15:00 in summer. Shade/green cover placeholder —
                not measured.
              </p>
              <p>
                <span className="font-semibold text-data">Waterlogging-prone zones:</span> main gate approach
                and parking access road (low-lying in config). Monsoon scenario shows collection delays.
              </p>
              <p>
                <span className="font-semibold text-ok">Adaptive capacity:</span> report resolution rate and
                scenario-tested response (see /scenarios).
              </p>
              <Separator />
              <p className="text-[10px]">Illustrative card — not a climate risk assessment.</p>
            </CardContent>
          </Card>
          <Card className="hud-corner">
            <CardHeader>
              <CardTitle>Assumptions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {scorecard.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-6 border-t border-border pt-3 text-center text-[10px] text-muted-foreground">
          Decision-support insights, not official measurements. All data simulated. ·{' '}
          <Link to="/about" className="text-data underline">
            Assumptions & method
          </Link>
        </footer>
      </div>
    </div>
  );
}
