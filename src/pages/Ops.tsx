import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  History,
  Inbox,
  MapPin,
  Play,
  Plus,
  Route,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import { useSimStore } from '@/store/useSimStore';
import { useReportStore } from '@/store/useReportStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getSite } from '@/config/sites';
import { formatSimTime } from '@/lib/sim/clock';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReportStatus, TaskStatus } from '@/types/domain';

const REPORT_STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const REPORT_STATUS_VARIANT: Record<ReportStatus, 'warning' | 'data' | 'ok'> = {
  received: 'warning',
  assigned: 'data',
  'in-progress': 'data',
  resolved: 'ok',
};

const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'in-progress', label: 'In progress' },
  { status: 'resolved', label: 'Resolved' },
];

const SOURCE_VARIANT: Record<string, 'default' | 'data' | 'outline'> = {
  recommendation: 'default',
  report: 'data',
  manual: 'outline',
};

const BIN_FILL_THRESHOLD = 70;
const MINUTES_PER_STOP = 8;

function ageLabel(t: number): string {
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function durationLabel(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

export default function OpsPage() {
  const siteId = useSettingsStore((s) => s.siteId);
  const role = useSettingsStore((s) => s.role);
  const site = getSite(siteId);

  const tasks = useSimStore((s) => s.tasks);
  const addTask = useSimStore((s) => s.addTask);
  const updateTaskStatus = useSimStore((s) => s.updateTaskStatus);
  const audit = useSimStore((s) => s.audit);
  const alerts = useSimStore((s) => s.alerts);
  const recommendations = useSimStore((s) => s.recommendations);
  const binStates = useSimStore((s) => s.binStates);
  const congestion = useSimStore((s) => s.congestion);
  const kpis = useSimStore((s) => s.kpis);

  const reports = useReportStore((s) => s.reports);
  const updateReportStatus = useReportStore((s) => s.updateStatus);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [routeOptimized, setRouteOptimized] = useState(false);

  const routeBins = useMemo(
    () =>
      site.bins
        .map((b) => ({ ...b, fill: binStates[b.id] ?? 0 }))
        .filter((b) => b.fill > BIN_FILL_THRESHOLD)
        .sort((a, b) => b.fill - a.fill),
    [site, binStates],
  );
  const routeMinutes = routeBins.length * MINUTES_PER_STOP;

  const openAlerts = alerts.filter((a) => !a.acknowledged).length;
  const openRecs = recommendations.filter((r) => r.status === 'open').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const receivedReports = reports.filter((r) => r.status === 'received').length;
  const avgCongestion = Object.values(congestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(congestion).length);
  const congestionPct = Math.round(avgCongestion * 100);
  const congestionTone =
    avgCongestion > site.thresholds.congestionCritical
      ? 'bg-crit'
      : avgCongestion > site.thresholds.congestionWarning
        ? 'bg-warn'
        : 'bg-ok';

  const submitManualTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    addTask({
      title,
      description: newTaskDesc.trim() || 'Manually created task.',
      buildingId: '',
      buildingName: 'General',
      status: 'new',
      source: 'manual',
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  return (
    <div className="min-h-full bg-[#000000] p-4 text-foreground">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-hud text-xl font-bold uppercase tracking-[0.2em] text-[#fafafa]">
            Operations Control
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {site.name} · task board, waste routing, citizen reports and shift status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="data" className="gap-1.5">
            <Activity size={11} />
            {role}
          </Badge>
          <Link to="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            <Button variant="outline" size="sm" className="gap-1.5">
              <MapPin size={12} />
              Back to HUD
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <section className="hud-panel hud-corner p-3 xl:col-span-3" aria-label="Task board">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={13} className="text-[#8a8a8a]" />
              <span className="hud-label">Task Board</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {tasks.filter((t) => t.status !== 'resolved').length} open · {tasks.length} total
            </span>
          </div>

          <div className="mb-3 flex flex-col gap-1.5 sm:flex-row">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManualTask()}
              placeholder="New manual task title…"
              aria-label="Manual task title"
              className="h-8 flex-1 text-xs"
            />
            <Input
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManualTask()}
              placeholder="Description (optional)…"
              aria-label="Manual task description"
              className="h-8 flex-1 text-xs"
            />
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={submitManualTask}
              disabled={!newTaskTitle.trim()}
            >
              <Plus size={12} />
              Add task
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.status);
              return (
                <div key={col.status} className="flex flex-col rounded-md border border-border/60 bg-[#0a0a0a]/50 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="hud-label">{col.label}</span>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {colTasks.length === 0 && (
                      <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                        No {col.label.toLowerCase()} tasks
                      </div>
                    )}
                    {colTasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-border bg-[#0a0a0a]/80 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold leading-snug text-foreground">{task.title}</span>
                          <Badge variant={SOURCE_VARIANT[task.source]} className="shrink-0">
                            {task.source}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin size={10} />
                          {task.buildingName}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{task.description}</p>
                        <div className="mt-2 flex gap-1.5">
                          {task.status === 'new' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => updateTaskStatus(task.id, 'in-progress')}
                            >
                              <Play size={11} />
                              Start
                            </Button>
                          )}
                          {task.status === 'in-progress' && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => updateTaskStatus(task.id, 'resolved')}
                            >
                              <CheckCircle2 size={11} />
                              Resolve
                            </Button>
                          )}
                          {task.status === 'resolved' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-ok">
                              <CheckCircle2 size={11} />
                              Done
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="hud-panel hud-corner p-3 xl:col-span-2" aria-label="Citizen reports queue">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox size={13} className="text-[#8a8a8a]" />
              <span className="hud-label">Citizen Reports</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{reports.length} reports</span>
          </div>
          <ScrollArea className="max-h-[340px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Tracking</TableHead>
                  <TableHead className="w-20">Category</TableHead>
                  <TableHead className="w-24">Building</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && (
                  <TableRow>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No citizen reports yet.
                    </td>
                  </TableRow>
                )}
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[11px] text-foreground">{r.trackingId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.category}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.buildingName}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate text-xs text-foreground" title={r.note}>
                        {r.note}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={REPORT_STATUS_VARIANT[r.status]}>{r.status}</Badge>
                        <Select
                          value={r.status}
                          onValueChange={(v) => updateReportStatus(r.id, v as ReportStatus)}
                          options={REPORT_STATUS_OPTIONS}
                          ariaLabel={`Update status for report ${r.trackingId}`}
                          className="h-7 w-24 px-2 text-[11px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-muted-foreground">{ageLabel(r.t)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </section>

        <section className="hud-panel hud-corner flex flex-col p-3" aria-label="Audit timeline">
          <div className="mb-2 flex items-center gap-2">
            <History size={13} className="text-[#8a8a8a]" />
            <span className="hud-label">Audit Timeline</span>
          </div>
          <ScrollArea className="max-h-[340px]">
            <ol className="flex flex-col gap-2.5 pr-1">
              {audit.length === 0 && (
                <li className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                  No audit entries yet.
                </li>
              )}
              {audit.map((entry) => (
                <li key={entry.id} className="border-l-2 border-primary/40 pl-2.5">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {formatSimTime(entry.t)} · {entry.actor}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-foreground">{entry.action}</div>
                  <div className="mt-0.5 font-mono text-[11px] leading-snug text-muted-foreground">{entry.detail}</div>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </section>

        <section className="hud-panel hud-corner p-3" aria-label="Waste route planner">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={13} className="text-[#8a8a8a]" />
              <span className="hud-label">Waste Route</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {routeBins.length} bin{routeBins.length === 1 ? '' : 's'} above {BIN_FILL_THRESHOLD}%
            </span>
          </div>

          {routeBins.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
              No bins above {BIN_FILL_THRESHOLD}% fill — all clear.
            </div>
          ) : (
            <>
              <ol className="flex flex-col gap-1.5">
                {routeBins.map((bin, i) => (
                  <li
                    key={bin.id}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-[#0a0a0a]/70 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-hud text-[11px] font-bold',
                        bin.fill > site.thresholds.binFillCritical
                          ? 'bg-crit/15 text-crit'
                          : 'bg-warn/15 text-warn',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-foreground">{bin.label}</div>
                      <div className="text-[10px] text-muted-foreground">{bin.buildingId}</div>
                    </div>
                    <div className="w-20 shrink-0">
                      <Progress
                        value={bin.fill}
                        indicatorClassName={
                          bin.fill > site.thresholds.binFillCritical ? 'bg-crit' : 'bg-warn'
                        }
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[11px] text-foreground">
                      {Math.round(bin.fill)}%
                    </span>
                  </li>
                ))}
              </ol>

              <Separator className="my-2.5" />

              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Truck size={11} />
                    Truck availability: {site.scenarioDefaults.truckAvailability}
                  </div>
                  {routeOptimized && (
                    <div className="mt-1 flex items-center gap-1.5 text-ok">
                      <Route size={11} />
                      Route optimized · est. {durationLabel(routeMinutes)} ({MINUTES_PER_STOP} min/stop)
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={routeOptimized ? 'outline' : 'default'}
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => setRouteOptimized((v) => !v)}
                >
                  <Route size={11} />
                  {routeOptimized ? 'Hide estimate' : 'Optimize route'}
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="hud-panel hud-corner p-3 xl:col-span-2" aria-label="Shift view">
          <div className="mb-2 flex items-center gap-2">
            <Activity size={13} className="text-[#8a8a8a]" />
            <span className="hud-label">Shift View</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-[#0a0a0a]/70 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AlertTriangle size={11} className="text-warn" />
                Open alerts
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{openAlerts}</div>
            </div>
            <div className="rounded-md border border-border bg-[#0a0a0a]/70 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Route size={11} className="text-data" />
                Open recs
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{openRecs}</div>
            </div>
            <div className="rounded-md border border-border bg-[#0a0a0a]/70 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ClipboardList size={11} className="text-primary" />
                Tasks in progress
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{inProgressTasks}</div>
            </div>
            <div className="rounded-md border border-border bg-[#0a0a0a]/70 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Inbox size={11} className="text-warn" />
                Reports received
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{receivedReports}</div>
            </div>
          </div>

          <Separator className="my-2.5" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Congestion index</span>
                <span className="font-mono text-foreground">{congestionPct}%</span>
              </div>
              <Progress value={congestionPct} indicatorClassName={congestionTone} />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>Free flow</span>
                <span>Warning {Math.round(site.thresholds.congestionWarning * 100)}%</span>
                <span>Critical {Math.round(site.thresholds.congestionCritical * 100)}%</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1.5 rounded-md border border-border bg-[#0a0a0a]/70 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users size={11} />
                  On site
                </span>
                <span className="font-mono text-foreground">{kpis.totalPeople}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Zap size={11} />
                  Energy
                </span>
                <span className="font-mono text-foreground">{kpis.energyKw} kW</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
