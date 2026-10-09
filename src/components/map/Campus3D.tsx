import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import type { Alert, Building, LngLat, Severity } from '@/types/domain';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { useReportStore } from '@/store/useReportStore';
import { buildInterior, type FloorPlan } from '@/lib/campus/interiors';

const M_PER_DEG = 111320;

function toMeters(c: LngLat, p: LngLat): { x: number; z: number } {
  return { x: (p.lng - c.lng) * M_PER_DEG, z: (p.lat - c.lat) * M_PER_DEG };
}

function centroidMeters(c: LngLat, poly: LngLat[]): { x: number; z: number } {
  const n = poly.length;
  let x = 0;
  let z = 0;
  for (const p of poly) {
    const m = toMeters(c, p);
    x += m.x;
    z += m.z;
  }
  return { x: x / n, z: z / n };
}

const STATUS_COLOR: Record<Severity, string> = {
  ok: '#00E5C3',
  warning: '#FFB020',
  critical: '#FF4D5E',
};

function buildingFrame(polygon: LngLat[], center: LngLat): { cx: number; cz: number; bw: number; bd: number } {
  const pts = polygon.map((p) => toMeters(center, p));
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, bw: maxX - minX, bd: maxZ - minZ };
}

const BUILDING_COLORS: Record<string, { wall: string; roof: string }> = {
  academic: { wall: '#c8c4bc', roof: '#8b8680' },
  library: { wall: '#b8a88a', roof: '#7a6a50' },
  admin: { wall: '#d0ccc4', roof: '#908c84' },
  lab: { wall: '#c4ccd4', roof: '#848c94' },
  workshop: { wall: '#c8b8a0', roof: '#887860' },
  hostel: { wall: '#d4c8b8', roof: '#948878' },
  canteen: { wall: '#d8c4a8', roof: '#988468' },
  auditorium: { wall: '#c8c0b4', roof: '#888074' },
  sports: { wall: '#b8c8b0', roof: '#788870' },
  parking: { wall: '#a8a8a8', roof: '#686868' },
  residential: { wall: '#d0c4b0', roof: '#908470' },
  utility: { wall: '#b0b0b0', roof: '#707070' },
  gate: { wall: '#c0c0c0', roof: '#808080' },
  waste: { wall: '#a0a090', roof: '#606050' },
  solar: { wall: '#4060a0', roof: '#204080' },
};

function worstSeverity(alerts: Alert[], buildingId: string): Severity {
  let worst: Severity = 'ok';
  for (const a of alerts) {
    if (a.buildingId !== buildingId || a.severity === 'ok') continue;
    if (a.severity === 'critical') return 'critical';
    worst = 'warning';
  }
  return worst;
}

function lastVal(history: Record<string, { t: number; value: number }[]>, key: string): number {
  const s = history[key];
  return s && s.length > 0 ? s[s.length - 1].value : 0;
}

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
function congestionColor(v: number): string {
  const stops: Array<[number, string]> = [
    [0, '#00E5C3'],
    [0.55, '#FFB020'],
    [0.8, '#FF4D5E'],
    [1, '#B91C1C'],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      const t = (v - v0) / Math.max(1e-6, v1 - v0);
      return `#${_c1.set(c0).lerp(_c2.set(c1), t).getHexString()}`;
    }
  }
  return stops[stops.length - 1][1];
}

function CameraRig({ target, pos, animKey }: { target: [number, number, number]; pos: [number, number, number]; animKey: number | string }) {
  const camera = useThree((s) => s.camera);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;
  const animating = useRef(false);
  const t = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    t.set(target[0], target[1], target[2]);
    p.set(pos[0], pos[1], pos[2]);
    animating.current = true;
  }, [animKey]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      animating.current = false;
    };
    controls.addEventListener('start', cancel);
    return () => {
      controls.removeEventListener('start', cancel);
    };
  }, [controls]);

  useFrame(() => {
    if (!animating.current || !controls) return;
    camera.position.lerp(p, 0.07);
    controls.target.lerp(t, 0.1);
    controls.update();
    if (camera.position.distanceTo(p) < 1.5 && controls.target.distanceTo(t) < 1.5) {
      animating.current = false;
    }
  });
  return null;
}

function BuildingMesh({
  b,
  center,
  status,
  selected,
  entered,
  dimmed,
  onSelect,
}: {
  b: Building;
  center: LngLat;
  status: Severity;
  selected: boolean;
  entered: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const h = Math.max(1.2, b.height);
  const colors = BUILDING_COLORS[b.type] ?? BUILDING_COLORS.academic;
  const frame = useMemo(() => buildingFrame(b.polygon, center), [b.polygon, center]);

  const geom = useMemo(() => {
    const pts = b.polygon.map((p) => toMeters(center, p));
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x - frame.cx, -(pts[0].z - frame.cz));
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x - frame.cx, -(pts[i].z - frame.cz));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (bb) {
      g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    }
    return g;
  }, [b.polygon, center, frame.cx, frame.cz, h]);

  useEffect(() => () => geom.dispose(), [geom]);

  const mats = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1 });
    const cap = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
    return { wall, cap };
  }, []);

  useEffect(
    () => () => {
      mats.wall.dispose();
      mats.cap.dispose();
    },
    [mats],
  );

  const hidden = entered && selected;
  const opacity = hidden ? 0 : dimmed ? 0.35 : 1;
  const statusEmissive = status === 'critical' ? '#FF4D5E' : status === 'warning' ? '#FFB020' : '#00E5C3';
  mats.wall.color.set(colors.wall);
  mats.wall.transparent = opacity < 1;
  mats.wall.opacity = Math.max(opacity, 0.001);
  mats.wall.emissive.set(statusEmissive);
  mats.wall.emissiveIntensity = dimmed ? 0.05 : 0.15;
  mats.wall.depthWrite = opacity >= 1;
  mats.cap.color.set(colors.roof);
  mats.cap.transparent = opacity < 1;
  mats.cap.opacity = Math.max(opacity, 0.001);
  mats.cap.depthWrite = opacity >= 1;

  return (
    <group>
      {!hidden && (
        <mesh
          geometry={geom}
          material={[mats.cap, mats.wall]}
          position={[frame.cx, 0, frame.cz]}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {selected && <Edges scale={1} threshold={15} color="#fafafa" />}
        </mesh>
      )}
      {!hidden && b.type !== 'parking' && b.type !== 'sports' && b.type !== 'gate' && b.type !== 'waste' && (
        <group>
          {(b.type === 'academic' || b.type === 'hostel' || b.type === 'admin' || b.type === 'library') && (
            <>
              <mesh position={[frame.cx - 6, h + 0.75, frame.cz - 4]} castShadow>
                <boxGeometry args={[3, 1.5, 3]} />
                <meshStandardMaterial color="#6a6a6a" metalness={0.4} roughness={0.6} />
              </mesh>
              <mesh position={[frame.cx + 1, h + 0.75, frame.cz - 4]} castShadow>
                <boxGeometry args={[3, 1.5, 3]} />
                <meshStandardMaterial color="#6a6a6a" metalness={0.4} roughness={0.6} />
              </mesh>
            </>
          )}
          {(b.type === 'hostel' || b.type === 'canteen') && (
            <mesh position={[frame.cx + frame.bw / 2 - 4, h + 1.5, frame.cz + frame.bd / 2 - 4]} castShadow>
              <cylinderGeometry args={[1.5, 1.5, 3, 10]} />
              <meshStandardMaterial color="#4a6a8a" metalness={0.3} roughness={0.7} />
            </mesh>
          )}
          {(b.type === 'admin' || b.type === 'academic') && (
            <mesh position={[frame.cx, h + 4, frame.cz]}>
              <cylinderGeometry args={[0.15, 0.15, 8, 4]} />
              <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
            </mesh>
          )}
        </group>
      )}
      {!hidden && (
        <Html position={[frame.cx, h + 14, frame.cz]} center distanceFactor={500} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="rounded border border-[#1a1a1a] bg-black/70 px-1.5 py-0.5 text-center font-hud text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ color: STATUS_COLOR[status] }}
          >
            {b.shortName}
          </div>
        </Html>
      )}
    </group>
  );
}

function RoadSegment({ a, x2, z2, color, width }: { a: { x: number; z: number }; x2: number; z2: number; color: string; width: number }) {
  const len = Math.hypot(x2 - a.x, z2 - a.z);
  if (len < 0.5) return null;
  const ang = Math.atan2(z2 - a.z, x2 - a.x);
  return (
    <group position={[(a.x + x2) / 2, 0.12, (a.z + z2) / 2]} rotation-y={-ang}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[len + 2, width + 3]} />
        <meshStandardMaterial color="#0c0e11" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[len, width]} />
        <meshStandardMaterial color="#3a4046" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <planeGeometry args={[len, 0.6]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, width / 2 - 0.3]}>
        <planeGeometry args={[len, 0.18]} />
        <meshBasicMaterial color="#8a8f96" transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, -width / 2 + 0.3]}>
        <planeGeometry args={[len, 0.18]} />
        <meshBasicMaterial color="#8a8f96" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function ParkingLot({ building, center, onSelect }: { building: Building; center: LngLat; onSelect: () => void }) {
  if (building.type !== 'parking') return null;
  const pts = building.polygon.map((p) => toMeters(center, p));
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const w = maxX - minX;
  const d = maxZ - minZ;

  return (
    <group>
      <mesh
        position={[(minX + maxX) / 2, 0.03, (minZ + maxZ) / 2]}
        rotation-x={-Math.PI / 2}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#151515" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.floor(w / 8) }, (_, c) => (
        <mesh key={c} position={[minX + 4 + c * 8, 0.06, (minZ + maxZ) / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.2, d - 4]} />
          <meshBasicMaterial color="#444444" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Interior({
  b,
  center,
  floors,
  roomId,
  onRoom,
}: {
  b: Building;
  center: LngLat;
  floors: FloorPlan[];
  roomId: string | null;
  onRoom: (id: string) => void;
}) {
  const frame = useMemo(() => buildingFrame(b.polygon, center), [b.polygon, center]);
  const bw = frame.bw;
  const bd = frame.bd;
  const n = floors.length;
  const floorH = Math.max(4, Math.max(3, b.height) / n);

  return (
    <group position={[frame.cx, 0, frame.cz]}>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[bw + 1.5, 0.3, bd + 1.5]} />
        <meshStandardMaterial color="#1c1c22" roughness={0.8} />
      </mesh>
      {floors.map((f, fi) => {
        const cols = Math.ceil(Math.sqrt(f.rooms.length));
        const rows = Math.ceil(f.rooms.length / cols);
        const cw = bw / cols;
        const cd = bd / rows;
        const y = fi * floorH;
        return (
          <group key={f.floor}>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[bw, 0.5, bd]} />
              <meshStandardMaterial color="#1c1c22" roughness={0.8} />
            </mesh>
            {f.rooms.map((r, ri) => {
              const col = ri % cols;
              const row = Math.floor(ri / cols);
              const cx = -bw / 2 + cw * (col + 0.5);
              const cz = -bd / 2 + cd * (row + 0.5);
              const sel = roomId === r.id;
              return (
                <mesh
                  key={r.id}
                  position={[cx, y + floorH / 2, cz]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRoom(r.id);
                  }}
                >
                  <boxGeometry args={[Math.max(2, cw - 1.2), Math.max(1.5, floorH - 1.2), Math.max(2, cd - 1.2)]} />
                  <meshStandardMaterial
                    color={STATUS_COLOR[r.status]}
                    emissive={sel ? '#ffffff' : '#000000'}
                    emissiveIntensity={sel ? 0.35 : 0}
                    transparent
                    opacity={0.85}
                    roughness={0.5}
                  />
                  {sel && <Edges scale={1} threshold={15} color="#fafafa" />}
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

interface Campus3DProps {
  onBuildingClick: (buildingId: string) => void;
  focusBuildingId: string | null;
  focusTrigger: number;
  autoOrbit: boolean;
}

function Campus3D({ onBuildingClick, focusBuildingId, focusTrigger, autoOrbit }: Campus3DProps) {
  const siteId = useSettingsStore((s) => s.siteId);
  const layers = useSettingsStore((s) => s.layers);
  const site = getSite(siteId);
  const alerts = useSimStore((s) => s.alerts);
  const history = useSimStore((s) => s.history);
  const congestion = useSimStore((s) => s.congestion);
  const binStates = useSimStore((s) => s.binStates);
  const reports = useReportStore((s) => s.reports);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusBuildingId) return;
    if (site.buildings.some((b) => b.id === focusBuildingId)) {
      setSelectedId(focusBuildingId);
      setEntered(false);
      setRoomId(null);
    }
  }, [focusTrigger]);

  const selected = site.buildings.find((b) => b.id === selectedId) ?? null;

  const liveFor = (b: Building) => ({
    alerts: alerts.filter((a) => a.buildingId === b.id && a.severity !== 'ok'),
    occupancy: lastVal(history, `${b.id}:occupancy`),
    tempC: lastVal(history, `${b.id}:temp`),
    pm25: lastVal(history, `${b.id}:pm25`),
    energyKw: lastVal(history, `${b.id}:energy`),
    binFill: Math.max(0, ...site.bins.filter((x) => x.buildingId === b.id).map((x) => binStates[x.id] ?? 0)),
  });

  const floors = useMemo(() => {
    if (!selected) return [];
    const ctx = liveFor(selected);
    return buildInterior(selected, ctx);
  }, [selected?.id, alerts, history, binStates]);

  const selectedRoom = useMemo(() => {
    if (!roomId) return null;
    for (const f of floors) {
      const r = f.rooms.find((x) => x.id === roomId);
      if (r) return r;
    }
    return null;
  }, [floors, roomId]);

  const selCenter = selected ? centroidMeters(site.center, selected.polygon) : { x: 0, z: 0 };
  const selH = selected ? Math.max(3, selected.height) : 0;
  const selSize = useMemo(() => {
    if (!selected) return 100;
    const pts = selected.polygon.map((p) => toMeters(site.center, p));
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 40);
  }, [selected?.id]);

  const cam = selected
    ? entered
      ? {
          target: [selCenter.x, selH * 0.4, selCenter.z] as [number, number, number],
          pos: [selCenter.x + selSize * 0.7, selH * 0.5 + 10, selCenter.z + selSize * 0.7 + 12] as [number, number, number],
        }
      : {
          target: [selCenter.x, selH / 2, selCenter.z] as [number, number, number],
          pos: [selCenter.x + selSize * 1.1 + 70, selH + 80, selCenter.z + selSize * 1.1 + 70] as [number, number, number],
        }
    : {
        target: [0, 0, 0] as [number, number, number],
        pos: [310, 330, 310] as [number, number, number],
      };
  const animKey = `${selectedId ?? 'campus'}:${entered ? 'in' : 'out'}:${focusTrigger}`;

  const select = (id: string) => {
    setSelectedId(id);
    setEntered(false);
    setRoomId(null);
    onBuildingClick(id);
  };
  const deselect = () => {
    setSelectedId(null);
    setEntered(false);
    setRoomId(null);
  };

  const dot = (s: string) => (s === 'critical' ? 'bg-crit' : s === 'warning' ? 'bg-warn' : 'bg-ok');

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [310, 330, 310], fov: 50, near: 1, far: 6000 }}
        shadows="percentage"
        onPointerMissed={() => {
          if (selectedId) deselect();
        }}
      >
        <color attach="background" args={['#050508']} />
        <fog attach="fog" args={['#050508', 700, 2600]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#4a4a5a', '#0a0a0a', 0.5]} />
        <directionalLight
          position={[300, 400, 200]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={1000}
          shadow-camera-left={-400}
          shadow-camera-right={400}
          shadow-camera-top={400}
          shadow-camera-bottom={-400}
        />
        <directionalLight position={[-200, 200, -100]} intensity={0.3} color="#6688aa" />

        <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]} receiveShadow>
          <planeGeometry args={[3000, 3000]} />
          <meshStandardMaterial color="#0d1210" roughness={0.95} metalness={0} />
        </mesh>
        <gridHelper args={[2000, 50, '#1c1c22', '#0b0b0e']} position={[0, -0.1, 0]} />

        {site.roads.map((r) => {
          const v = congestion[r.id] ?? 0.3;
          const color = congestionColor(v);
          const pts = r.path.map((p) => toMeters(site.center, p));
          return (
            <group key={r.id}>
              {pts.slice(0, -1).map((a, i) => (
                <RoadSegment key={i} a={a} x2={pts[i + 1].x} z2={pts[i + 1].z} color={color} width={12} />
              ))}
            </group>
          );
        })}

        {site.buildings
          .filter((b) => b.type !== 'parking')
          .map((b) => (
            <BuildingMesh
              key={b.id}
              b={b}
              center={site.center}
              status={worstSeverity(alerts, b.id)}
              selected={b.id === selectedId}
              entered={entered && b.id === selectedId}
              dimmed={!!selectedId && b.id !== selectedId}
              onSelect={() => select(b.id)}
            />
          ))}

        {site.buildings.filter((b) => b.type === 'parking').map((b) => (
          <ParkingLot key={`parking-${b.id}`} building={b} center={site.center} onSelect={() => select(b.id)} />
        ))}

        {site.gates.map((g) => {
          const m = toMeters(site.center, g.position);
          return (
            <group key={g.id} position={[m.x, 0, m.z]}>
              <mesh position={[0, 2.5, 0]} castShadow>
                <coneGeometry args={[3, 5, 4]} />
                <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[0, 6, 0]}>
                <sphereGeometry args={[0.8, 8, 8]} />
                <meshBasicMaterial color="#7dd3fc" />
              </mesh>
            </group>
          );
        })}

        {layers.waste &&
          site.bins.map((bin) => {
            const m = toMeters(site.center, bin.position);
            const fill = binStates[bin.id] ?? 0;
            const color = fill > 85 ? '#FF4D5E' : fill > 70 ? '#FFB020' : '#00E5C3';
            return (
              <group key={bin.id} position={[m.x, 0, m.z]}>
                <mesh position={[0, 1.5, 0]} castShadow>
                  <cylinderGeometry args={[1.2, 1.4, 3, 8]} />
                  <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
                </mesh>
                <mesh position={[0, 3.2, 0]}>
                  <cylinderGeometry args={[1.3, 1.3, 0.3, 8]} />
                  <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
                </mesh>
              </group>
            );
          })}

        {site.buildings.map((b) => {
          const c = centroidMeters(site.center, b.polygon);
          const h = Math.max(1.2, b.height);
          const pm25 = lastVal(history, `${b.id}:pm25`);
          const occ = lastVal(history, `${b.id}:occupancy`);
          const kw = lastVal(history, `${b.id}:energy`);
          const occFrac = b.capacity > 0 ? occ / b.capacity : 0;
          return (
            <group key={`m-${b.id}`}>
              {layers.air && (
                <mesh position={[c.x, h + 12, c.z]}>
                  <sphereGeometry args={[3, 12, 12]} />
                  <meshBasicMaterial color={pm25 > 120 ? '#FF4D5E' : pm25 > 60 ? '#FFB020' : '#00E5C3'} transparent opacity={0.8} />
                </mesh>
              )}
              {layers.occupancy && (
                <mesh position={[c.x + 7, h + 9, c.z]}>
                  <sphereGeometry args={[2.2, 12, 12]} />
                  <meshBasicMaterial color={occFrac > 1 ? '#B91C1C' : occFrac > 0.85 ? '#FF4D5E' : occFrac > 0.5 ? '#FFB020' : '#00E5C3'} transparent opacity={0.8} />
                </mesh>
              )}
              {layers.energy && (
                <mesh position={[c.x - 7, h + 9, c.z]}>
                  <sphereGeometry args={[2.2, 12, 12]} />
                  <meshBasicMaterial color={kw > 150 ? '#7DD3FC' : kw > 50 ? '#38BDF8' : '#1D4ED8'} transparent opacity={0.8} />
                </mesh>
              )}
              {layers.reports &&
                reports
                  .filter((r) => r.buildingId === b.id && r.status !== 'resolved')
                  .slice(0, 2)
                  .map((r, i) => (
                    <mesh key={r.id} position={[c.x - 4 + i * 8, h + 6, c.z + 6]}>
                      <octahedronGeometry args={[2]} />
                      <meshBasicMaterial color="#FF4D5E" transparent opacity={0.8} />
                    </mesh>
                  ))}
            </group>
          );
        })}

        {selected && entered && (
          <Interior
            b={selected}
            center={site.center}
            floors={floors}
            roomId={roomId}
            onRoom={(id) => setRoomId((cur) => (cur === id ? null : id))}
          />
        )}

        {alerts
          .filter((a) => a.severity !== 'ok')
          .slice(0, 12)
          .map((a) => {
            const b = site.buildings.find((x) => x.id === a.buildingId);
            if (!b) return null;
            const c = centroidMeters(site.center, b.polygon);
            const h = Math.max(1.2, b.height);
            const color = a.severity === 'critical' ? '#FF4D5E' : '#FFB020';
            return (
              <group key={a.id} position={[c.x, h + 18, c.z]}>
                <mesh>
                  <octahedronGeometry args={[2.6]} />
                  <meshBasicMaterial color={color} transparent opacity={0.9} />
                </mesh>
                <pointLight intensity={0.5} distance={20} color={color} />
              </group>
            );
          })}

        <OrbitControls
          makeDefault
          enableDamping
          autoRotate={autoOrbit && !selectedId}
          autoRotateSpeed={0.7}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={entered ? 10 : 8}
          maxDistance={entered ? selSize * 1.6 + 80 : 1400}
        />
        <CameraRig target={cam.target} pos={cam.pos} animKey={animKey} />
      </Canvas>

      {!selectedId && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a]/85 px-3 py-1 font-hud text-[10px] uppercase tracking-wider text-[#8a8a8a] backdrop-blur">
            Drag to orbit · scroll to zoom · click a building to enter
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute bottom-24 left-3 top-24 z-30 flex w-[19rem] flex-col overflow-hidden rounded border border-[#1a1a1a] bg-[#050506]/95 backdrop-blur">
          <div className="border-b border-[#1a1a1a] p-2.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8a8a8a]">
              <span>Campus</span>
              <span>/</span>
              <span className="text-[#fafafa]">{selected.shortName}</span>
              <span className={`ml-auto inline-block h-2 w-2 rounded-full ${dot(worstSeverity(alerts, selected.id))}`} />
            </div>
            <h2 className="mt-1 font-display text-sm font-bold text-[#fafafa]">{selected.name}</h2>
            <div className="mt-1 flex gap-2 text-[10px] text-[#8a8a8a]">
              <span>{Math.round(liveFor(selected).occupancy)} people</span>
              <span>PM2.5 {Math.round(liveFor(selected).pm25)}</span>
              <span>{Math.round(liveFor(selected).energyKw)} kW</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {!entered ? (
                <button
                  onClick={() => {
                    setEntered(true);
                    setRoomId(null);
                  }}
                  className="flex-1 rounded bg-[#00E5C3] px-2 py-1 font-hud text-[10px] font-bold uppercase tracking-wider text-black hover:brightness-110"
                >
                  Enter building
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEntered(false);
                    setRoomId(null);
                  }}
                  className="flex-1 rounded border border-[#2a2a2a] px-2 py-1 font-hud text-[10px] font-bold uppercase tracking-wider text-[#fafafa] hover:bg-[#1a1a1a]"
                >
                  Exit to campus
                </button>
              )}
              <button
                onClick={deselect}
                className="rounded border border-[#2a2a2a] px-2 py-1 font-hud text-[10px] uppercase tracking-wider text-[#8a8a8a] hover:text-[#fafafa]"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {!entered && (
              <p className="text-[11px] leading-snug text-[#8a8a8a]">
                {floors.reduce((a, f) => a + f.rooms.length, 0)} rooms across {floors.length}{' '}
                {floors.length === 1 ? 'level' : 'levels'}. Enter to walk the floors and inspect every room element.
              </p>
            )}
            {entered &&
              floors.map((f) => (
                <div key={f.floor} className="mb-2">
                  <div className="mb-1 font-hud text-[10px] font-bold uppercase tracking-wider text-[#8a8a8a]">
                    {f.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {f.rooms.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRoomId((cur) => (cur === r.id ? null : r.id))}
                        className={`rounded border px-1.5 py-1 text-left ${
                          roomId === r.id ? 'border-[#00E5C3]' : 'border-[#1a1a1a]'
                        } bg-[#0a0a0a] hover:border-[#3a3a3a]`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot(r.status)}`} />
                          <span className="truncate text-[10px] font-semibold text-[#fafafa]">{r.name}</span>
                        </div>
                        <div className="mt-0.5 text-[9px] text-[#8a8a8a]">
                          {r.occupancy}/{r.capacity} · {r.tempC.toFixed(1)}°C
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            {entered && selectedRoom && (
              <div className="mt-1 rounded border border-[#00E5C3]/40 bg-[#00E5C3]/5 p-2">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot(selectedRoom.status)}`} />
                  <span className="text-[11px] font-bold text-[#fafafa]">{selectedRoom.name}</span>
                </div>
                <div className="space-y-1">
                  {selectedRoom.elements.map((e) => (
                    <div key={e.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot(e.status)}`} />
                      <span className="text-[#8a8a8a]">{e.label}</span>
                      <span className="ml-auto text-right text-[#fafafa]">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.35); opacity: 0.9; }
          80%, 100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default memo(Campus3D);
