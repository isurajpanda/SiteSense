import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import type { Forecast, SeriesPoint } from '@/types/domain';
import ChartTooltip from './chart-tooltip';

interface ForecastChartProps {
  history: SeriesPoint[];
  forecast: Forecast;
  height?: number;
}

type CombinedPoint = {
  t: number;
  value?: number;
  forecastValue?: number;
  lower?: number;
  upper?: number;
};

export default function ForecastChart({ history, forecast, height = 200 }: ForecastChartProps) {
  const chartData = useMemo<CombinedPoint[]>(() => {
    const hist = history.map((p) => ({ t: p.t, value: p.value }));
    const fc = forecast.points.map((p) => ({
      t: p.t,
      forecastValue: p.value,
      lower: p.lower,
      upper: p.upper,
    }));
    return [...hist, ...fc];
  }, [history, forecast]);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => format(v, 'HH:mm')}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={{ stroke: '#1E293B' }}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip unit={forecast.unit} />}
            cursor={{ stroke: '#334155' }}
          />
          <Area
            dataKey="upper"
            stackId="band"
            fill="#3D8BFF"
            fillOpacity={0.15}
            stroke="none"
            isAnimationActive={false}
          />
          <Area
            dataKey="lower"
            stackId="band"
            fill="transparent"
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            dataKey="value"
            stroke="#3D8BFF"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="forecastValue"
            stroke="#3D8BFF"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[11px] text-slate-500">
        {forecast.model} · {forecast.horizonHours}h horizon
      </p>
    </div>
  );
}
