import type { LngLat } from '@/types/domain';

const EARTH_R = 6378137;
const M_PER_DEG_LAT = 111320;

export function metersToLngLat(origin: LngLat, dx: number, dy: number): LngLat {
  const lat = origin.lat + dy / M_PER_DEG_LAT;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return { lng: origin.lng + dx / mPerDegLng, lat };
}

export function polygonFromRect(
  origin: LngLat,
  dx: number,
  dy: number,
  w: number,
  h: number,
  rotationDeg = 0,
): LngLat[] {
  const corners: Array<[number, number]> = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return corners.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return metersToLngLat(origin, dx + rx, dy + ry);
  });
}

export function centroid(points: LngLat[]): LngLat {
  const n = points.length;
  const sum = points.reduce((acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }), {
    lng: 0,
    lat: 0,
  });
  return { lng: sum.lng / n, lat: sum.lat / n };
}

export function polygonToGeoJSON(points: LngLat[]): GeoJSON.Polygon {
  const ring = points.map((p) => [p.lng, p.lat] as [number, number]);
  if (ring.length > 0) ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

export function lineToGeoJSON(points: LngLat[]): GeoJSON.LineString {
  return { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat] as [number, number]) };
}

export function pointToGeoJSON(p: LngLat): GeoJSON.Point {
  return { type: 'Point', coordinates: [p.lng, p.lat] };
}

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}
