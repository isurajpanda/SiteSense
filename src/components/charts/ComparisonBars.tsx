import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ComparisonBarsProps {
  baseline: Record<string, number>;
  projected: Record<string, number>;
  labels: Record<string, string>;
  unit?: string;
}

export default function ComparisonBars({ baseline, projected, labels, unit }: ComparisonBarsProps) {
  const data = Object.keys(labels).map((key) => ({
    key,
    label: labels[key],
    baseline: baseline[key] ?? 0,
    projected: projected[key] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748B', fontSize: 11 }}
          axisLine={{ stroke: '#1E293B' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748B', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: '#1E293B', fillOpacity: 0.4 }}
          contentStyle={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#94A3B8' }}
          formatter={(value) => `${value}${unit ?? ''}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="baseline"
          name="Baseline"
          fill="#3D8BFF"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="projected"
          name="Projected"
          fill="#00E5C3"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
