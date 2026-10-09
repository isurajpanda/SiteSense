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

interface Campus3DProps {
  onBuildingClick: (buildingId: string) => void;
  focusBuildingId: string | null;
  focusTrigger: number;
  autoOrbit: boolean;
}

/* ---------------------------------- rig ---------------------------------- */

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

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

/* --------------------------------- pieces --------------------------------- */

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
  const geom = useMemo(() => {
    const pts = b.polygon.map((p) => toMeters(center, p));
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, pts[0].z);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].z);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1.2, b.height), bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id]);

  useEffect(() => () => geom.dispose(), [geom]);

  const c = useMemo(() => centroidMeters(center, b.polygon), [center, b.polygon]);
  const h = Math.max(1.2, b.height);
  return (
    <group>
      <mesh
        geometry={geom}
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial
          color={STATUS_COLOR[status]}
          transparent={entered && selected}
          opacity={entered && selected ? 0.1 : dimmed ? 0.35 : 0.75}
          roughness={0.6}
          metalness={0.25}
          depthWrite={!(entered && selected)}
        />
        {selected && <Edges scale={1} threshold={15} color="#fafafa" />}
      </mesh>
      {!entered && (
        <Html position={[c.x, h + 10, c.z]} center distanceFactor={500} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="rounded border border-[#1a1a1a] bg-black/70 px-1.5 py-0.5 text-center font-hud text-[9px] font-bold uppercase tracking-wider"
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
    <group position={[(a.x + x2) / 2, 0.15, (a.z + z2) / 2]} rotation-y={-ang}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[len, width]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
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
  const pts = useMemo(() => b.polygon.map((p) => toMeters(center, p)), [b.polygon, center]);
  const bbox = useMemo(() => {
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }, [pts]);
  const bw = bbox.maxX - bbox.minX;
  const bd = bbox.maxZ - bbox.minZ;
  const n = floors.length;
  const floorH = Math.max(4, Math.max(3, b.height) / n);

  return (
    <group>
      {floors.map((f, fi) => {
        const cols = Math.ceil(Math.sqrt(f.rooms.length));
        const rows = Math.ceil(f.rooms.length / cols);
        const cw = bw / cols;
        const cd = bd / rows;
        const y = fi * floorH;
        return (
          <group key={f.floor}>
            <mesh position={[(bbox.minX + bbox.maxX) / 2, y, (bbox.minZ + bbox.maxZ) / 2]}>
              <boxGeometry args={[bw, 0.5, bd]} />
              <meshStandardMaterial color="#1c1c22" roughness={0.8} />
            </mesh>
            {f.rooms.map((r, ri) => {
              const col = ri % cols;
              const row = Math.floor(ri / cols);
              const cx = bbox.minX + cw * (col + 0.5);
              const cz = bbox.minZ + cd * (row + 0.5);
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

/* --------------------------------- main --------------------------------- */

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const cam = selected
    ? entered
      ? {
          target: [selCenter.x, selH * 0.5, selCenter.z] as [number, number, number],
          pos: [selCenter.x + selSize * 0.9, selH * 0.6 + 14, selCenter.z + selSize * 0.9 + 18] as [number, number, number],
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
        dpr={[1, 1.75]}
        camera={{ position: [310, 330, 310], fov: 50, near: 1, far: 6000 }}
        onPointerMissed={() => {
          if (selectedId) deselect();
        }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 700, 1800]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#3a3a44', '#000000', 0.5]} />
        <directionalLight position={[250, 350, 150]} intensity={1.4} />

        <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
          <planeGeometry args={[3000, 3000]} />
          <meshStandardMaterial color="#030304" roughness={1} />
        </mesh>
        <gridHelper args={[2000, 50, '#1c1c22', '#0b0b0e']} position={[0, 0, 0]} />

        {/* roads (fictional estate network, congestion-tinted) */}
        {site.roads.map((r) => {
          const v = congestion[r.id] ?? 0.3;
          const color = congestionColor(v);
          const pts = r.path.map((p) => toMeters(site.center, p));
          return (
            <group key={r.id}>
              {pts.slice(0, -1).map((a, i) => (
                <RoadSegment key={i} a={a} x2={pts[i + 1].x} z2={pts[i + 1].z} color={color} width={7} />
              ))}
            </group>
          );
        })}

        {/* buildings */}
        {site.buildings.map((b) => (
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

        {/* gates */}
        {site.gates.map((g) => {
          const m = toMeters(site.center, g.position);
          return (
            <mesh key={g.id} position={[m.x, 3, m.z]}>
              <coneGeometry args={[4, 7, 4]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
          );
        })}

        {/* bins */}
        {layers.waste &&
          site.bins.map((bin) => {
            const m = toMeters(site.center, bin.position);
            const fill = binStates[bin.id] ?? 0;
            return (
              <mesh key={bin.id} position={[m.x, 2, m.z]}>
                <cylinderGeometry args={[1.6, 1.6, 4, 10]} />
                <meshBasicMaterial color={fill > 85 ? '#FF4D5E' : fill > 70 ? '#FFB020' : '#00E5C3'} />
              </mesh>
            );
          })}

        {/* live data markers */}
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
                  <meshBasicMaterial color={pm25 > 120 ? '#FF4D5E' : pm25 > 60 ? '#FFB020' : '#00E5C3'} />
                </mesh>
              )}
              {layers.occupancy && (
                <mesh position={[c.x + 7, h + 9, c.z]}>
                  <sphereGeometry args={[2.2, 12, 12]} />
                  <meshBasicMaterial color={occFrac > 1 ? '#B91C1C' : occFrac > 0.85 ? '#FF4D5E' : occFrac > 0.5 ? '#FFB020' : '#00E5C3'} />
                </mesh>
              )}
              {layers.energy && (
                <mesh position={[c.x - 7, h + 9, c.z]}>
                  <sphereGeometry args={[2.2, 12, 12]} />
                  <meshBasicMaterial color={kw > 150 ? '#7DD3FC' : kw > 50 ? '#38BDF8' : '#1D4ED8'} />
                </mesh>
              )}
              {layers.reports &&
                reports
                  .filter((r) => r.buildingId === b.id && r.status !== 'resolved')
                  .slice(0, 2)
                  .map((r, i) => (
                    <mesh key={r.id} position={[c.x - 4 + i * 8, h + 6, c.z + 6]}>
                      <octahedronGeometry args={[2]} />
                      <meshBasicMaterial color="#FF4D5E" />
                    </mesh>
                  ))}
            </group>
          );
        })}

        {/* interior of entered building */}
        {selected && entered && (
          <Interior
            b={selected}
            center={site.center}
            floors={floors}
            roomId={roomId}
            onRoom={(id) => setRoomId((cur) => (cur === id ? null : id))}
          />
        )}

        {/* alert beacons */}
        {alerts
          .filter((a) => a.severity !== 'ok')
          .slice(0, 12)
          .map((a) => {
            const b = site.buildings.find((x) => x.id === a.buildingId);
            if (!b) return null;
            const c = centroidMeters(site.center, b.polygon);
            const h = Math.max(1.2, b.height);
            return (
              <mesh key={a.id} position={[c.x, h + 18, c.z]}>
                <octahedronGeometry args={[2.6]} />
                <meshBasicMaterial color={a.severity === 'critical' ? '#FF4D5E' : '#FFB020'} />
              </mesh>
            );
          })}

        <OrbitControls
          makeDefault
          enableDamping
          autoRotate={autoOrbit && !selectedId}
          autoRotateSpeed={0.7}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={8}
          maxDistance={1400}
        />
        <CameraRig target={cam.target} pos={cam.pos} animKey={animKey} />
      </Canvas>

      {/* hint */}
      {!selectedId && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a]/85 px-3 py-1 font-hud text-[10px] uppercase tracking-wider text-[#8a8a8a] backdrop-blur">
            Drag to orbit · scroll to zoom · click a building to enter
          </div>
        </div>
      )}

      {/* interior panel */}
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
