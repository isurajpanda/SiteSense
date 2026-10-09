import { format } from 'date-fns';

export interface ChartTooltipDatum {
  t: number;
  value?: number;
  forecastValue?: number;
  lower?: number;
  upper?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartTooltipDatum }>;
  unit?: string;
}

export default function ChartTooltip({ active, payload, unit }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point) return null;
  const value = point.value ?? point.forecastValue;
  if (value === undefined) return null;
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
      <div className="text-slate-400">{format(point.t, 'HH:mm')}</div>
      <div className="font-medium text-slate-100">
        {value.toFixed(1)}
        {unit ? <span className="ml-1 font-normal text-slate-400">{unit}</span> : null}
      </div>
      {point.lower !== undefined && point.upper !== undefined ? (
        <div className="text-slate-500">
          {point.lower.toFixed(1)} – {point.upper.toFixed(1)}
        </div>
      ) : null}
    </div>
  );
}
