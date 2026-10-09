import type {
  Alert,
  BinEta,
  Building,
  Recommendation,
  Report,
  ScenarioParams,
  SiteConfig,
  Task,
} from '@/types/domain';
import { renderTemplate, etaText, type TemplateSlots } from './templates';
import type { LLMProvider } from './llmProvider';

export interface EngineInput {
  site: SiteConfig;
  buildings: Building[];
  binEtas: BinEta[];
  alerts: Alert[];
  openReports: Report[];
  tasks: Task[];
  params: ScenarioParams;
  parkingOccupancyPct: number;
  congestionIndex: number;
  avgPm25: number;
  totalPeople: number;
  energyAnomalyBuildings: string[];
  waterLeakBuildings: string[];
  hour: number;
}

let counter = 0;
function rid(): string {
  counter += 1;
  return `reco-${Date.now().toString(36)}-${counter}`;
}

/**
 * Rules engine: consumes current state, anomalies and forecasts and emits
 * recommendations with plain-language text, rationale and assumptions.
 */
export function runEngine(input: EngineInput, _llm?: LLMProvider): Recommendation[] {
  const recs: Recommendation[] = [];
  const {
    site,
    binEtas,
    alerts,
    openReports,
    params,
    parkingOccupancyPct,
    congestionIndex,
    avgPm25,
    energyAnomalyBuildings,
    waterLeakBuildings,
    hour,
  } = input;
  const t = Date.now();
  const has = (id: string) => recs.some((r) => r.buildingIds.includes(id) && r.type === 'waste-reroute');

  // 1. Waste reroute: bins near overflow, ordered by ETA.
  const urgentBins = binEtas
    .filter((b) => b.etaMinutes !== null && b.etaMinutes < 240)
    .sort((a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999));
  if (urgentBins.length > 0 && !has(urgentBins[0].buildingId)) {
    const first = urgentBins[0];
    const bName = site.buildings.find((b) => b.id === first.buildingId)?.shortName ?? 'a building';
    const slots: TemplateSlots = {
      buildingName: bName,
      etaMinutes: first.etaMinutes,
      confidence: first.confidence,
      time: `around ${String(hour).padStart(2, '0')}:00`,
    };
    recs.push({
      id: rid(),
      t,
      type: 'waste-reroute',
      title: `Reroute waste collection to ${bName} first`,
      plainLanguage: renderTemplate(
        `{buildingName} bin is likely to overflow in {etaMinutes}. Send the collection truck to {buildingName} first. Confidence: {confidence}.`,
        { ...slots, etaMinutes: etaText(first.etaMinutes) },
      ),
      severity: (first.etaMinutes ?? 999) < 90 ? 'critical' : 'warning',
      buildingIds: [first.buildingId],
      action: `Dispatch collection truck to ${bName}; ${urgentBins.length - 1} further stop(s) queued behind.`,
      expectedImpact: `Prevents ~${urgentBins.length} overflow event(s); avoids litter and pest risk.`,
      confidence: first.confidence === 'high' ? 0.85 : first.confidence === 'moderate' ? 0.65 : 0.45,
      rationale: [
        `Bin fill at ${Math.round(first.currentFill)}% with fill rate ${first.fillRatePerHour}%/h.`,
        `ETA to 100%: ${etaText(first.etaMinutes)}.`,
        `Time-of-day multiplier applied (faster fill near meal times).`,
      ],
      assumptions: [
        'Fill rate assumed roughly constant over the next hours.',
        'Collection rounds at 08:00 and 16:00 may reset levels before ETA.',
        'Truck availability factor from scenario params applied.',
      ],
      owner: 'operations',
      status: 'open',
    });
  }

  // 2. Air-quality advisory to hostels when PM2.5 is elevated.
  const pmAlerts = alerts.filter((a) => a.sensorLabel === 'PM2.5' && a.severity !== 'ok');
  if ((avgPm25 > site.thresholds.pm25Warning || pmAlerts.length > 0) && hour >= 6 && hour <= 22) {
    const hostels = site.buildings.filter((b) => b.type === 'hostel' || b.type === 'ward');
    const advisory = `Air quality on campus is currently in the "${pmCategory(avgPm25)}" band (PM2.5 ≈ ${Math.round(avgPm25)} µg/m³, indicative low-cost sensor reading). Hostel residents: keep windows closed during peak hours, avoid outdoor exercise until levels fall, and report any breathing discomfort to the warden.`;
    recs.push({
      id: rid(),
      t,
      type: 'air-advisory',
      title: 'Send air-quality advisory to hostels',
      plainLanguage: advisory,
      severity: avgPm25 > site.thresholds.pm25Critical ? 'critical' : 'warning',
      buildingIds: hostels.map((h) => h.id),
      action: 'Push advisory via hostel wardens and notice boards.',
      expectedImpact: 'Reduces exposure for ~900 residents during peak pollution hours.',
      confidence: 0.7,
      rationale: [
        `Campus mean PM2.5 ≈ ${Math.round(avgPm25)} µg/m³ vs warning threshold ${site.thresholds.pm25Warning}.`,
        `${pmAlerts.length} active PM2.5 alert(s) on the feed.`,
        'CPCB India category bands used for classification.',
      ],
      assumptions: [
        'Low-cost sensor readings are indicative, not official CPCB measurements.',
        'Advisory effectiveness depends on warden follow-through.',
      ],
      owner: 'admin',
      status: 'open',
    });
  }

  // 3. HVAC/lighting schedule adjustment for energy anomalies.
  for (const bid of energyAnomalyBuildings) {
    const b = site.buildings.find((x) => x.id === bid);
    if (!b) continue;
    recs.push({
      id: rid(),
      t,
      type: 'hvac-schedule',
      title: `Adjust HVAC/lighting schedule at ${b.shortName}`,
      plainLanguage: `${b.shortName} is using significantly more energy than expected for this hour. Switch to setback mode: raise cooling setpoint by 2°C and turn off lighting in unoccupied zones.`,
      severity: 'warning',
      buildingIds: [bid],
      action: 'Apply night setback: +2°C setpoint, lighting off in unoccupied zones.',
      expectedImpact: 'Typically 15–25% reduction in after-hours energy use.',
      confidence: 0.6,
      rationale: [
        `Rolling z-score exceeded threshold ${site.thresholds.energyZScore} for energy at ${b.shortName}.`,
        'Occupancy at this hour is low, so full HVAC is likely unnecessary.',
      ],
      assumptions: [
        'Assumes BMS can apply setpoints remotely.',
        'Savings estimate is indicative, from typical building benchmarks.',
      ],
      owner: 'operations',
      status: 'open',
    });
  }

  // 4. Maintenance prioritisation from open reports.
  const staleReports = openReports.filter((r) => r.status === 'received');
  if (staleReports.length >= 2) {
    const byBuilding = new Map<string, number>();
    for (const r of staleReports) byBuilding.set(r.buildingId, (byBuilding.get(r.buildingId) ?? 0) + 1);
    const [topBid, count] = [...byBuilding.entries()].sort((a, b) => b[1] - a[1])[0];
    const b = site.buildings.find((x) => x.id === topBid);
    if (b) {
      recs.push({
        id: rid(),
        t,
        type: 'maintenance',
        title: `Prioritise maintenance inspection at ${b.shortName}`,
        plainLanguage: `${count} citizen reports are waiting at ${b.shortName}. Send a maintenance technician to inspect and clear the queue.`,
        severity: 'warning',
        buildingIds: [topBid],
        action: `Assign technician to ${b.shortName}; target same-day inspection.`,
        expectedImpact: `Clears ${count} report(s); improves reported satisfaction.`,
        confidence: 0.65,
        rationale: [`${staleReports.length} reports in "Received" state campus-wide.`, `${b.shortName} has the most (${count}).`],
        assumptions: ['Assumes at least one technician is on shift.', 'Report categories are mixed; triage on arrival.'],
        owner: 'operations',
        status: 'open',
      });
    }
  }

  // 5. Overflow parking.
  if (parkingOccupancyPct > site.thresholds.parkingWarningPct * 100) {
    const lot = site.parkingLots[0];
    recs.push({
      id: rid(),
      t,
      type: 'overflow-parking',
      title: 'Open overflow parking arrangement',
      plainLanguage: `Main parking is ${Math.round(parkingOccupancyPct)}% full. Open the overflow area near the sports ground and deploy a marshal at the gate to direct vehicles.`,
      severity: parkingOccupancyPct > site.thresholds.parkingCriticalPct * 100 ? 'critical' : 'warning',
      buildingIds: [lot?.buildingId ?? 'parking'],
      action: 'Open overflow parking; deploy traffic marshal at main gate.',
      expectedImpact: 'Reduces gate queueing and illegal roadside parking.',
      confidence: 0.7,
      rationale: [`Parking occupancy ${Math.round(parkingOccupancyPct)}% vs warning ${Math.round(site.thresholds.parkingWarningPct * 100)}%.`],
      assumptions: ['Overflow area is available and safe to use.', 'Marshal availability assumed.'],
      owner: 'operations',
      status: 'open',
    });
  }

  // 6. Traffic re-time / marshals.
  if (congestionIndex > site.thresholds.congestionWarning) {
    recs.push({
      id: rid(),
      t,
      type: 'traffic-retime',
      title: 'Re-time shuttle and deploy traffic marshals',
      plainLanguage: `Campus roads are ${Math.round(congestionIndex * 100)}% congested. Shift shuttle departures 15 minutes earlier and place marshals at the main gate and ring-road junction.`,
      severity: congestionIndex > site.thresholds.congestionCritical ? 'critical' : 'warning',
      buildingIds: site.gates.map((g) => g.id),
      action: 'Re-time shuttles; deploy marshals at main gate and ring-road junction.',
      expectedImpact: 'Cuts peak gate queue by an estimated 30–40%.',
      confidence: 0.55,
      rationale: [`Congestion index ${congestionIndex.toFixed(2)} vs warning ${site.thresholds.congestionWarning}.`],
      assumptions: ['Congestion index is a simulated composite of gate traffic and parking.', 'Impact estimate is indicative.'],
      owner: 'operations',
      status: 'open',
    });
  }

  // 7. Water-leak inspection.
  for (const bid of waterLeakBuildings) {
    const b = site.buildings.find((x) => x.id === bid);
    if (!b) continue;
    recs.push({
      id: rid(),
      t,
      type: 'water-leak',
      title: `Inspect ${b.shortName} for water leak`,
      plainLanguage: `${b.shortName} shows constant water flow during night hours when usage should be near zero — a classic leak signature. Send a plumber to inspect taps, flush valves and pipes.`,
      severity: 'warning',
      buildingIds: [bid],
      action: 'Plumber inspection of taps, flush valves and exposed piping.',
      expectedImpact: 'A typical hidden leak wastes 200–500 L/h; early fix saves water and prevents damage.',
      confidence: 0.6,
      rationale: [`Night flow exceeds leak threshold ${site.thresholds.waterLeakFlow} L/h at ${b.shortName}.`, 'Flow is constant rather than usage-shaped.'],
      assumptions: ['Leak threshold is a config value, not a plumbing standard.', 'Flow sensor is simulated.'],
      owner: 'operations',
      status: 'open',
    });
  }

  // 8. Escalate citizen reports.
  const safetyReports = openReports.filter((r) => r.category === 'safety');
  for (const r of safetyReports.slice(0, 2)) {
    recs.push({
      id: rid(),
      t,
      type: 'escalate-report',
      title: `Escalate safety report ${r.trackingId}`,
      plainLanguage: `A safety hazard was reported at ${r.buildingName} and is still unassigned. Escalate to the operations lead and inspect today.`,
      severity: 'critical',
      buildingIds: [r.buildingId],
      action: `Escalate report ${r.trackingId} to operations lead; inspect today.`,
      expectedImpact: 'Safety hazards should be inspected within 24h.',
      confidence: 0.8,
      rationale: [`Report ${r.trackingId} category=safety, status=${r.status}.`],
      assumptions: ['Safety category treated as highest priority.'],
      owner: 'admin',
      status: 'open',
    });
  }

  // Scenario-driven extras.
  if (params.crowdMultiplier > 1.4) {
    recs.push({
      id: rid(),
      t,
      type: 'traffic-retime',
      title: 'Event crowd: pre-position waste and traffic staff',
      plainLanguage: `A large crowd is expected (scenario multiplier ${params.crowdMultiplier.toFixed(1)}×). Pre-position extra bins near the event venue and schedule additional collection rounds.`,
      severity: 'warning',
      buildingIds: ['auditorium', 'canteen'],
      action: 'Add 2 collection rounds; pre-position 6 extra bins near event venue.',
      expectedImpact: 'Keeps bin overflow risk low during the event peak.',
      confidence: 0.6,
      rationale: [`Crowd multiplier ${params.crowdMultiplier.toFixed(1)}× from active scenario.`],
      assumptions: ['Extra bins and staff are available.'],
      owner: 'operations',
      status: 'open',
    });
  }

  return recs;
}

export function pmCategory(pm25: number): string {
  if (pm25 <= 30) return 'Good';
  if (pm25 <= 60) return 'Satisfactory';
  if (pm25 <= 90) return 'Moderate';
  if (pm25 <= 120) return 'Poor';
  if (pm25 <= 250) return 'Very Poor';
  return 'Severe';
}
