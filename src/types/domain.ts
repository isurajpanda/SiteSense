import type { StyleSpecification } from 'maplibre-gl';

export type Role = 'admin' | 'operations' | 'sustainability' | 'reporter';

export type Severity = 'ok' | 'warning' | 'critical';

export type CongestionMap = Record<string, number>;

export type SiteType = 'campus' | 'hospital' | 'industrial';

export interface LngLat {
  lng: number;
  lat: number;
}

export type BuildingType =
  | 'academic'
  | 'library'
  | 'admin'
  | 'lab'
  | 'workshop'
  | 'hostel'
  | 'canteen'
  | 'auditorium'
  | 'sports'
  | 'parking'
  | 'residential'
  | 'utility'
  | 'gate'
  | 'waste'
  | 'solar'
  | 'ward'
  | 'emergency'
  | 'pharmacy'
  | 'icu'
  | 'ot'
  | 'lab-diagnostic'
  | 'cafeteria'
  | 'morgue'
  | 'plant'
  | 'warehouse'
  | 'office';

export interface SensorDef {
  id: string;
  kind: SensorKind;
  label: string;
  unit: string;
}

export type SensorKind =
  | 'pm25'
  | 'temp'
  | 'humidity'
  | 'occupancy'
  | 'bin'
  | 'energy'
  | 'water'
  | 'parking'
  | 'traffic'
  | 'aqi'
  | 'co2'
  | 'beds'
  | 'waste-biomed'
  | 'flow';

export interface Building {
  id: string;
  name: string;
  shortName: string;
  type: BuildingType;
  polygon: LngLat[];
  height: number;
  capacity: number;
  floorArea: number;
  sensors: SensorDef[];
  color?: string;
}

export interface RoadSegment {
  id: string;
  name: string;
  path: LngLat[];
}

export interface SiteConfig {
  id: string;
  name: string;
  shortName: string;
  type: SiteType;
  center: LngLat;
  /** MAINTAINER: verify this centre against the Plus Code on Google Maps and adjust. */
  plusCode: string;
  address: string;
  mapStyle: string | StyleSpecification;
  mapAttribution: string;
  buildings: Building[];
  roads: RoadSegment[];
  bins: BinDef[];
  parkingLots: ParkingLotDef[];
  gates: GateDef[];
  thresholds: ThresholdSet;
  emissions: EmissionsConfig;
  scoring: ScoringConfig;
  scenarioDefaults: ScenarioParams;
}

export interface BinDef {
  id: string;
  buildingId: string;
  label: string;
  position: LngLat;
  capacityLitres: number;
}

export interface ParkingLotDef {
  id: string;
  buildingId: string;
  label: string;
  polygon: LngLat[];
  capacity: number;
}

export interface GateDef {
  id: string;
  name: string;
  position: LngLat;
}

export interface ThresholdSet {
  pm25Warning: number;
  pm25Critical: number;
  binFillWarning: number;
  binFillCritical: number;
  occupancyWarningPct: number;
  occupancyCriticalPct: number;
  energyZScore: number;
  parkingWarningPct: number;
  parkingCriticalPct: number;
  congestionWarning: number;
  congestionCritical: number;
  waterLeakFlow: number;
}

export interface EmissionsConfig {
  /** kg CO2e per kWh — India grid average ~0.72 (CEA). Configurable, shown in UI. */
  gridFactorKgPerKwh: number;
  /** kg CO2e per litre diesel for collection trucks. */
  dieselKgPerLitre: number;
  truckLitresPerKm: number;
}

export interface ScoringConfig {
  weights: {
    air: number;
    waste: number;
    energy: number;
    water: number;
    mobility: number;
    resilience: number;
  };
}

export interface ScenarioParams {
  crowdMultiplier: number;
  temperatureC: number;
  rainMm: number;
  eventDurationHrs: number;
  truckAvailability: number;
  pm25Multiplier: number;
  occupancyMultiplier: number;
  wasteMultiplier: number;
  energyMultiplier: number;
  waterMultiplier: number;
  parkingMultiplier: number;
  congestionMultiplier: number;
}

export interface Reading {
  t: number;
  sensorId: string;
  buildingId: string;
  value: number;
}

export interface SeriesPoint {
  t: number;
  value: number;
}

export interface Alert {
  id: string;
  t: number;
  buildingId: string;
  buildingName: string;
  sensorId: string;
  sensorLabel: string;
  severity: Severity;
  message: string;
  observed: number;
  expected: number;
  threshold: number;
  unit: string;
  method: string;
  window: string;
  confidence: number;
  assumptions: string[];
  acknowledged: boolean;
}

export interface ForecastPoint {
  t: number;
  value: number;
  lower: number;
  upper: number;
}

export interface Forecast {
  sensorId: string;
  buildingId: string;
  label: string;
  unit: string;
  model: string;
  horizonHours: number;
  windowHours: number;
  points: ForecastPoint[];
  assumptions: string[];
}

export interface BinEta {
  binId: string;
  buildingId: string;
  etaMinutes: number | null;
  confidence: 'low' | 'moderate' | 'high';
  fillRatePerHour: number;
  currentFill: number;
}

export interface Recommendation {
  id: string;
  t: number;
  type:
    | 'waste-reroute'
    | 'air-advisory'
    | 'hvac-schedule'
    | 'maintenance'
    | 'overflow-parking'
    | 'traffic-retime'
    | 'water-leak'
    | 'escalate-report';
  title: string;
  plainLanguage: string;
  severity: Severity;
  buildingIds: string[];
  action: string;
  expectedImpact: string;
  confidence: number;
  rationale: string[];
  assumptions: string[];
  owner: Role;
  status: 'open' | 'accepted' | 'dismissed' | 'snoozed';
  taskId?: string;
}

export type ReportCategory =
  | 'waste'
  | 'water'
  | 'light'
  | 'air'
  | 'safety'
  | 'road'
  | 'parking'
  | 'other';

export type ReportStatus = 'received' | 'assigned' | 'in-progress' | 'resolved';

export interface Report {
  id: string;
  trackingId: string;
  t: number;
  category: ReportCategory;
  buildingId: string;
  buildingName: string;
  note: string;
  hasPhoto: boolean;
  status: ReportStatus;
  anonymous: boolean;
  upvotes: number;
}

export type TaskStatus = 'new' | 'in-progress' | 'resolved';

export interface Task {
  id: string;
  t: number;
  title: string;
  description: string;
  buildingId: string;
  buildingName: string;
  status: TaskStatus;
  source: 'recommendation' | 'report' | 'manual';
  sourceId?: string;
  assignee?: string;
}

export interface AuditEntry {
  id: string;
  t: number;
  actor: Role;
  action: string;
  detail: string;
}

export interface ScenarioResult {
  id: string;
  name: string;
  description: string;
  params: ScenarioParams;
  baseline: ScenarioSnapshot;
  projected: ScenarioSnapshot;
  newAlerts: Alert[];
  newRecommendations: Recommendation[];
}

export interface ScenarioSnapshot {
  totalPeople: number;
  avgPm25: number;
  binsAbove80: number;
  openReports: number;
  parkingOccupancyPct: number;
  energyKw: number;
  congestionIndex: number;
  waterLitres: number;
}

export interface Scorecard {
  overall: number;
  grade: string;
  subscores: {
    air: number;
    waste: number;
    energy: number;
    water: number;
    mobility: number;
    resilience: number;
  };
  trends: Record<keyof Scorecard['subscores'], SeriesPoint[]>;
  co2eKgPerDay: number;
  wasteDiversionPct: number;
  assumptions: string[];
}

export interface SimSettings {
  running: boolean;
  speed: 1 | 5 | 20;
  dayNight: 'day' | 'night';
  seed: number;
  scrubbing: boolean;
  scrubTime: number | null;
  layers: Record<LayerKey, boolean>;
}

export type LayerKey =
  | 'air'
  | 'occupancy'
  | 'waste'
  | 'traffic'
  | 'reports'
  | 'energy';

export interface TickerEvent {
  id: string;
  t: number;
  message: string;
  severity: Severity;
}
