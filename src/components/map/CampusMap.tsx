import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import Map, { FullscreenControl, Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Alert, ReportCategory, Severity } from '@/types/domain';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { useMapLayers } from './useMapLayers';
import { pointToGeoJSON } from '@/lib/geo/projection';

const INITIAL_VIEW = { zoom: 15.5, pitch: 55, bearing: -17 };

const STATUS_COLORS: Record<Severity, string> = {
  ok: '#00E5C3',
  warning: '#FFB020',
  critical: '#FF4D5E',
};

const CATEGORY_COLORS: Record<ReportCategory, string> = {
  waste: '#FFB020',
  water: '#38BDF8',
  light: '#FDE047',
  air: '#A78BFA',
  safety: '#FF4D5E',
  road: '#FB923C',
  parking: '#7ED957',
  other: '#8a8a8a',
};

const CONGESTION_RAMP: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'congestion'],
  0,
  '#00E5C3',
  0.55,
  '#FFB020',
  0.8,
  '#FF4D5E',
  1,
  '#B91C1C',
];

interface CampusMapProps {
  onBuildingClick: (buildingId: string) => void;
  focusBuildingId: string | null;
  focusTrigger: number;
  autoOrbit: boolean;
}

function CampusMap({ onBuildingClick, focusBuildingId, focusTrigger, autoOrbit }: CampusMapProps) {
  const siteId = useSettingsStore((s) => s.siteId);
  const layers = useSettingsStore((s) => s.layers);
  const site = getSite(siteId);
  const { buildings, roads, bins, reports, centroids } = useMapLayers();
  const alerts = useSimStore((s) => s.alerts);
  const history = useSimStore((s) => s.history);
  const congestion = useSimStore((s) => s.congestion);

  const mapRef = useRef<MapRef>(null);

  const resetView = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setCenter([site.center.lng, site.center.lat]);
    m.setZoom(INITIAL_VIEW.zoom);
    m.setPitch(INITIAL_VIEW.pitch);
    m.setBearing(INITIAL_VIEW.bearing);
  }, [site]);

  useEffect(() => {
    if (!focusBuildingId) return;
    const c = centroids[focusBuildingId];
    const m = mapRef.current;
    if (!c || !m) return;
    m.flyTo({ center: [c.lng, c.lat], zoom: 17, pitch: 55, duration: 1600 });
  }, [focusBuildingId, focusTrigger, centroids]);

  useEffect(() => {
    if (!autoOrbit) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      const m = mapRef.current;
      if (m) m.rotateTo((m.getBearing() + 0.05) % 360);
    }, 50);
    return () => window.clearInterval(id);
  }, [autoOrbit]);

  const alertMarkers = useMemo(() => {
    const byBuilding: Record<string, Alert> = {};
    for (const a of alerts) {
      if (a.severity === 'ok' || !centroids[a.buildingId]) continue;
      const prev = byBuilding[a.buildingId];
      if (!prev || (prev.severity === 'warning' && a.severity === 'critical')) {
        byBuilding[a.buildingId] = a;
      }
    }
    return Object.values(byBuilding);
  }, [alerts, centroids]);

  const buildingData = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: site.buildings.map((b) => {
        const pmSeries = history[`${b.id}:pm25`];
        const occSeries = history[`${b.id}:occupancy`];
        const kwSeries = history[`${b.id}:energy`];
        const pm25 = pmSeries && pmSeries.length > 0 ? pmSeries[pmSeries.length - 1].value : 0;
        const occ = occSeries && occSeries.length > 0 ? occSeries[occSeries.length - 1].value : 0;
        const kw = kwSeries && kwSeries.length > 0 ? kwSeries[kwSeries.length - 1].value : 0;
        return {
          type: 'Feature',
          geometry: pointToGeoJSON(centroids[b.id]),
          properties: {
            id: b.id,
            pm25,
            occ,
            kw,
            occFrac: b.capacity > 0 ? occ / b.capacity : 0,
          },
        };
      }),
    };
  }, [site, history, centroids]);

  const avgCongestion = useMemo(() => {
    const vals = Object.values(congestion);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.3;
  }, [congestion]);

  const gates = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: site.gates.map((g) => ({
        type: 'Feature',
        geometry: pointToGeoJSON(g.position),
        properties: { id: g.id, name: g.name, congestion: avgCongestion },
      })),
    };
  }, [site, avgCongestion]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: site.center.lng,
          latitude: site.center.lat,
          zoom: INITIAL_VIEW.zoom,
          pitch: INITIAL_VIEW.pitch,
          bearing: INITIAL_VIEW.bearing,
        }}
        mapStyle={site.mapStyle}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />

        <Source id="buildings" type="geojson" data={buildings}>
          <Layer
            id="buildings-extrusion"
            type="fill-extrusion"
            paint={{
              'fill-extrusion-color': [
                'match',
                ['get', 'status'],
                'critical',
                '#FF4D5E',
                'warning',
                '#FFB020',
                '#00E5C3',
              ],
              'fill-extrusion-opacity': 0.55,
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
            }}
          />
          <Layer
            id="buildings-outline"
            type="line"
            paint={{ 'line-color': 'rgba(10, 20, 36, 0.6)', 'line-width': 1 }}
          />
        </Source>

        <Source id="roads" type="geojson" data={roads}>
          <Layer
            id="roads-line"
            type="line"
            paint={{
              'line-color': CONGESTION_RAMP,
              'line-width': 4,
              'line-opacity': 0.9,
            }}
          />
        </Source>

        {layers.traffic && (
          <Source id="gates" type="geojson" data={gates}>
            <Layer
              id="gates-circles"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': CONGESTION_RAMP,
                'circle-opacity': 0.9,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {layers.air && (
          <Source id="air" type="geojson" data={buildingData}>
            <Layer
              id="air-circles"
              type="circle"
              paint={{
                'circle-radius': 12,
                'circle-color': [
                  'step',
                  ['get', 'pm25'],
                  30,
                  '#00E5C3',
                  60,
                  '#A3E635',
                  90,
                  '#FFB020',
                  120,
                  '#FB923C',
                  250,
                  '#FF4D5E',
                  '#B91C1C',
                ],
                'circle-opacity': 0.85,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {layers.occupancy && (
          <Source id="occupancy" type="geojson" data={buildingData}>
            <Layer
              id="occupancy-circles"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': [
                  'step',
                  ['get', 'occFrac'],
                  0.5,
                  '#00E5C3',
                  0.85,
                  '#FFB020',
                  1,
                  '#FF4D5E',
                  '#B91C1C',
                ],
                'circle-opacity': 0.85,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {layers.waste && (
          <Source id="waste" type="geojson" data={bins}>
            <Layer
              id="waste-circles"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'fill'], 0, 6, 50, 10, 100, 16],
                'circle-color': ['step', ['get', 'fill'], 70, '#00E5C3', 85, '#FFB020', '#FF4D5E'],
                'circle-opacity': 0.9,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {layers.reports && (
          <Source id="reports" type="geojson" data={reports}>
            <Layer
              id="reports-circles"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': [
                  'match',
                  ['get', 'category'],
                  'waste',
                  CATEGORY_COLORS.waste,
                  'water',
                  CATEGORY_COLORS.water,
                  'light',
                  CATEGORY_COLORS.light,
                  'air',
                  CATEGORY_COLORS.air,
                  'safety',
                  CATEGORY_COLORS.safety,
                  'road',
                  CATEGORY_COLORS.road,
                  'parking',
                  CATEGORY_COLORS.parking,
                  CATEGORY_COLORS.other,
                ],
                'circle-opacity': 0.95,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {layers.energy && (
          <Source id="energy" type="geojson" data={buildingData}>
            <Layer
              id="energy-circles"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'kw'],
                  0,
                  '#172554',
                  50,
                  '#1D4ED8',
                  150,
                  '#38BDF8',
                  300,
                  '#7DD3FC',
                ],
                'circle-opacity': 0.85,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {alertMarkers.map((a) => {
          const c = centroids[a.buildingId];
          if (!c) return null;
          return (
            <Marker
              key={a.id}
              longitude={c.lng}
              latitude={c.lat}
              anchor="center"
              onClick={() => onBuildingClick(a.buildingId)}
            >
              <div className="alert-marker" style={{ '--mc': STATUS_COLORS[a.severity] } as CSSProperties}>
                <div className="animate-pulse-ring alert-marker-ring" />
                <div className="animate-pulse-ring alert-marker-ring" style={{ animationDelay: '1.2s' }} />
                <div className="alert-marker-dot" />
              </div>
            </Marker>
          );
        })}
      </Map>

      <button
        onClick={resetView}
        className="absolute right-2.5 z-10 rounded border border-[#1a1a1a] bg-[#0a0a0a]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8a8a] backdrop-blur-md transition-colors hover:text-[#fafafa]"
        style={{ top: 104 }}
      >
        Reset view
      </button>

      <div
        className="pointer-events-none absolute bottom-1 right-1 z-10 max-w-[65%] text-right text-[9px] leading-tight text-slate-400/80"
        dangerouslySetInnerHTML={{ __html: site.mapAttribution }}
      />

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.35); opacity: 0.9; }
          80%, 100% { transform: scale(2.8); opacity: 0; }
        }
        .animate-pulse-ring { animation: pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite; }
        .alert-marker { position: relative; width: 16px; height: 16px; cursor: pointer; }
        .alert-marker-dot {
          position: absolute;
          inset: 4px;
          border-radius: 9999px;
          background: var(--mc);
          box-shadow: 0 0 8px var(--mc);
        }
        .alert-marker-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid var(--mc);
        }
      `}</style>
    </div>
  );
}

export default memo(CampusMap);
