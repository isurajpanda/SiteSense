import { useState } from 'react';
import { Wind, Users, Trash2, Car, MessageSquare, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { useReportStore } from '@/store/useReportStore';
import { getSite } from '@/config/sites';
import type { LayerKey } from '@/types/domain';
import { cn } from '@/lib/utils';

const LAYERS: Array<{ key: LayerKey; label: string; icon: typeof Wind }> = [
  { key: 'air', label: 'Air Quality', icon: Wind },
  { key: 'occupancy', label: 'Occupancy', icon: Users },
  { key: 'waste', label: 'Waste bins', icon: Trash2 },
  { key: 'traffic', label: 'Traffic & Parking', icon: Car },
  { key: 'reports', label: 'Citizen Reports', icon: MessageSquare },
  { key: 'energy', label: 'Energy', icon: Zap },
];

export default function LayerRail() {
  const layers = useSettingsStore((s) => s.layers);
  const setLayer = useSettingsStore((s) => s.setLayer);
  const siteId = useSettingsStore((s) => s.siteId);
  const kpis = useSimStore((s) => s.kpis);
  const reports = useReportStore((s) => s.reports);
  const site = getSite(siteId);
  const [collapsed, setCollapsed] = useState(false);

  const counts: Record<LayerKey, number> = {
    air: site.buildings.filter((b) => b.sensors.some((s) => s.kind === 'pm25')).length,
    occupancy: kpis.totalPeople,
    waste: kpis.binsAbove80,
    traffic: Math.round(kpis.congestion * 100),
    reports: reports.filter((r) => r.status !== 'resolved').length,
    energy: Math.round(kpis.energyKw),
  };

  return (
    <nav aria-label="Map layers" className="pointer-events-auto w-44">
      <div className="hud-panel hud-corner">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-3 py-2"
        >
          <span className="hud-label">Layers</span>
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </button>
        {!collapsed && (
          <div className="flex flex-col gap-1 px-2 pb-2">
            {LAYERS.map(({ key, label, icon: Icon }) => {
              const active = layers[key];
              return (
                <button
                  key={key}
                  onClick={() => setLayer(key, !active)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#8a8a8a] hover:bg-[#141414] hover:text-[#fafafa]',
                  )}
                >
                  <Icon size={14} />
                  <span className="flex-1 font-hud text-[11px] font-semibold uppercase tracking-wider">{label}</span>
                  <span className="rounded bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#8a8a8a]">
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
