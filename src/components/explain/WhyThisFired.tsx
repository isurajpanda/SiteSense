import { AlertTriangle, Info } from 'lucide-react';
import type { Alert } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Sparkline from '@/components/charts/Sparkline';

export default function WhyThisFired({ alert }: { alert: Alert }) {
  return (
    <div className="rounded-md border border-border bg-[#000000]/60 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-warn" />
        <span className="font-hud text-xs font-bold uppercase tracking-wider text-[#fafafa]">
          Why this fired
        </span>
        <Badge variant="outline" className="ml-auto font-mono text-[9px]">
          {alert.method}
        </Badge>
      </div>
      <Separator className="my-2" />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="hud-label">Observed</div>
          <div className="font-mono text-sm tabular-nums text-crit">
            {alert.observed} {alert.unit}
          </div>
        </div>
        <div>
          <div className="hud-label">Expected</div>
          <div className="font-mono text-sm tabular-nums text-ok">
            {alert.expected} {alert.unit}
          </div>
        </div>
        <div>
          <div className="hud-label">Threshold</div>
          <div className="font-mono text-sm tabular-nums text-warn">
            {alert.threshold} {alert.unit}
          </div>
        </div>
        <div>
          <div className="hud-label">Confidence</div>
          <div className="font-mono text-sm tabular-nums text-data">{Math.round(alert.confidence * 100)}%</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="hud-label">Window</div>
        <div className="text-xs text-muted-foreground">{alert.window}</div>
      </div>
      <div className="mt-2">
        <div className="hud-label mb-1">Assumptions</div>
        <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
          {alert.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WhyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-[#000000]/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Info size={13} className="text-data" />
        <span className="font-hud text-xs font-bold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function MiniTrend({ data, color = '#3D8BFF' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  return (
    <Sparkline
      data={data.map((v, i) => ({ t: i, value: v }))}
      color={color}
      width={220}
      height={40}
    />
  );
}
