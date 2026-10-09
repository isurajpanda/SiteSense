import type { Alert, Building } from '@/types/domain';

export type ElementStatus = 'ok' | 'warning' | 'critical';

export interface RoomElement {
  id: string;
  label: string;
  value: string;
  status: ElementStatus;
}

export interface Room {
  id: string;
  name: string;
  floor: number;
  status: ElementStatus;
  occupancy: number;
  capacity: number;
  tempC: number;
  pm25: number;
  energyKw: number;
  elements: RoomElement[];
}

export interface FloorPlan {
  floor: number;
  label: string;
  rooms: Room[];
}

export interface InteriorContext {
  alerts: Alert[];
  occupancy: number;
  tempC: number;
  pm25: number;
  energyKw: number;
  binFill: number;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOM_NAMES: Record<string, string[]> = {
  academic: ['Lecture Hall', 'Classroom', 'Seminar Room', 'Faculty Office'],
  lab: ['Lab', 'Prep Room', 'Instrument Room', 'Research Bay'],
  library: ['Reading Hall', 'Stacks', 'Study Room', 'Archive'],
  admin: ['Office', 'Records Room', 'Meeting Room', 'Reception'],
  hostel: ['Dorm', 'Common Room', 'Warden Office', 'Study Hall'],
  canteen: ['Dining Hall', 'Kitchen', 'Store Room', 'Counter'],
  auditorium: ['Main Hall', 'Green Room', 'Projection Room', 'Lobby'],
  sports: ['Court', 'Gym', 'Locker Room', 'Equipment Store'],
  parking: ['Bay', 'EV Zone', 'Two-Wheeler Bay', 'Marshal Post'],
  residential: ['Flat', 'Lobby', 'Utility Room', 'Terrace'],
  gate: ['Cabin', 'Barrier Bay', 'CCTV Room', 'Waiting Area'],
  waste: ['Sorting Bay', 'Compost Pit', 'Store', 'Wash Area'],
  solar: ['Inverter Room', 'Panel Array', 'Battery Bank', 'Control Room'],
  workshop: ['Bay', 'Tool Crib', 'Welding Shop', 'Office'],
  utility: ['Plant Room', 'Pump House', 'Panel Room', 'Store'],
};

const TYPE_EXTRA: Record<string, string> = {
  academic: 'Projector',
  lab: 'Fume Hood',
  library: 'Dehumidifier',
  admin: 'Access Panel',
  hostel: 'Bin',
  canteen: 'Cold Storage',
  auditorium: 'Stage Lights',
  sports: 'Floodlights',
  parking: 'Gate Barrier',
  residential: 'Water Dispenser',
  gate: 'Barrier',
  waste: 'Bin',
  solar: 'Inverter',
  workshop: 'Compressor',
  utility: 'DG Set',
};

function rank(s: ElementStatus): number {
  return s === 'critical' ? 2 : s === 'warning' ? 1 : 0;
}

function worst(a: ElementStatus, b: ElementStatus): ElementStatus {
  return rank(a) >= rank(b) ? a : b;
}

/**
 * Deterministically builds a floor/room/element breakdown for a building,
 * blending live simulator values with seeded per-room variation so the
 * interior is stable across renders but reflects current conditions.
 */
export function buildInterior(b: Building, ctx: InteriorContext): FloorPlan[] {
  const rand = mulberry32(hashStr(b.id));
  const floorCount = b.height <= 0 ? 1 : b.height <= 7 ? 1 : Math.min(5, Math.max(2, Math.round(b.height / 4)));
  const roomsPerFloor =
    b.type === 'gate' || b.type === 'waste' || b.type === 'solar'
      ? 2
      : b.floorArea < 1500
        ? 2
        : b.floorArea < 4000
          ? 3
          : 4;

  const names = ROOM_NAMES[b.type] ?? ROOM_NAMES.utility;
  const extra = TYPE_EXTRA[b.type] ?? 'Panel';
  const hasCritical = ctx.alerts.some((a) => a.severity === 'critical');
  const hasWarning = ctx.alerts.some((a) => a.severity === 'warning');

  // Split live occupancy/energy across rooms with seeded weights.
  const totalRooms = floorCount * roomsPerFloor;
  const weights: number[] = Array.from({ length: totalRooms }, () => 0.3 + rand() * 1.4);
  const wSum = weights.reduce((a, x) => a + x, 0);
  const roomCap = b.capacity > 0 ? Math.max(2, Math.round(b.capacity / totalRooms)) : 20;

  const floors: FloorPlan[] = [];
  let ri = 0;
  for (let f = 0; f < floorCount; f++) {
    const rooms: Room[] = [];
    for (let r = 0; r < roomsPerFloor; r++, ri++) {
      const id = `${b.id}-f${f}-r${r}`;
      const rrand = mulberry32(hashStr(id));
      const share = weights[ri] / wSum;
      const occupancy = Math.max(0, Math.round(ctx.occupancy * share + (rrand() < 0.3 ? 1 : 0)));
      const tempC = Math.round((ctx.tempC + (rrand() * 3 - 1.5)) * 10) / 10;
      const pm25 = Math.max(0, Math.round(ctx.pm25 + (rrand() * 10 - 5)));
      const energyKw = Math.round(ctx.energyKw * share * 10) / 10;

      let status: ElementStatus = 'ok';
      if (hasCritical && hashStr(id) % 5 === 0) status = 'critical';
      else if (hasWarning && hashStr(id) % 4 === 0) status = 'warning';
      if (b.capacity > 0 && occupancy > roomCap) status = worst(status, 'warning');

      const tempStatus: ElementStatus = tempC > 34 ? 'critical' : tempC > 30 ? 'warning' : 'ok';
      const pmStatus: ElementStatus = pm25 > 120 ? 'critical' : pm25 > 60 ? 'warning' : 'ok';
      const occStatus: ElementStatus = b.capacity > 0 && occupancy > roomCap ? 'warning' : 'ok';
      const binStatus: ElementStatus = ctx.binFill > 85 ? 'critical' : ctx.binFill > 70 ? 'warning' : 'ok';
      status = worst(status, worst(tempStatus, worst(pmStatus, occStatus)));

      const elements: RoomElement[] = [
        { id: `${id}-light`, label: 'Lighting', value: occupancy > 0 || new Date().getHours() >= 6 && new Date().getHours() < 22 ? 'ON' : 'OFF', status: 'ok' },
        { id: `${id}-hvac`, label: 'HVAC', value: `${tempC.toFixed(1)}°C · ${tempC > 26 ? 'cooling' : 'idle'}`, status: tempStatus },
        { id: `${id}-occ`, label: 'Occupancy', value: `${occupancy}/${roomCap} people`, status: occStatus },
        { id: `${id}-air`, label: 'PM2.5', value: `${pm25} µg/m³`, status: pmStatus },
        { id: `${id}-extra`, label: extra, value: extra === 'Bin' ? `${Math.round(ctx.binFill)}% full` : 'nominal', status: extra === 'Bin' ? binStatus : 'ok' },
      ];
      const roomStatus = elements.reduce<ElementStatus>((a, e) => worst(a, e.status), status);

      rooms.push({
        id,
        name: `${names[ri % names.length]} ${f > 0 ? `L${f + 1}-` : ''}${r + 1}`,
        floor: f,
        status: roomStatus,
        occupancy,
        capacity: roomCap,
        tempC,
        pm25,
        energyKw,
        elements,
      });
    }
    floors.push({ floor: f, label: floorCount === 1 ? 'Ground level' : `Floor ${f + 1}`, rooms });
  }
  return floors;
}
