import { useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types/domain';

const SEV_ICON = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  ok: Info,
};

const SEV_STYLE: Record<Severity, string> = {
  critical: 'border-crit/50 text-crit',
  warning: 'border-warn/50 text-warn',
  ok: 'border-ok/50 text-ok',
};

export default function AlertFeed({ onAlertClick }: { onAlertClick: (buildingId: string) => void }) {
  const alerts = useSimStore((s) => s.alerts);
  const [collapsed, setCollapsed] = useState(false);

  const displayAlerts = alerts.slice(0, 5);

  return (
    <div className="pointer-events-auto w-72">
      <div className="hud-panel hud-corner">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-3 py-2"
        >
          <span className="flex items-center gap-2">
            <span className="hud-label">Alerts</span>
            <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'destructive' : 'ok'}>
              {alerts.length}
            </Badge>
          </span>
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </button>
        {!collapsed && (
          <ScrollArea className="max-h-[35vh] px-2 pb-2">
            {displayAlerts.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-[#8a8a8a]">
                All systems nominal
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {displayAlerts.map((a) => {
                const Icon = SEV_ICON[a.severity];
                return (
                  <button
                    key={a.id}
                    onClick={() => onAlertClick(a.buildingId)}
                    className={cn(
                      'animate-fade-in rounded border bg-[#0a0a0a]/60 p-2 text-left transition-colors hover:bg-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      SEV_STYLE[a.severity],
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={12} />
                      <span className="flex-1 truncate font-hud text-[11px] font-bold uppercase tracking-wider text-[#fafafa]">
                        {a.buildingName}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#8a8a8a]">{a.message}</p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
