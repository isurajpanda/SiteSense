import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  RotateCcw,
  PartyPopper,
  BookOpen,
  ThermometerSun,
  Wind,
  CloudRain,
  FlaskConical,
  AlertTriangle,
  Lightbulb,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getSite } from '@/config/sites';
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/lib/sim/scenarios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import ComparisonBars from '@/components/charts/ComparisonBars';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { ScenarioParams, ScenarioSnapshot, Severity } from '@/types/domain';

const PRESET_ICONS: Record<string, LucideIcon> = {
  PartyPopper,
  BookOpen,
  ThermometerSun,
  Wind,
  CloudRain,
};

const PARAM_CHIPS: Record<keyof ScenarioParams, { label: string; format: (v: number) => string }> = {
  crowdMultiplier: { label: 'crowd', format: (v) => `${v.toFixed(1)}×` },
  temperatureC: { label: 'temp', format: (v) => `${v}°C` },
  rainMm: { label: 'rain', format: (v) => `${v}mm` },
  eventDurationHrs: { label: 'duration', format: (v) => `${v}h` },
  truckAvailability: { label: 'trucks', format: (v) => `${Math.round(v * 100)}%` },
  pm25Multiplier: { label: 'PM2.5', format: (v) => `${v.toFixed(1)}×` },
  occupancyMultiplier: { label: 'occupancy', format: (v) => `${v.toFixed(1)}×` },
  wasteMultiplier: { label: 'waste', format: (v) => `${v.toFixed(1)}×` },
  energyMultiplier: { label: 'energy', format: (v) => `${v.toFixed(1)}×` },
  waterMultiplier: { label: 'water', format: (v) => `${v.toFixed(1)}×` },
  parkingMultiplier: { label: 'parking', format: (v) => `${v.toFixed(1)}×` },
  congestionMultiplier: { label: 'congestion', format: (v) => `${v.toFixed(1)}×` },
};

const SLIDERS: {
  key: keyof ScenarioParams;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}[] = [
  { key: 'crowdMultiplier', label: 'Crowd multiplier', min: 0.5, max: 2.5, step: 0.1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'temperatureC', label: 'Temperature', min: 25, max: 45, step: 1, format: (v) => `${v}°C` },
  { key: 'rainMm', label: 'Rainfall', min: 0, max: 50, step: 1, format: (v) => `${v} mm` },
  { key: 'eventDurationHrs', label: 'Event duration', min: 2, max: 24, step: 1, format: (v) => `${v} hrs` },
  { key: 'truckAvailability', label: 'Truck availability', min: 0.3, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'pm25Multiplier', label: 'PM2.5 multiplier', min: 0.5, max: 4, step: 0.1, format: (v) => `${v.toFixed(1)}×` },
];

const COMPARISON_LABELS: Record<string, string> = {
  totalPeople: 'People',
  avgPm25: 'PM2.5',
  parkingOccupancyPct: 'Parking %',
  energyKw: 'Energy kW',
  congestionIndex: 'Congestion',
  binsAbove80: 'Bins >80%',
};

const DELTA_ROWS: {
  key: keyof ScenarioSnapshot;
  label: string;
  format: (v: number) => string;
}[] = [
  { key: 'totalPeople', label: 'People on site', format: (v) => v.toLocaleString() },
  { key: 'avgPm25', label: 'PM2.5', format: (v) => v.toFixed(1) },
  { key: 'binsAbove80', label: 'Bins >80%', format: (v) => `${v}` },
  { key: 'openReports', label: 'Open reports', format: (v) => `${v}` },
  { key: 'parkingOccupancyPct', label: 'Parking occupancy', format: (v) => `${v}%` },
  { key: 'energyKw', label: 'Energy', format: (v) => v.toLocaleString() },
  { key: 'congestionIndex', label: 'Congestion index', format: (v) => v.toFixed(2) },
  { key: 'waterLitres', label: 'Water', format: (v) => v.toLocaleString() },
];

const SEVERITY_VARIANT: Record<Severity, 'ok' | 'warning' | 'destructive'> = {
  ok: 'ok',
  warning: 'warning',
  critical: 'destructive',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  ok: 'OK',
  warning: 'WARNING',
  critical: 'CRITICAL',
};

function deltaPct(baseline: number, projected: number): number | null {
  if (baseline === 0) return projected === 0 ? 0 : null;
  return ((projected - baseline) / baseline) * 100;
}

function snapshotRecord(s: ScenarioSnapshot): Record<string, number> {
  return {
    totalPeople: s.totalPeople,
    avgPm25: s.avgPm25,
    binsAbove80: s.binsAbove80,
    openReports: s.openReports,
    parkingOccupancyPct: s.parkingOccupancyPct,
    energyKw: s.energyKw,
    congestionIndex: s.congestionIndex,
    waterLitres: s.waterLitres,
  };
}

function presetChips(preset: ScenarioPreset): string[] {
  return (Object.keys(preset.params) as (keyof ScenarioParams)[]).map((k) => {
    const chip = PARAM_CHIPS[k];
    return `${chip.label} ${chip.format(preset.params[k] ?? 0)}`;
  });
}

export default function ScenariosPage() {
  const siteId = useSettingsStore((s) => s.siteId);
  const site = getSite(siteId);
  const scenario = useSimStore((s) => s.scenario);
  const runScenario = useSimStore((s) => s.runScenario);
  const resetScenario = useSimStore((s) => s.resetScenario);

  const [sliders, setSliders] = useState<ScenarioParams>({ ...site.scenarioDefaults });

  useEffect(() => {
    setSliders({ ...getSite(siteId).scenarioDefaults });
  }, [siteId]);

  const activePresetId = useMemo(() => {
    if (!scenario) return null;
    const match = SCENARIO_PRESETS.find((p) => {
      const merged = { ...site.scenarioDefaults, ...p.params };
      return (Object.keys(merged) as (keyof ScenarioParams)[]).every(
        (k) => Math.abs(merged[k] - scenario.params[k]) < 1e-9,
      );
    });
    return match?.id ?? null;
  }, [scenario, site]);

  const pmSeries = useMemo(() => {
    if (!scenario) return null;
    const now = Date.now();
    const HOUR = 3600_000;
    const baselineSeries = Array.from({ length: 24 }, (_, i) => ({
      t: now - (23 - i) * HOUR,
      value: Math.round((scenario.baseline.avgPm25 + i * 0.2) * 10) / 10,
    }));
    const projectedSeries = Array.from({ length: 24 }, (_, i) => {
      const frac = i / 23;
      const v = scenario.baseline.avgPm25 + (scenario.projected.avgPm25 - scenario.baseline.avgPm25) * frac;
      return { t: now - (23 - i) * HOUR, value: Math.round(v * 10) / 10 };
    });
    return { baselineSeries, projectedSeries };
  }, [scenario]);

  const runPreset = (preset: ScenarioPreset) => {
    const params: ScenarioParams = { ...site.scenarioDefaults, ...preset.params };
    runScenario(params, preset.name, preset.description);
    toast({ title: 'Scenario running', description: preset.name, variant: 'success' });
  };

  const runCustom = () => {
    const params: ScenarioParams = { ...site.scenarioDefaults, ...sliders };
    runScenario(params, 'Custom scenario', 'Custom parameter set from the slider panel.');
    toast({ title: 'Scenario running', description: 'Custom scenario', variant: 'success' });
  };

  const reset = () => {
    resetScenario();
    toast({ title: 'Reset to live', description: 'Returned to the live baseline.' });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#000000] text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to HUD"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-hud text-sm font-semibold uppercase tracking-wider">Scenario Simulator</h1>
            <p className="text-xs text-muted-foreground">
              Re-run the simulator and models with modified parameters. Does not corrupt the live baseline.
            </p>
          </div>
        </div>
        {scenario && (
          <Button variant="outline" size="sm" onClick={reset} aria-label="Reset to live baseline">
            <RotateCcw size={12} />
            Reset to live
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-4 p-4">
          <section aria-label="Scenario presets">
            <h2 className="hud-label mb-2">Presets</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {SCENARIO_PRESETS.map((preset) => {
                const Icon = PRESET_ICONS[preset.icon] ?? FlaskConical;
                const active = preset.id === activePresetId;
                const chips = presetChips(preset);
                return (
                  <button
                    key={preset.id}
                    onClick={() => runPreset(preset)}
                    aria-pressed={active}
                    className={cn(
                      'hud-panel hud-corner rounded-md p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'border-data bg-data/10' : 'hover:bg-accent',
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Icon size={14} className={active ? 'text-data' : 'text-muted-foreground'} />
                      <span className="font-hud text-xs font-semibold uppercase tracking-wider">{preset.name}</span>
                    </div>
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{preset.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {chips.slice(0, 4).map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {chip}
                        </span>
                      ))}
                      {chips.length > 4 && (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          +{chips.length - 4} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Custom scenario parameters">
            <Card className="hud-panel hud-corner">
              <CardHeader className="pb-2">
                <CardTitle>Custom scenario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SLIDERS.map((s) => (
                    <div key={s.key}>
                      <div className="mb-1 flex items-center justify-between">
                        <label htmlFor={`slider-${s.key}`} className="hud-label">
                          {s.label}
                        </label>
                        <span className="font-display text-xs tabular-nums text-[#fafafa]">{s.format(sliders[s.key])}</span>
                      </div>
                      <Slider
                        value={sliders[s.key]}
                        onValueChange={(v) => setSliders((prev) => ({ ...prev, [s.key]: v }))}
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        ariaLabel={s.label}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={runCustom} aria-label="Run custom scenario">
                    <Play size={12} />
                    Run custom scenario
                  </Button>
                  <Button variant="outline" onClick={reset} aria-label="Reset to live baseline">
                    <RotateCcw size={12} />
                    Reset to live
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {scenario ? (
            <div className="space-y-4">
              <div
                role="status"
                className="hud-panel hud-corner flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-data" />
                  <span className="font-hud text-xs font-semibold uppercase tracking-wider">
                    Scenario active: {scenario.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Reset to live to return</span>
              </div>

              <section aria-label="Before and after comparison">
                <Card className="hud-panel hud-corner">
                  <CardHeader className="pb-2">
                    <CardTitle>Before vs After</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ComparisonBars
                      baseline={snapshotRecord(scenario.baseline)}
                      projected={snapshotRecord(scenario.projected)}
                      labels={COMPARISON_LABELS}
                      unit=""
                    />
                    <Separator />
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="hud-label py-1.5 pr-3">Metric</th>
                            <th className="hud-label py-1.5 pr-3 text-right">Baseline</th>
                            <th className="hud-label py-1.5 pr-3 text-right">Projected</th>
                            <th className="hud-label py-1.5 text-right">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DELTA_ROWS.map((row) => {
                            const b = scenario.baseline[row.key];
                            const p = scenario.projected[row.key];
                            const pct = deltaPct(b, p);
                            const improved = pct !== null && pct < 0;
                            const worsened = pct !== null && pct > 0;
                            return (
                              <tr key={row.key} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 pr-3 text-muted-foreground">{row.label}</td>
                                <td className="py-1.5 pr-3 text-right font-display tabular-nums">{row.format(b)}</td>
                                <td className="py-1.5 pr-3 text-right font-display tabular-nums text-[#fafafa]">
                                  {row.format(p)}
                                </td>
                                <td
                                  className={cn(
                                    'py-1.5 text-right font-display tabular-nums',
                                    improved && 'text-ok',
                                    worsened && 'text-crit',
                                    !improved && !worsened && 'text-muted-foreground',
                                  )}
                                >
                                  {pct === null ? (p > 0 ? 'new' : '—') : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section aria-label="Alerts the scenario would trigger">
                <Card className="hud-panel hud-corner">
                  <CardHeader className="pb-2">
                    <CardTitle>Alerts the scenario would trigger</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scenario.newAlerts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No new alerts would be triggered.</p>
                    ) : (
                      <ul className="space-y-2">
                        {scenario.newAlerts.map((alert) => (
                          <li key={alert.id} className="rounded-md border border-border p-2.5">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant={SEVERITY_VARIANT[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
                              <span className="text-xs font-medium text-[#fafafa]">{alert.buildingName}</span>
                              <Badge variant="outline">{alert.method}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{alert.message}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Observed {alert.observed} {alert.unit} vs expected {alert.expected} {alert.unit} (threshold{' '}
                              {alert.threshold} {alert.unit})
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section aria-label="Recommendations the engine would issue">
                <Card className="hud-panel hud-corner">
                  <CardHeader className="pb-2">
                    <CardTitle>Recommendations the engine would issue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Lightbulb size={11} />
                      Rules + forecasts + templates (no LLM)
                    </p>
                    {scenario.newRecommendations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No new recommendations would be issued.</p>
                    ) : (
                      <ul className="space-y-2">
                        {scenario.newRecommendations.map((reco) => (
                          <li key={reco.id} className="rounded-md border border-border p-2.5">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant={SEVERITY_VARIANT[reco.severity]}>{SEVERITY_LABEL[reco.severity]}</Badge>
                              <span className="text-xs font-medium text-[#fafafa]">{reco.title}</span>
                              <span className="text-[11px] text-muted-foreground">
                                confidence {Math.round(reco.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{reco.plainLanguage}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>

              {pmSeries && (
                <section aria-label="Time series impact">
                  <Card className="hud-panel hud-corner">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle size={13} className="text-warn" />
                        PM2.5 impact — illustrative projection curve
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <p className="hud-label mb-1">Baseline</p>
                          <TimeSeriesChart data={pmSeries.baselineSeries} height={160} color="#3D8BFF" unit="µg/m³" />
                        </div>
                        <div>
                          <p className="hud-label mb-1">Projected</p>
                          <TimeSeriesChart data={pmSeries.projectedSeries} height={160} color="#00E5C3" unit="µg/m³" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}
            </div>
          ) : (
            <div className="hud-panel hud-corner flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <FlaskConical size={28} className="text-muted-foreground" />
              <p className="font-hud text-sm font-semibold uppercase tracking-wider">No scenario running</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Select a preset or adjust the sliders and run a custom scenario to see projected impact on alerts,
                recommendations and KPIs.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
