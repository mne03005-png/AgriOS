import type { LngLat, MapAdapter, MapAdapterOptions, MapMarker, MapPolygonLayer, MapPolylineLayer } from './map-adapter.interface';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../services/coordinate-transform';

declare global {
  interface Window {
    AMap?: any;
  }
}

// PROD-USABILITY-1: this is a real AMap JS API integration, not a MockMapAdapter alias -- it
// loads the actual AMap SDK and renders a real geographic basemap. It only ever runs when
// map-adapters/index.ts's factory has already confirmed a VITE_AMAP_KEY is configured; without
// one, AgriOS falls back to MockMapAdapter's honest schematic renderer rather than this class
// ever being reachable. See docs on AMAP_CREDENTIALS_AVAILABLE in the PROD-USABILITY-1 report
// for exactly what is still needed to activate this path in production.
//
// Coordinate system: every coordinate AgriOS's own stores hand to this adapter is WGS84 (see
// services/coordinate-transform.ts's header comment for why). This file converts WGS84 -> GCJ-02
// on every write into AMap, and GCJ-02 -> WGS84 on every value AMap hands back out (click events),
// so nothing outside this file ever has to think about the conversion.
let loaderPromise: Promise<any> | null = null;

function loadAmapSdk(key: string): Promise<any> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => (window.AMap ? resolve(window.AMap) : reject(new Error('AMap SDK loaded but window.AMap is missing')));
    script.onerror = () => reject(new Error('Failed to load AMap JS SDK script'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export class AMapAdapter implements MapAdapter {
  private map: any;
  private overlays = new Map<string, any>();
  private mapClick?: (point: LngLat) => void;
  private polygonClick?: (layer: MapPolygonLayer) => void;

  async init(container: HTMLElement, options: MapAdapterOptions = {}) {
    const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
    if (!key) throw new Error('AMapAdapter.init() called without VITE_AMAP_KEY configured');
    const AMap = await loadAmapSdk(key);
    const center = options.center ? wgs84ToGcj02(options.center.lng, options.center.lat) : wgs84ToGcj02(118.1, 36.7);
    this.map = new AMap.Map(container, {
      center: [center.lng, center.lat],
      zoom: options.zoom ?? 13,
      viewMode: '2D'
    });
    this.map.addControl(new AMap.Scale());
    this.map.addControl(new AMap.ToolBar({ position: 'RB' }));
    this.map.on('click', (event: any) => {
      if (!this.mapClick) return;
      const wgs = gcj02ToWgs84(event.lnglat.getLng(), event.lnglat.getLat());
      this.mapClick(wgs);
    });
  }

  setCenter(lng: number, lat: number) {
    const gcj = wgs84ToGcj02(lng, lat);
    this.map?.setCenter([gcj.lng, gcj.lat]);
  }

  setZoom(zoom: number) {
    this.map?.setZoom(zoom);
  }

  renderPolygon(layer: MapPolygonLayer) {
    if (!this.map || layer.coordinates.length < 3) return;
    this.clearLayer(layer.id);
    const path = layer.coordinates.map((point) => {
      const gcj = wgs84ToGcj02(point.lng, point.lat);
      return [gcj.lng, gcj.lat];
    });
    const polygon = new window.AMap.Polygon({
      path,
      strokeColor: String(layer.style?.stroke ?? '#16a34a'),
      strokeWeight: Number(layer.style?.strokeWidth ?? 2),
      fillColor: String(layer.style?.fill ?? '#16a34a'),
      fillOpacity: 0.35
    });
    polygon.on('click', () => this.polygonClick?.(layer));
    this.map.add(polygon);
    this.overlays.set(layer.id, polygon);
    this.map.setFitView(undefined, false, [40, 40, 40, 40]);
  }

  renderPolyline(layer: MapPolylineLayer) {
    if (!this.map || layer.coordinates.length < 2) return;
    this.clearLayer(layer.id);
    const path = layer.coordinates.map((point) => {
      const gcj = wgs84ToGcj02(point.lng, point.lat);
      return [gcj.lng, gcj.lat];
    });
    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: String(layer.style?.stroke ?? '#2563eb'),
      strokeWeight: Number(layer.style?.strokeWidth ?? 3),
      strokeStyle: layer.style?.dasharray ? 'dashed' : 'solid'
    });
    this.map.add(polyline);
    this.overlays.set(layer.id, polyline);
  }

  renderMarker(marker: MapMarker) {
    if (!this.map) return;
    this.clearLayer(marker.id);
    const gcj = wgs84ToGcj02(marker.lng, marker.lat);
    const color = marker.type === 'PUMP' ? '#0f172a' : marker.type === 'VALVE' ? '#f97316' : '#2563eb';
    const point = new window.AMap.Marker({
      position: [gcj.lng, gcj.lat],
      title: marker.label,
      content: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2);"></div>`,
      label: marker.label ? { content: marker.label, direction: 'right' } : undefined
    });
    this.map.add(point);
    this.overlays.set(marker.id, point);
  }

  clearLayer(layerId: string) {
    const overlay = this.overlays.get(layerId);
    if (overlay) {
      this.map?.remove(overlay);
      this.overlays.delete(layerId);
    }
  }

  onMapClick(callback: (point: LngLat) => void) {
    this.mapClick = callback;
  }

  onPolygonClick(callback: (layer: MapPolygonLayer) => void) {
    this.polygonClick = callback;
  }

  destroy() {
    this.overlays.clear();
    this.map?.destroy();
    this.map = undefined;
  }
}
