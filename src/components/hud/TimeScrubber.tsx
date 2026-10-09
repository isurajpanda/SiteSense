import { useEffect, useState } from 'react';
import { History, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { TOTAL_POINTS, SIM_MINUTES_PER_TICK } from '@/lib/sim/clock';
import { Button } from '@/components/ui/button';

const MIN = 60 * 1000;

export default function TimeScrubber() {
  const simTime = useSimStore((s) => s.simTime);
  const scrubTime = useSimStore((s) => s.scrubTime);
  const setScrubTime = useSimStore((s) => s.setScrubTime);
  const running = useSettingsStore((s) => s.running);
  const setRunning = useSettingsStore((s) => s.setRunning);
  const [scrubbing, setScrubbing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const historyStart = simTime - TOTAL_POINTS * SIM_MINUTES_PER_TICK * MIN;
  const value = scrubTime ?? simTime;
  const pct = ((value - historyStart) / (simTime - historyStart)) * 100;

  useEffect(() => {
    if (scrubbing && running) setRunning(false);
  }, [scrubbing, running, setRunning]);

  if (collapsed) {
    return (
      <div className="pointer-events-auto hud-panel">
        <button
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5"
        >
          <History size={12} className="text-muted-foreground" />
          <span className="hud-label">Replay</span>
          <ChevronUp size={12} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto hud-panel flex items-center gap-3 px-3 py-2">
      <Button
        variant={scrubbing ? 'default' : 'outline'}
        size="sm"
        className="h-7 gap-1.5 text-[11px]"
        onClick={() => {
          if (scrubbing) {
            setScrubTime(null);
            setScrubbing(false);
            setRunning(true);
          } else {
            setScrubbing(true);
            setScrubTime(simTime);
          }
        }}
      >
        <History size={12} />
        {scrubbing ? 'Back to live' : 'Replay 24h'}
      </Button>
      {scrubbing && (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="range"
            aria-label="Scrub simulation time"
            min={historyStart}
            max={simTime}
            step={SIM_MINUTES_PER_TICK * MIN}
            value={value}
            onChange={(e) => setScrubTime(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1a1a1a] accent-[#fafafa]"
          />
          <span className="font-mono text-[11px] tabular-nums text-[#fafafa]">
            {new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            aria-label="Exit replay"
            onClick={() => {
              setScrubTime(null);
              setScrubbing(false);
              setRunning(true);
            }}
            className="rounded p-1 text-[#8a8a8a] hover:text-[#fafafa]"
          >
            <X size={13} />
          </button>
        </div>
      )}
      {!scrubbing && (
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
            <div className="h-full rounded-full bg-data/60" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[10px] text-[#8a8a8a]">7-day history loaded</span>
        </div>
      )}
      <button
        onClick={() => setCollapsed(true)}
        className="rounded p-1 text-[#8a8a8a] hover:text-[#fafafa]"
        aria-label="Collapse time scrubber"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
