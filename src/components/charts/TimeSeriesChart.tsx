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
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import type { Forecast, SeriesPoint } from '@/types/domain';
import ChartTooltip from './chart-tooltip';

interface TimeSeriesChartProps {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  unit?: string;
  showForecast?: Forecast | null;
  threshold?: number;
  thresholdLabel?: string;
  compact?: boolean;
}

const MAX_POINTS = 200;

type CombinedPoint = {
  t: number;
  value?: number;
  forecastValue?: number;
  lower?: number;
  upper?: number;
};

function downsample(data: SeriesPoint[]): SeriesPoint[] {
  if (data.length <= MAX_POINTS) return data;
  const step = Math.ceil(data.length / MAX_POINTS);
  return data.filter((_, i) => i % step === 0);
}

export default function TimeSeriesChart({
  data,
  height = 180,
  color = '#3D8BFF',
  unit,
  showForecast,
  threshold,
  thresholdLabel,
  compact = false,
}: TimeSeriesChartProps) {
  const chartData = useMemo<CombinedPoint[]>(() => {
    const history = downsample(data).map((p) => ({ t: p.t, value: p.value }));
    if (!showForecast) return history;
    const forecast = showForecast.points.map((p) => ({
      t: p.t,
      forecastValue: p.value,
      lower: p.lower,
      upper: p.upper,
    }));
    return [...history, ...forecast];
  }, [data, showForecast]);

  if (data.length === 0) {
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
          width={compact ? 36 : 44}
        />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: '#334155' }} />
        {showForecast ? (
          <>
            <Area
              dataKey="upper"
              stackId="band"
              fill={color}
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
          </>
        ) : null}
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {showForecast ? (
          <Line
            dataKey="forecastValue"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
        ) : null}
        {threshold !== undefined ? (
          <ReferenceLine
            y={threshold}
            stroke="#FF4D6A"
            strokeDasharray="4 4"
            label={
              thresholdLabel
                ? {
                    value: thresholdLabel,
                    position: 'insideTopRight',
                    fill: '#FF4D6A',
                    fontSize: 11,
                  }
                : undefined
            }
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
