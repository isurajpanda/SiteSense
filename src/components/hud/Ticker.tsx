import { useState } from 'react';
import { useSimStore } from '@/store/useSimStore';
import { formatSimTime } from '@/lib/sim/clock';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types/domain';
import { ChevronDown, ChevronUp } from 'lucide-react';

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-crit',
  warning: 'bg-warn',
  ok: 'bg-ok',
};

export default function Ticker() {
  const ticker = useSimStore((s) => s.ticker);
  const items = ticker.length > 0 ? [...ticker, ...ticker] : [];
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="pointer-events-auto hud-panel">
        <button
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5"
        >
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-ok" />
          <span className="hud-label">Live</span>
          <ChevronUp size={12} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto hud-panel flex h-8 items-center overflow-hidden" aria-label="Event ticker">
      <button
        onClick={() => setCollapsed(true)}
        className="z-10 flex h-full shrink-0 items-center gap-1.5 border-r border-[#1a1a1a] bg-[#0a0a0a] px-3"
      >
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-ok" />
        <span className="font-hud text-[10px] font-bold uppercase tracking-[0.2em] text-ok">Live</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>
      <div className="relative flex-1 overflow-hidden">
        {ticker.length === 0 ? (
          <div className="flex h-full items-center px-3 text-[11px] text-[#8a8a8a]">
            Monitoring all systems — events will appear here as they occur.
          </div>
        ) : (
          <div className="flex h-full w-max animate-ticker items-center gap-8 whitespace-nowrap px-4">
            {items.map((e, i) => (
              <span key={`${e.id}-${i}`} className="flex items-center gap-2 text-[11px] text-[#8a8a8a]">
                <span className={cn('h-1.5 w-1.5 rounded-full', SEV_DOT[e.severity])} />
                <span className="font-mono text-[10px] text-[#8a8a8a]">{formatSimTime(e.t)}</span>
                <span>{e.message}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
