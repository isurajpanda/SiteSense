import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { enableRemoteLLM } from '@/lib/reco/llmProvider';

enableRemoteLLM();
import CommandPage from '@/pages/Command';
import OpsPage from '@/pages/Ops';
import SustainabilityPage from '@/pages/Sustainability';
import ScenariosPage from '@/pages/Scenarios';
import ReportPage from '@/pages/Report';
import AboutPage from '@/pages/About';

const ROLE_LANDING: Record<string, string> = {
  admin: '/',
  operations: '/ops',
  sustainability: '/sustainability',
  reporter: '/report',
};

export default function App() {
  const siteId = useSettingsStore((s) => s.siteId);
  const role = useSettingsStore((s) => s.role);
  const initialized = useSimStore((s) => s.initialized);
  const init = useSimStore((s) => s.init);
  const tick = useSimStore((s) => s.tick);
  const running = useSettingsStore((s) => s.running);
  const speed = useSettingsStore((s) => s.speed);

  useEffect(() => {
    if (!initialized) init(siteId);
  }, [initialized, init, siteId]);

  useEffect(() => {
    if (!initialized) return;
    const interval = setInterval(() => {
      if (running) tick();
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [initialized, running, speed, tick]);

  return (
    <div className="flex h-full flex-col">
      <Routes>
        <Route path="/" element={<CommandPage />} />
        <Route path="/ops" element={<OpsPage />} />
        <Route path="/sustainability" element={<SustainabilityPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to={ROLE_LANDING[role] ?? '/'} replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}
