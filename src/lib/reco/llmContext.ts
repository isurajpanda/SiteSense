import { getSite } from '@/config/sites';
import { useSimStore } from '@/store/useSimStore';
import { useReportStore } from '@/store/useReportStore';

export function buildLLMContext(siteId: string): Record<string, unknown> {
  const site = getSite(siteId);
  const { kpis, alerts, binStates, congestion, recommendations } = useSimStore.getState();
  const reports = useReportStore.getState().reports;
  return {
    site: { name: site.name, type: site.type, plusCode: site.plusCode },
    kpis,
    activeAlerts: alerts.slice(0, 5).map((a) => ({
      building: a.buildingName,
      severity: a.severity,
      message: a.message,
    })),
    binsAbove80: Object.entries(binStates)
      .filter(([, v]) => v > 80)
      .map(([id, v]) => ({ bin: id, fill: Math.round(v) })),
    congestionIndex: congestion,
    openRecommendations: recommendations
      .filter((r) => r.status === 'open')
      .slice(0, 5)
      .map((r) => ({ title: r.title, severity: r.severity, confidence: r.confidence })),
    openReports: reports.filter((r) => r.status !== 'resolved').length,
    note: 'All data is simulated. Provide decision-support insights only.',
  };
}
