import { useMemo } from 'react';
import type { Alert, LngLat, Severity } from '@/types/domain';
import { getSite } from '@/config/sites';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { useReportStore } from '@/store/useReportStore';
import { centroid, lineToGeoJSON, pointToGeoJSON, polygonToGeoJSON } from '@/lib/geo/projection';

export interface MapLayers {
  buildings: GeoJSON.FeatureCollection;
  roads: GeoJSON.FeatureCollection;
  bins: GeoJSON.FeatureCollection;
  reports: GeoJSON.FeatureCollection;
  centroids: Record<string, LngLat>;
}

function worstSeverity(alerts: Alert[], buildingId: string): Severity {
  let worst: Severity = 'ok';
  for (const a of alerts) {
    if (a.buildingId !== buildingId) continue;
    if (a.severity === 'critical') return 'critical';
    if (a.severity === 'warning') worst = 'warning';
  }
  return worst;
}

export function useMapLayers(): MapLayers {
  const siteId = useSettingsStore((s) => s.siteId);
  const alerts = useSimStore((s) => s.alerts);
  const congestion = useSimStore((s) => s.congestion);
  const binStates = useSimStore((s) => s.binStates);
  const reports = useReportStore((s) => s.reports);

  const site = getSite(siteId);

  const centroids = useMemo(() => {
    const out: Record<string, LngLat> = {};
    for (const b of site.buildings) out[b.id] = centroid(b.polygon);
    return out;
  }, [site]);

  const buildings = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: site.buildings.map((b) => ({
        type: 'Feature',
        geometry: polygonToGeoJSON(b.polygon),
        properties: {
          id: b.id,
          name: b.name,
          shortName: b.shortName,
          status: worstSeverity(alerts, b.id),
          height: b.height,
        },
      })),
    };
  }, [site, alerts]);

  const roads = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: site.roads.map((r) => ({
        type: 'Feature',
        geometry: lineToGeoJSON(r.path),
        properties: { id: r.id, name: r.name, congestion: congestion[r.id] ?? 0.3 },
      })),
    };
  }, [site, congestion]);

  const bins = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: site.bins.map((bin) => ({
        type: 'Feature',
        geometry: pointToGeoJSON(bin.position),
        properties: { id: bin.id, label: bin.label, fill: binStates[bin.id] ?? 0 },
      })),
    };
  }, [site, binStates]);

  const reportsFc = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: reports.flatMap((r) => {
        const c = centroids[r.buildingId];
        if (!c) return [];
        return [
          {
            type: 'Feature',
            geometry: pointToGeoJSON(c),
            properties: { id: r.id, category: r.category, buildingId: r.buildingId },
          },
        ];
      }),
    };
  }, [reports, centroids]);

  return { buildings, roads, bins, reports: reportsFc, centroids };
}
