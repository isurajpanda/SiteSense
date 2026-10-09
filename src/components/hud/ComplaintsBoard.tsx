import { useMemo, useState } from 'react';
import { X, ThumbsUp, MapPin, Zap, UserCheck, Play, CheckCheck, ClipboardList } from 'lucide-react';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useReportStore } from '@/store/useReportStore';
import { complaintPhoto, complaintPhotoUrl, picsumUrl } from '@/lib/complaintImages';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Report, ReportCategory, ReportStatus } from '@/types/domain';

type Filter = 'all' | 'open' | 'progress' | 'resolved';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_BADGE = { received: 'warning', assigned: 'outline', 'in-progress': 'data', resolved: 'ok' } as const;

const INCOMING: Array<{ category: ReportCategory; buildingId: string; note: string }> = [
  { category: 'waste', buildingId: 'hostel-north', note: 'Bins overflowing near the Hostel N entrance, waste spilling onto the path.' },
  { category: 'water', buildingId: 'library', note: 'Tap leaking continuously in the ground-floor washroom.' },
  { category: 'light', buildingId: 'hostel-east', note: 'Corridor lights out on the second floor, very dark after 8pm.' },
  { category: 'road', buildingId: 'gate-north', note: 'Streetlight pole tilted after the storm, looks unsafe.' },
  { category: 'parking', buildingId: 'parking', note: 'Two-wheelers blocking the accessible parking bay.' },
  { category: 'air', buildingId: 'canteen', note: 'Kitchen exhaust smoke drifting into the dining hall.' },
  { category: 'safety', buildingId: 'sports', note: 'Floodlight flickering over court 2, cuts out randomly.' },
  { category: 'other', buildingId: 'admin', note: 'Notice board glass cracked, shards on the floor below.' },
];

function timeAgo(t: number): string {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ComplaintPhoto({ report, index }: { report: Report; index: number }) {
  const [stage, setStage] = useState(0);
  const src =
    stage === 0
      ? complaintPhotoUrl(report.category, report.id)
      : stage === 1
        ? picsumUrl(report.id)
        : complaintPhoto(report.category, index % 3);
  return (
    <img
      src={src}
      alt={`${report.category} issue photo`}
      className="h-28 w-full object-cover"
      loading="lazy"
      onError={() => setStage((s) => Math.min(s + 1, 2))}
    />
  );
}

function nextAction(status: ReportStatus): { label: string; icon: typeof Play; to: ReportStatus } | null {
  if (status === 'received') return { label: 'Assign', icon: UserCheck, to: 'assigned' };
  if (status === 'assigned') return { label: 'Start', icon: Play, to: 'in-progress' };
  if (status === 'in-progress') return { label: 'Resolve', icon: CheckCheck, to: 'resolved' };
  return null;
}

export default function ComplaintsBoard({
  open,
  onClose,
  onFocusBuilding,
}: {
  open: boolean;
  onClose: () => void;
  onFocusBuilding?: (buildingId: string) => void;
}) {
  const siteId = useSettingsStore((s) => s.siteId);
  const reports = useReportStore((s) => s.reports);
  const submitReport = useReportStore((s) => s.submitReport);
  const updateStatus = useReportStore((s) => s.updateStatus);
  const upvote = useReportStore((s) => s.upvote);
  const site = getSite(siteId);
  const [filter, setFilter] = useState<Filter>('all');

  const prettyName = (r: Report) => site.buildings.find((b) => b.id === r.buildingId)?.shortName ?? r.buildingName;

  const visible = useMemo(() => {
    const sorted = [...reports].sort((a, b) => b.t - a.t);
    if (filter === 'all') return sorted;
    if (filter === 'open') return sorted.filter((r) => r.status === 'received' || r.status === 'assigned');
    if (filter === 'progress') return sorted.filter((r) => r.status === 'in-progress');
    return sorted.filter((r) => r.status === 'resolved');
  }, [reports, filter]);

  const openCount = reports.filter((r) => r.status !== 'resolved').length;

  const simulate = () => {
    const pick = INCOMING[Math.floor(Math.random() * INCOMING.length)];
    const name = site.buildings.find((b) => b.id === pick.buildingId)?.shortName ?? pick.buildingId;
    const report = submitReport({ ...pick, buildingName: name, hasPhoto: true, anonymous: true });
    toast({ title: 'New complaint received', description: `${report.trackingId} · ${name} · ${pick.category}` });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-3" role="dialog" aria-modal="true" aria-label="Complaints board">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex h-[82vh] w-full max-w-md flex-col rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]/97 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-data/40 bg-data/10">
            <ClipboardList size={14} className="text-data" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-hud text-xs font-bold uppercase tracking-wider text-[#fafafa]">Complaints board</span>
              <Badge variant="warning">{openCount} open</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">Citizen issues with field photos · demo feed</div>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={simulate}>
            <Zap size={11} />
            Simulate
          </Button>
          <button
            onClick={onClose}
            aria-label="Close complaints board"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded px-2.5 py-1 font-hud text-[10px] font-bold uppercase tracking-wider transition-colors',
                filter === f.key ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#8a8a8a] hover:text-[#fafafa]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {visible.length === 0 && (
            <div className="px-2 py-10 text-center text-xs text-[#8a8a8a]">Nothing here. Try another filter.</div>
          )}
          {visible.map((r, i) => {
            const action = nextAction(r.status);
            const ActionIcon = action?.icon;
            return (
              <div key={r.id} className="hud-panel animate-fade-in overflow-hidden">
                <div className="relative">
                  <ComplaintPhoto key={r.id} report={r} index={i} />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#8a8a8a]">
                    {r.trackingId}
                  </span>
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#8a8a8a]">
                    Field photo
                  </span>
                  <span className="absolute right-2 top-2">
                    <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                  </span>
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="data">{r.category}</Badge>
                    <span className="truncate text-[11px] font-semibold text-[#fafafa]">{prettyName(r)}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[#8a8a8a]">{timeAgo(r.t)}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-[#8a8a8a]">{r.note}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => upvote(r.id)}
                      className="flex h-6 items-center gap-1 rounded border border-[#1a1a1a] px-2 text-[10px] text-[#8a8a8a] transition-colors hover:border-[#3a3a3a] hover:text-[#fafafa]"
                      title="Upvote this issue"
                    >
                      <ThumbsUp size={11} />
                      <span className="tnum">{r.upvotes}</span>
                    </button>
                    {action && ActionIcon && (
                      <Button size="sm" variant="default" className="h-6 flex-1 gap-1 text-[10px]" onClick={() => updateStatus(r.id, action.to)}>
                        <ActionIcon size={11} />
                        {action.label}
                      </Button>
                    )}
                    {r.status === 'resolved' && (
                      <span className="flex h-6 flex-1 items-center justify-center gap-1 text-[10px] text-ok">
                        <CheckCheck size={11} /> Closed
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-1.5 text-[10px]"
                      onClick={() => onFocusBuilding?.(r.buildingId)}
                      title={`Focus ${prettyName(r)} on map`}
                    >
                      <MapPin size={11} /> Map
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
