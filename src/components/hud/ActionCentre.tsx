import { useState } from 'react';
import { Check, X, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Recommendation } from '@/types/domain';

const SEV_BADGE = { critical: 'destructive', warning: 'warning', ok: 'ok' } as const;

export default function ActionCentre({ onFocusBuilding }: { onFocusBuilding: (id: string) => void }) {
  const recommendations = useSimStore((s) => s.recommendations);
  const acceptReco = useSimStore((s) => s.acceptReco);
  const dismissReco = useSimStore((s) => s.dismissReco);
  const snoozeReco = useSimStore((s) => s.snoozeReco);
  const siteId = useSettingsStore((s) => s.siteId);
  const site = getSite(siteId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const open = recommendations.filter((r) => r.status === 'open').slice(0, 3);

  return (
    <div className="pointer-events-auto w-80">
      <div className="hud-panel hud-corner">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-3 py-2"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-data" />
            <span className="hud-label">Actions</span>
          </span>
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </button>
        {!collapsed && (
          <ScrollArea className="max-h-[35vh] px-2 pb-2">
            {open.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-[#8a8a8a]">
                No pending actions
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {open.map((r) => (
                <RecoCard
                  key={r.id}
                  reco={r}
                  buildingName={site.buildings.find((b) => b.id === r.buildingIds[0])?.shortName ?? ''}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onAccept={() => acceptReco(r.id)}
                  onDismiss={() => dismissReco(r.id)}
                  onSnooze={() => snoozeReco(r.id)}
                  onFocus={() => r.buildingIds[0] && onFocusBuilding(r.buildingIds[0])}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function RecoCard({
  reco,
  buildingName,
  expanded,
  onToggle,
  onAccept,
  onDismiss,
  onSnooze,
  onFocus,
}: {
  reco: Recommendation;
  buildingName: string;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onFocus: () => void;
}) {
  return (
    <div
      className={cn(
        'animate-fade-in rounded border bg-[#0a0a0a]/60 p-2',
        reco.severity === 'critical' ? 'border-crit/40' : 'border-warn/30',
      )}
    >
      <div className="flex items-start gap-1.5">
        <Badge variant={SEV_BADGE[reco.severity]} className="mt-0.5 shrink-0">
          {reco.severity}
        </Badge>
        <div className="min-w-0 flex-1">
          <button className="text-left font-hud text-[11px] font-bold uppercase tracking-wider text-[#fafafa] hover:text-primary" onClick={onToggle}>
            {reco.title}
          </button>
          <p className="mt-0.5 text-[11px] leading-snug text-[#8a8a8a]">{reco.plainLanguage}</p>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-[#1a1a1a] pt-2">
          <div className="text-[11px] text-[#8a8a8a]">
            <span className="font-semibold text-[#fafafa]">Action: </span>
            {reco.action}
          </div>
          <div className="text-[11px] text-[#8a8a8a]">
            <span className="font-semibold text-[#fafafa]">Impact: </span>
            {reco.expectedImpact}
          </div>
          <div>
            <div className="hud-label mb-0.5">Rationale</div>
            <ul className="list-inside list-disc space-y-0.5 text-[10px] text-[#8a8a8a]">
              {reco.rationale.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-1">
        <Button size="sm" variant="default" className="h-6 flex-1 gap-1 text-[10px]" onClick={onAccept}>
          <Check size={11} /> Accept
        </Button>
        <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={onSnooze}>
          <Clock size={11} /> Snooze
        </Button>
        <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px]" onClick={onDismiss}>
          <X size={11} /> Dismiss
        </Button>
        {buildingName && (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onFocus} title={`Focus ${buildingName}`}>
            Map
          </Button>
        )}
      </div>
    </div>
  );
}
