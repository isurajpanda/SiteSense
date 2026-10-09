import { useEffect, useState } from 'react';
import { Play, Pause, Sun, Moon, Radar, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { SITES } from '@/config/sites';
import { formatSimTime } from '@/lib/sim/clock';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import type { Role } from '@/types/domain';

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Administrator' },
  { value: 'operations', label: 'Operations' },
  { value: 'sustainability', label: 'Sustainability' },
  { value: 'reporter', label: 'Reporter' },
];

export default function TopBar() {
  const { siteId, setSiteId, role, setRole, dayNight, setDayNight, speed, setSpeed, running, setRunning } =
    useSettingsStore();
  const simTime = useSimStore((s) => s.simTime);
  const initialized = useSimStore((s) => s.initialized);
  const [clock, setClock] = useState(simTime);

  useEffect(() => {
    const id = setInterval(() => setClock(useSimStore.getState().simTime), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="pointer-events-auto flex h-14 items-center gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-[#333] bg-[#111]">
          <Radar size={16} className="text-[#fafafa]" />
        </div>
        <div>
          <div className="font-display text-sm font-bold tracking-widest text-[#fafafa]">SITESENSE</div>
          <div className="font-hud text-[9px] uppercase tracking-[0.2em] text-[#8a8a8a]">Estate Intelligence</div>
        </div>
      </div>

      <div className="mx-2 h-6 w-px bg-[#1a1a1a]" />

      <Select
        ariaLabel="Site"
        value={siteId}
        onValueChange={setSiteId}
        options={SITES.map((s) => ({ value: s.id, label: s.shortName }))}
        className="h-8 w-40 text-xs"
      />

      <DropdownMenu
        trigger={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Avatar className="h-5 w-5 text-[10px]">
              {role[0]?.toUpperCase()}
            </Avatar>
            {ROLES.find((r) => r.value === role)?.label}
          </Button>
        }
      >
        {ROLES.map((r) => (
          <DropdownMenuItem key={r.value} onSelect={() => setRole(r.value)}>
            {r.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="warning" className="gap-1">
          <span className={`h-1.5 w-1.5 rounded-full bg-warn ${running ? 'animate-blink' : ''}`} />
          Simulated data
        </Badge>
        <Badge variant="data" className="hidden sm:inline-flex">
          Demo layout: illustrative positions
        </Badge>

        <div className="mx-1 h-6 w-px bg-[#1a1a1a]" />

        <div className="flex items-center gap-1 rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-ok animate-blink' : 'bg-[#8a8a8a]'}`} />
          <span className="font-mono text-xs tabular-nums text-[#fafafa]">
            {initialized ? formatSimTime(clock) : '—'}
          </span>
        </div>

        <div className="flex items-center overflow-hidden rounded-md border border-[#1a1a1a]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none"
            aria-label={running ? 'Pause simulation' : 'Resume simulation'}
            onClick={() => setRunning(!running)}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          {([1, 5, 20] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-8 px-2 font-hud text-[10px] font-bold transition-colors ${
                speed === s ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#8a8a8a] hover:text-[#fafafa]'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Toggle day/night"
          onClick={() => setDayNight(dayNight === 'night' ? 'day' : 'night')}
        >
          {dayNight === 'night' ? <Sun size={14} /> : <Moon size={14} />}
        </Button>

        <div className="hidden items-center gap-1 text-[#8a8a8a] lg:flex" title="Decision-support insights, not official measurements">
          <ShieldCheck size={13} />
          <span className="font-hud text-[9px] uppercase tracking-wider">Decision support</span>
        </div>
      </div>
    </header>
  );
}
