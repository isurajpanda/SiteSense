import { useMemo } from 'react';
import { MapPin, Users, Ruler } from 'lucide-react';
import { getSite } from '@/config/sites';
import { useSimStore } from '@/store/useSimStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { forecastSeries } from '@/lib/models/forecast';
import { Sheet, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import WhyThisFired from '@/components/explain/WhyThisFired';
import type { Building, SensorDef } from '@/types/domain';

const SENSOR_CHART_DEFS: Record<string, { label: string; color: string }> = {
  pm25: { label: 'PM2.5', color: '#FFB020' },
  temp: { label: 'Temperature', color: '#FB923C' },
  humidity: { label: 'Humidity', color: '#3D8BFF' },
  occupancy: { label: 'Occupancy', color: '#00E5C3' },
  bin: { label: 'Bin fill', color: '#A78BFA' },
  energy: { label: 'Energy', color: '#3D8BFF' },
  water: { label: 'Water', color: '#38BDF8' },
  parking: { label: 'Parking', color: '#F472B6' },
  traffic: { label: 'Traffic', color: '#FBBF24' },
  co2: { label: 'CO₂', color: '#94A3B8' },
};

function statusOf(buildingId: string, alerts: { buildingId: string; severity: string }[]): 'ok' | 'warning' | 'critical' {
  const bas = alerts.filter((a) => a.buildingId === buildingId);
  if (bas.some((a) => a.severity === 'critical')) return 'critical';
  if (bas.some((a) => a.severity === 'warning')) return 'warning';
  return 'ok';
}

const STATUS_BADGE = { ok: 'ok', warning: 'warning', critical: 'destructive' } as const;

export default function BuildingDrawer({
  buildingId,
  onClose,
}: {
  buildingId: string | null;
  onClose: () => void;
}) {
  const siteId = useSettingsStore((s) => s.siteId);
  const history = useSimStore((s) => s.history);
  const alerts = useSimStore((s) => s.alerts);
  const scrubTime = useSimStore((s) => s.scrubTime);
  const site = getSite(siteId);
  const building = site.buildings.find((b) => b.id === buildingId) ?? null;

  const buildingAlerts = useMemo(
    () => (building ? alerts.filter((a) => a.buildingId === building.id).slice(0, 3) : []),
    [alerts, building],
  );

  if (!building) return null;
  const status = statusOf(building.id, alerts);

  return (
    <Sheet open={!!buildingId} onOpenChange={(o) => !o && onClose()} side="right">
      <SheetHeader>
        <div>
          <SheetTitle>{building.name}</SheetTitle>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {site.shortName}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} /> cap {building.capacity}
            </span>
            <span className="flex items-center gap-1">
              <Ruler size={11} /> {building.floorArea} m²
            </span>
          </div>
        </div>
        <SheetClose onClose={onClose} />
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        {buildingAlerts.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {buildingAlerts.map((a) => (
              <WhyThisFired key={a.id} alert={a} />
            ))}
            <Separator />
          </div>
        )}
        <Tabs defaultValue="overview">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {building.sensors.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {SENSOR_CHART_DEFS[s.kind]?.label ?? s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview">
            <BuildingOverview building={building} history={history} scrubTime={scrubTime} />
          </TabsContent>
          {building.sensors.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              <SensorTab building={building} sensor={s} history={history} scrubTime={scrubTime} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Sheet>
  );
}

function useSeries(buildingId: string, sensorId: string, history: Record<string, { t: number; value: number }[]>, scrubTime: number | null) {
  return useMemo(() => {
    const full = history[`${buildingId}:${sensorId}`] ?? [];
    if (scrubTime === null) return full;
    return full.filter((p) => p.t <= scrubTime);
  }, [history, buildingId, sensorId, scrubTime]);
}

function BuildingOverview({
  building,
  history,
  scrubTime,
}: {
  building: Building;
  history: Record<string, { t: number; value: number }[]>;
  scrubTime: number | null;
}) {
  const occSeries = useSeries(building.id, 'occupancy', history, scrubTime);
  const energySeries = useSeries(building.id, 'energy', history, scrubTime);
  const occ = occSeries[occSeries.length - 1]?.value ?? 0;
  const energy = energySeries[energySeries.length - 1]?.value ?? 0;
  const occForecast = useMemo(
    () => forecastSeries(occSeries.slice(-200), 6, 'Occupancy', 'occupancy', building.id, 'people', ['Timetable-driven model.', 'Assumes normal schedule resumes.']),
    [occSeries, building.id],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-[#000000]/60 p-2">
          <div className="hud-label">Occupancy</div>
          <div className="font-display text-lg tabular-nums text-ok">{Math.round(occ)}</div>
        </div>
        <div className="rounded border border-border bg-[#000000]/60 p-2">
          <div className="hud-label">Energy</div>
          <div className="font-display text-lg tabular-nums text-data">{energy.toFixed(1)} kW</div>
        </div>
        <div className="rounded border border-border bg-[#000000]/60 p-2">
          <div className="hud-label">Height</div>
          <div className="font-display text-lg tabular-nums text-[#fafafa]">{building.height} m</div>
        </div>
      </div>
      <div>
        <div className="hud-label mb-1">Occupancy — 24h + 6h forecast</div>
        <TimeSeriesChart data={occSeries.slice(-120)} showForecast={occForecast} color="#00E5C3" unit="people" height={170} />
      </div>
      <div>
        <div className="hud-label mb-1">Energy — 24h</div>
        <TimeSeriesChart data={energySeries.slice(-120)} color="#3D8BFF" unit="kW" height={140} />
      </div>
    </div>
  );
}

function SensorTab({
  building,
  sensor,
  history,
  scrubTime,
}: {
  building: Building;
  sensor: SensorDef;
  history: Record<string, { t: number; value: number }[]>;
  scrubTime: number | null;
}) {
  const series = useSeries(building.id, sensor.id, history, scrubTime);
  const def = SENSOR_CHART_DEFS[sensor.kind] ?? { label: sensor.label, color: '#3D8BFF' };
  const current = series[series.length - 1]?.value ?? 0;
  const forecast = useMemo(
    () =>
      forecastSeries(
        series.slice(-200),
        6,
        def.label,
        sensor.id,
        building.id,
        sensor.unit,
        ['Holt-Winters additive with 24h seasonality.', 'Prediction interval from residual std (1.28σ).'],
      ),
    [series, def.label, sensor.id, building.id, sensor.unit],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="hud-label">{def.label}</div>
          <div className="font-display text-2xl tabular-nums" style={{ color: def.color }}>
            {sensor.kind === 'energy' ? current.toFixed(1) : Math.round(current)}
            <span className="ml-1 text-xs text-muted-foreground">{sensor.unit}</span>
          </div>
        </div>
        <Badge variant="data">{forecast.model}</Badge>
      </div>
      <TimeSeriesChart
        data={series.slice(-120)}
        showForecast={forecast}
        color={def.color}
        unit={sensor.unit}
        height={200}
        threshold={sensor.kind === 'pm25' ? 60 : undefined}
        thresholdLabel={sensor.kind === 'pm25' ? 'CPCB Satisfactory limit' : undefined}
      />
      <p className="text-[10px] text-muted-foreground">
        Forecast: {forecast.model} · horizon {forecast.horizonHours}h · window {forecast.windowHours}h ·{' '}
        {forecast.assumptions.join(' ')}
      </p>
    </div>
  );
}
