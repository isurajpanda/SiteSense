import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radar, Users, Wind, Trash2, Car, Zap, ChevronDown, ChevronUp, Bell, ClipboardList, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { SITES } from '@/config/sites';
import { formatSimTime } from '@/lib/sim/clock';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ComplaintsBoard from '@/components/hud/ComplaintsBoard';
import type { Role, Severity } from '@/types/domain';

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-crit',
  warning: 'bg-warn',
  ok: 'bg-ok',
};

const SEV_ICON = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  ok: Info,
};

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Administrator' },
  { value: 'operations', label: 'Operations' },
  { value: 'sustainability', label: 'Sustainability' },
  { value: 'reporter', label: 'Reporter' },
];

function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 500;
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

export default function TopBar({ onFocusBuilding }: { onFocusBuilding?: (buildingId: string) => void }) {
  const { siteId, setSiteId, role, setRole } = useSettingsStore();
  const kpis = useSimStore((s) => s.kpis);
  const alerts = useSimStore((s) => s.alerts);
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => Date.now());
  const unread = alerts.filter((a) => a.t > lastSeen).length;
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [notifOpen]);

  const closeNotifs = () => {
    setNotifOpen(false);
    setLastSeen(Date.now());
  };

  const kpiItems = [
    { icon: Users, label: 'People', value: kpis.totalPeople, color: 'text-data' },
    { icon: Wind, label: 'AQI', value: kpis.campusAqi, color: kpis.campusAqi > 120 ? 'text-crit' : kpis.campusAqi > 60 ? 'text-warn' : 'text-ok' },
    { icon: Trash2, label: 'Bins >80%', value: kpis.binsAbove80, color: kpis.binsAbove80 > 2 ? 'text-crit' : kpis.binsAbove80 > 0 ? 'text-warn' : 'text-ok' },
    { icon: Car, label: 'Parking', value: kpis.parkingOccupancyPct, suffix: '%', color: kpis.parkingOccupancyPct > 95 ? 'text-crit' : kpis.parkingOccupancyPct > 80 ? 'text-warn' : 'text-ok' },
    { icon: Zap, label: 'Energy', value: kpis.energyKw, suffix: ' kW', color: 'text-data' },
  ];

  return (
    <header className="pointer-events-auto relative z-40 flex h-14 items-center gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/90 px-4 backdrop-blur-md">
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
        className="h-8 w-36 text-xs"
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

      <div className="mx-2 h-6 w-px bg-[#1a1a1a]" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => setKpiCollapsed(!kpiCollapsed)}
          className="flex h-7 items-center gap-1 rounded px-2 font-hud text-[10px] font-bold uppercase tracking-wider text-[#8a8a8a] hover:text-[#fafafa]"
        >
          KPIs
          {kpiCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
        {!kpiCollapsed && (
          <div className="flex items-center gap-1">
            {kpiItems.map(({ icon: Icon, label, value, suffix, color }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1"
                title={label}
              >
                <Icon size={13} className={color} />
                <span className="font-display text-xs font-bold tabular-nums text-[#fafafa]">
                  <CountUp value={value} className={color} />
                  {suffix && <span className="text-[10px] font-normal text-[#8a8a8a]">{suffix}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded border border-[#1a1a1a] bg-[#0a0a0a] px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          <span className="font-hud text-[10px] font-semibold uppercase tracking-wider text-ok">Live</span>
        </div>

        <div className="relative" ref={dropRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={notifOpen ? 'Close notifications' : 'Open notifications'}
            onClick={() => (notifOpen ? closeNotifs() : setNotifOpen(true))}
          >
            <Bell size={14} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-crit px-1 font-mono text-[9px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
          {notifOpen && (
              <div className="hud-panel hud-corner absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="hud-label">Notifications</span>
                  <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'destructive' : 'ok'}>
                    {alerts.length}
                  </Badge>
                  <button
                    onClick={() => setLastSeen(Date.now())}
                    className="ml-auto font-hud text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a] hover:text-[#fafafa]"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto px-2 pb-2">
                  {alerts.length === 0 && (
                    <div className="px-2 py-6 text-center text-xs text-[#8a8a8a]">
                      All clear — no new alerts.
                    </div>
                  )}
                  {alerts.slice(0, 8).map((a) => {
                    const Icon = SEV_ICON[a.severity];
                    const fresh = a.t > lastSeen;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          onFocusBuilding?.(a.buildingId);
                          closeNotifs();
                        }}
                        className={cn(
                          'flex w-full items-start gap-2 rounded border bg-[#0a0a0a]/60 p-2 text-left transition-colors hover:bg-[#141414]',
                          a.severity === 'critical' ? 'border-crit/50' : a.severity === 'warning' ? 'border-warn/50' : 'border-ok/50',
                        )}
                      >
                        <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', SEV_DOT[a.severity])} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <Icon size={11} className={cn(a.severity === 'critical' ? 'text-crit' : a.severity === 'warning' ? 'text-warn' : 'text-ok')} />
                            <span className="truncate font-hud text-[11px] font-bold uppercase tracking-wider text-[#fafafa]">
                              {a.buildingName}
                            </span>
                            {fresh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-data" />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#8a8a8a]">{a.message}</span>
                          <span className="mt-0.5 block font-mono text-[9px] text-[#8a8a8a]">{formatSimTime(a.t)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    closeNotifs();
                    setBoardOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-[#1a1a1a] px-3 py-2 font-hud text-[10px] font-bold uppercase tracking-wider text-data hover:bg-[#141414]"
                >
                  <ClipboardList size={12} />
                  Open complaints board
                </button>
              </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Open complaints board"
          title="Complaints board"
          onClick={() => setBoardOpen(true)}
        >
          <ClipboardList size={14} />
        </Button>
      </div>

      {boardOpen &&
        createPortal(
          <ComplaintsBoard open={boardOpen} onClose={() => setBoardOpen(false)} onFocusBuilding={onFocusBuilding} />,
          document.body,
        )}
    </header>
  );
}
