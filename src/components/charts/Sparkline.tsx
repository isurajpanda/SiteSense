import type { SeriesPoint } from '@/types/domain';

interface SparklineProps {
  data: SeriesPoint[];
  color?: string;
  width?: number;
  height?: number;
}

export default function Sparkline({
  data,
  color = '#3D8BFF',
  width = 120,
  height = 32,
}: SparklineProps) {
  if (data.length === 0) {
    return <svg width={width} height={height} />;
  }

  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const pad = 2;

  const points = data
    .map((p, i) => {
      const x =
        data.length === 1
          ? width / 2
          : pad + (i / (data.length - 1)) * (width - pad * 2);
      const y =
        range === 0
          ? height / 2
          : height - pad - ((p.value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="block" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
