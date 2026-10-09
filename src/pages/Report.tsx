import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2,
  Droplets,
  Lightbulb,
  Wind,
  ShieldAlert,
  Construction,
  Car,
  HelpCircle,
  MapPin,
  Camera,
  Send,
  CheckCircle2,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useReportStore } from '@/store/useReportStore';
import { useSimStore } from '@/store/useSimStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { Report, ReportCategory, ReportStatus } from '@/types/domain';

const CATEGORIES: Array<{ value: ReportCategory; label: string; icon: typeof Trash2 }> = [
  { value: 'waste', label: 'Waste overflow', icon: Trash2 },
  { value: 'water', label: 'Water leak', icon: Droplets },
  { value: 'light', label: 'Broken light', icon: Lightbulb },
  { value: 'air', label: 'Air smell/smoke', icon: Wind },
  { value: 'safety', label: 'Safety hazard', icon: ShieldAlert },
  { value: 'road', label: 'Pothole/road', icon: Construction },
  { value: 'parking', label: 'Parking issue', icon: Car },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const STATUS_FLOW: ReportStatus[] = ['received', 'assigned', 'in-progress', 'resolved'];

const STATUS_STYLE: Record<ReportStatus, { badge: 'warning' | 'data' | 'ok'; label: string }> = {
  received: { badge: 'warning', label: 'Received' },
  assigned: { badge: 'data', label: 'Assigned' },
  'in-progress': { badge: 'data', label: 'In progress' },
  resolved: { badge: 'ok', label: 'Resolved' },
};

export default function ReportPage() {
  const siteId = useSettingsStore((s) => s.siteId);
  const site = getSite(siteId);
  const submitReport = useReportStore((s) => s.submitReport);
  const reports = useReportStore((s) => s.reports);
  const upvote = useReportStore((s) => s.upvote);
  const logAudit = useSimStore((s) => s.logAudit);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Report | null>(null);
  const [showMine, setShowMine] = useState(false);

  const myReports = useMemo(() => reports.slice(0, 10), [reports]);
  const building = site.buildings.find((b) => b.id === buildingId);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!category || !buildingId) return;
    const report = submitReport({
      category,
      buildingId,
      buildingName: building?.name ?? buildingId,
      note: note.trim(),
      hasPhoto: !!photoPreview,
      anonymous: true,
    });
    logAudit('reporter', 'Report submitted', `${report.trackingId} at ${report.buildingName}`);
    setSubmitted(report);
    toast({ title: 'Report submitted', description: `Tracking ID: ${report.trackingId}` });
  };

  const reset = () => {
    setStep(1);
    setCategory(null);
    setBuildingId(null);
    setNote('');
    setPhotoPreview(null);
    setSubmitted(null);
  };

  if (submitted) {
    return (
      <div className="flex min-h-full flex-col bg-[#000000] p-4">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
          <CheckCircle2 size={48} className="text-ok" />
          <h1 className="mt-3 font-display text-lg font-bold tracking-wider text-[#fafafa]">Report received</h1>
          <p className="mt-1 text-xs text-muted-foreground">Your tracking ID</p>
          <div className="mt-2 rounded border border-data/40 bg-data/10 px-4 py-2 font-mono text-xl font-bold tracking-widest text-data">
            {submitted.trackingId}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A pin has been added to the HUD map and the Operations queue has been notified. Track status below —
            it updates as Ops works the report.
          </p>
          <Separator className="my-4 w-full" />
          <StatusTracker report={submitted} />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Report another
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">View on HUD map</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#000000]">
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]/90 p-4">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <h1 className="font-display text-base font-bold tracking-wider text-[#fafafa]">Report an issue</h1>
          <Badge variant="ok" className="ml-auto">
            Anonymous
          </Badge>
        </div>
        <div className="mx-auto mt-2 flex max-w-md gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full',
                step >= s ? 'bg-primary' : 'bg-secondary',
              )}
              aria-label={`Step ${s} of 3`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 p-4">
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="hud-label mb-2">What do you want to report?</h2>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    setCategory(value);
                    setStep(2);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-[#0a0a0a] p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon size={16} className="shrink-0 text-data" />
                  <span className="font-hud text-xs font-semibold uppercase tracking-wider text-[#fafafa]">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="hud-label mb-2">Where is it?</h2>
            <div className="flex flex-col gap-1.5">
              {site.buildings
                .filter((b) => b.type !== 'gate')
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBuildingId(b.id);
                      setStep(3);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border bg-[#0a0a0a] p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MapPin size={14} className="shrink-0 text-ok" />
                    <span className="flex-1 text-sm text-[#fafafa]">{b.name}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="hud-label mb-2">Almost done</h2>
            <div className="rounded-lg border border-border bg-[#0a0a0a] p-3 text-sm text-[#fafafa]">
              {CATEGORIES.find((c) => c.value === category)?.label} · {building?.name}
            </div>
            <div className="mt-3">
              <label className="hud-label mb-1 block" htmlFor="note">
                Note (optional)
              </label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any details…"
                className="min-h-[80px]"
              />
            </div>
            <div className="mt-3">
              <label className="hud-label mb-1 block" htmlFor="photo">
                Photo (optional, stays on your device)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:bg-accent">
                  <Camera size={14} />
                  {photoPreview ? 'Photo attached' : 'Add photo'}
                  <input id="photo" type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="h-10 w-10 rounded border border-border object-cover" />
                )}
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={submit} disabled={!category || !buildingId}>
              <Send size={14} /> Submit report
            </Button>
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-[#0a0a0a]/60 p-3">
          <Lock size={14} className="mt-0.5 shrink-0 text-ok" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Reports are anonymous by default. Photos never leave your device. Stored locally, visible to the
            Operations team in this demo.
          </p>
        </div>

        <button
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-border bg-[#0a0a0a] p-3 text-left"
          onClick={() => setShowMine(!showMine)}
        >
          <span className="font-hud text-xs font-bold uppercase tracking-wider text-[#fafafa]">My reports</span>
          <Badge variant="data">{reports.length}</Badge>
        </button>
        {showMine && (
          <div className="mt-2 space-y-2">
            {myReports.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-[#0a0a0a] p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-data">{r.trackingId}</span>
                  <Badge variant={STATUS_STYLE[r.status].badge}>{STATUS_STYLE[r.status].label}</Badge>
                  {r.status === 'resolved' && (
                    <button
                      className="ml-auto flex items-center gap-1 text-[10px] text-ok"
                      onClick={() => upvote(r.id)}
                      aria-label="Thumbs up resolved report"
                    >
                      👍 {r.upvotes}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {CATEGORIES.find((c) => c.value === r.category)?.label} · {r.buildingName}
                </p>
                <div className="mt-2">
                  <StatusTracker report={r} compact />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StatusTracker({ report, compact }: { report: Report; compact?: boolean }) {
  const idx = STATUS_FLOW.indexOf(report.status);
  return (
    <div className={cn('flex items-center gap-1', compact && 'scale-90')} aria-label={`Status: ${report.status}`}>
      {STATUS_FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold',
              i <= idx ? 'border-ok/50 bg-ok/15 text-ok' : 'border-border text-muted-foreground',
            )}
          >
            {i < idx ? '✓' : i + 1}
          </div>
          {!compact && (
            <span className={cn('text-[9px] uppercase', i <= idx ? 'text-ok' : 'text-muted-foreground')}>
              {STATUS_STYLE[s].label}
            </span>
          )}
          {i < STATUS_FLOW.length - 1 && <div className={cn('h-px w-3', i < idx ? 'bg-ok/50' : 'bg-border')} />}
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border p-3 text-center text-[10px] text-muted-foreground">
      Decision-support insights, not official measurements. ·{' '}
      <Link to="/about" className="text-data underline">
        Assumptions & method
      </Link>
    </footer>
  );
}
