import { useCallback, useState } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Layers } from 'lucide-react';
import TopBar from '@/components/hud/TopBar';
import LayerRail from '@/components/hud/LayerRail';
import AlertFeed from '@/components/hud/AlertFeed';
import ActionCentre from '@/components/hud/ActionCentre';
import CornerFrame from '@/components/hud/CornerFrame';
import Campus3D from '@/components/map/Campus3D';
import BuildingDrawer from '@/components/building/BuildingDrawer';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getSite } from '@/config/sites';
import { Button } from '@/components/ui/button';
import ChatPanel from '@/components/hud/ChatPanel';

export default function CommandPage() {
  const siteId = useSettingsStore((s) => s.siteId);
  const site = getSite(siteId);
  const [drawerBuilding, setDrawerBuilding] = useState<string | null>(null);
  const [focusBuilding, setFocusBuilding] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [autoOrbit] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const focusOn = useCallback((buildingId: string) => {
    setFocusBuilding(buildingId);
    setFocusTrigger((n) => n + 1);
    setDrawerBuilding(buildingId);
  }, []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black">
      <TopBar onFocusBuilding={focusOn} />

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

        <div className="absolute left-0 top-0 z-30 flex h-full items-center">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="flex h-16 w-6 items-center justify-center rounded-r border border-l-0 border-[#1a1a1a] bg-[#0a0a0a]/90 text-[#8a8a8a] backdrop-blur transition-colors hover:text-[#fafafa]"
            aria-label={leftOpen ? 'Close left panel' : 'Open left panel'}
          >
            {leftOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
        </div>

        <div className="absolute right-0 top-0 z-30 flex h-full items-center">
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="flex h-16 w-6 items-center justify-center rounded-l border border-r-0 border-[#1a1a1a] bg-[#0a0a0a]/90 text-[#8a8a8a] backdrop-blur transition-colors hover:text-[#fafafa]"
            aria-label={rightOpen ? 'Close right panel' : 'Open right panel'}
          >
            {rightOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>

        {leftOpen && (
          <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
            <div className="pointer-events-auto flex items-center gap-2">
              <div className="hud-panel flex items-center gap-2 px-2 py-1.5">
                <Layers size={12} className="text-[#8a8a8a]" />
                <span className="font-hud text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
                  {site.name}
                </span>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => setChatOpen(true)}>
                <MessageSquare size={12} />
                Ask AI
              </Button>
            </div>
            <LayerRail />
          </div>
        )}

        {rightOpen && (
          <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1rem)] flex-col gap-2">
            <AlertFeed onAlertClick={focusOn} />
            <ActionCentre onFocusBuilding={focusOn} />
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#0a0a0a]/80 px-3 py-1 backdrop-blur">
            <span className="font-hud text-[10px] uppercase tracking-wider text-[#8a8a8a]">
              Drag to orbit · scroll to zoom · click a building to inspect
            </span>
          </div>
        </div>
      </div>

      <BuildingDrawer buildingId={drawerBuilding} onClose={() => setDrawerBuilding(null)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
