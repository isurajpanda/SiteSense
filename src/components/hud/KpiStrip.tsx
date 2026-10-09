import { useEffect, useRef, useState } from 'react';
import { Users, Wind, Trash2, MessageSquare, Car, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { cn } from '@/lib/utils';

function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 600;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={cn('tnum', className)}>{display.toLocaleString()}</span>;
}

export default function KpiStrip() {
  const kpis = useSimStore((s) => s.kpis);
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { icon: Users, label: 'People on site', value: kpis.totalPeople, color: 'text-data' },
    { icon: Wind, label: 'Campus AQI', value: kpis.campusAqi, color: kpis.campusAqi > 120 ? 'text-crit' : kpis.campusAqi > 60 ? 'text-warn' : 'text-ok' },
    { icon: Trash2, label: 'Bins above 80%', value: kpis.binsAbove80, color: kpis.binsAbove80 > 2 ? 'text-crit' : kpis.binsAbove80 > 0 ? 'text-warn' : 'text-ok' },
    { icon: MessageSquare, label: 'Open reports', value: kpis.openReports, color: kpis.openReports > 3 ? 'text-warn' : 'text-ok' },
    { icon: Car, label: 'Parking occupancy', value: kpis.parkingOccupancyPct, suffix: '%', color: kpis.parkingOccupancyPct > 95 ? 'text-crit' : kpis.parkingOccupancyPct > 80 ? 'text-warn' : 'text-ok' },
    { icon: Zap, label: 'Energy right now', value: kpis.energyKw, suffix: ' kW', color: 'text-data' },
  ];

  return (
    <div className="pointer-events-auto">
      <div className="hud-panel hud-corner">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-3 py-2"
        >
          <span className="hud-label">KPIs</span>
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </button>
        {!collapsed && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {items.map(({ icon: Icon, label, value, suffix, color }) => (
              <div key={label} className="flex shrink-0 items-center gap-2.5 rounded border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2" title={label}>
                <Icon size={16} className={color} />
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-[#8a8a8a]">{label}</div>
                  <div className="font-display text-base leading-tight tabular-nums text-[#fafafa]">
                    <CountUp value={value} className={color} />
                    {suffix && <span className="text-xs text-[#8a8a8a]">{suffix}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
