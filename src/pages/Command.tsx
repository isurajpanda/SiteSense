import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Wand2, MapPin, Search, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import TopBar from '@/components/hud/TopBar';
import LayerRail from '@/components/hud/LayerRail';
import AlertFeed from '@/components/hud/AlertFeed';
import ActionCentre from '@/components/hud/ActionCentre';
import Ticker from '@/components/hud/Ticker';
import TimeScrubber from '@/components/hud/TimeScrubber';
import KpiStrip from '@/components/hud/KpiStrip';
import CornerFrame from '@/components/hud/CornerFrame';
import Campus3D from '@/components/map/Campus3D';
import BuildingDrawer from '@/components/building/BuildingDrawer';
import { useSimStore } from '@/store/useSimStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getSite } from '@/config/sites';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { getLLMProvider } from '@/lib/reco/llmProvider';
import { buildLLMContext } from '@/lib/reco/llmContext';
import ChatPanel from '@/components/hud/ChatPanel';

export default function CommandPage() {
  const navigate = useNavigate();
  const siteId = useSettingsStore((s) => s.siteId);
  const site = getSite(siteId);
  const [drawerBuilding, setDrawerBuilding] = useState<string | null>(null);
  const [focusBuilding, setFocusBuilding] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const [askQuery, setAskQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusOn = useCallback((buildingId: string) => {
    setFocusBuilding(buildingId);
    setFocusTrigger((n) => n + 1);
    setDrawerBuilding(buildingId);
  }, []);

  const triggerDemoEvent = useSimStore((s) => s.triggerDemoEvent);

  useEffect(() => {
    return () => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
    };
  }, []);

  const runTour = () => {
    if (tourStep >= 0) {
      setTourStep(-1);
      if (tourTimer.current) clearTimeout(tourTimer.current);
      return;
    }
    setTourStep(0);
    const steps = [
      () => {
        setAutoOrbit(true);
        toast({ title: 'Demo tour', description: 'Live view of the whole estate — KPIs, ticker, alerts.' });
      },
      () => {
        setAutoOrbit(false);
        triggerDemoEvent();
        toast({ title: 'Demo event', description: 'Hostel E bin overflow surge injected.' });
      },
      () => {
        focusOn('hostel-east');
        toast({ title: 'Building detail', description: 'Bin forecast, why-this-fired, accept the recommendation.' });
      },
      () => {
        useSettingsStore.getState().setLayer('air', true);
        focusOn('canteen');
        toast({ title: 'Air quality layer', description: 'Canteen hotspot at lunch — advisory drafted.' });
      },
      () => {
        navigate('/scenarios');
      },
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        setTourStep(-1);
        return;
      }
      setTourStep(i);
      steps[i]();
      i++;
      tourTimer.current = setTimeout(next, 6000);
    };
    next();
  };

  const askSitesense = async () => {
    const q = askQuery.trim();
    if (!q) return;
    const lower = q.toLowerCase();

    if (lower.includes('report')) {
      navigate('/report');
      setAskQuery('');
      return;
    }
    if (lower.includes('sustain')) {
      navigate('/sustainability');
      setAskQuery('');
      return;
    }
    if (lower.includes('scenario')) {
      navigate('/scenarios');
      setAskQuery('');
      return;
    }

    setAiLoading(true);
    setAiResponse('');
    try {
      const provider = getLLMProvider();
      const context = buildLLMContext(siteId);
      const prompt = `User question: "${q}"\n\nProvide a concise decision-support insight based on the current site state. Reference specific buildings, alerts, or recommendations where relevant.`;
      const streamFn = provider.streamInsight;
      if (streamFn) {
        await streamFn.call(provider, prompt, context, (chunk) => setAiResponse((prev) => prev + chunk));
      } else {
        const text = await provider.generateInsight(prompt, context);
        setAiResponse(text);
      }
      if (lower.includes('bin') || lower.includes('waste') || lower.includes('hostel')) {
        focusOn('hostel-east');
      } else if (lower.includes('air') || lower.includes('pm') || lower.includes('canteen')) {
        useSettingsStore.getState().setLayer('air', true);
        focusOn('canteen');
      } else if (lower.includes('parking') || lower.includes('traffic')) {
        useSettingsStore.getState().setLayer('traffic', true);
      } else if (lower.includes('energy') || lower.includes('power')) {
        useSettingsStore.getState().setLayer('energy', true);
        focusOn('science-labs');
      }
    } catch (err) {
      toast({
        title: 'AI insight unavailable',
        description: err instanceof Error ? err.message : 'LLM endpoint not reachable. Using rules-based fallback.',
      });
      if (lower.includes('bin') || lower.includes('waste') || lower.includes('hostel')) focusOn('hostel-east');
      else if (lower.includes('air') || lower.includes('canteen')) {
        useSettingsStore.getState().setLayer('air', true);
        focusOn('canteen');
      } else if (lower.includes('parking') || lower.includes('traffic')) {
        useSettingsStore.getState().setLayer('traffic', true);
      } else if (lower.includes('energy') || lower.includes('power')) {
        useSettingsStore.getState().setLayer('energy', true);
        focusOn('science-labs');
      }
    } finally {
      setAiLoading(false);
      setAskQuery('');
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black">
      <TopBar />

      <div className="relative flex-1">
        <Campus3D
          onBuildingClick={(id) => {
            focusOn(id);
          }}
          focusBuildingId={focusBuilding}
          focusTrigger={focusTrigger}
          autoOrbit={autoOrbit}
        />
        <CornerFrame />

        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
          <KpiStrip />
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="hud-panel flex items-center gap-2 px-2 py-1.5">
              <Search size={12} className="text-[#8a8a8a]" />
              <input
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askSitesense()}
                placeholder="Ask SiteSense… (bin, air, parking, energy)"
                aria-label="Ask SiteSense"
                className="w-52 bg-transparent text-xs text-[#fafafa] placeholder:text-[#8a8a8a] focus-visible:outline-none"
              />
            </div>
            {(aiLoading || aiResponse) && (
              <div className="hud-panel pointer-events-auto w-80 p-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-data" />
                  <span className="font-hud text-[10px] font-bold uppercase tracking-wider text-data">
                    AI insight
                  </span>
                  {aiLoading && <Loader2 size={11} className="ml-auto animate-spin text-[#8a8a8a]" />}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#8a8a8a]">
                  {aiResponse || 'Thinking…'}
                </p>
                <p className="mt-1 text-[9px] text-[#8a8a8a]">
                  Rules + forecasts + templates
                  {getLLMProvider().name !== 'stub (rules + templates, no LLM)' ? ' + LLM' : ''} · simulated data
                </p>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => setChatOpen(true)}>
              <MessageSquare size={12} />
              Ask AI
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={runTour}>
              <Play size={12} />
              {tourStep >= 0 ? 'Stop tour' : 'Demo tour'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[11px]"
              onClick={() => {
                triggerDemoEvent();
                toast({ title: 'Demo event triggered', description: 'Hostel E bin overflow surge.' });
              }}
            >
              <Wand2 size={12} />
              Trigger event
            </Button>
          </div>
        </div>

        <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2">
          <LayerRail />
        </div>

        <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1rem)] flex-col gap-2">
          <AlertFeed onAlertClick={focusOn} />
          <ActionCentre onFocusBuilding={focusOn} />
        </div>

        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2">
          <TimeScrubber />
          <Ticker />
        </div>

        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#0a0a0a]/80 px-3 py-1 backdrop-blur">
            <MapPin size={11} className="text-ok" />
            <span className="font-hud text-[10px] uppercase tracking-wider text-[#8a8a8a]">
              {site.name} · {site.plusCode} · illustrative layout, simulated data
            </span>
          </div>
        </div>
      </div>

      <BuildingDrawer buildingId={drawerBuilding} onClose={() => setDrawerBuilding(null)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
