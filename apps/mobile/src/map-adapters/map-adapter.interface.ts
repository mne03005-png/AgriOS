export type LngLat = { lng: number; lat: number };

export type MapAdapterOptions = {
  center?: LngLat;
  zoom?: number;
};

export type MapPolygonLayer = {
  id: string;
  type?: string;
  coordinates: LngLat[];
  style?: Record<string, string | number>;
  data?: unknown;
};

export type MapPolylineLayer = {
  id: string;
  type?: string;
  coordinates: LngLat[];
  style?: Record<string, string | number>;
  data?: unknown;
};

export type MapMarker = {
  id: string;
  type?: string;
  lng: number;
  lat: number;
  label?: string;
  data?: unknown;
};

export interface MapAdapter {
  init(container: HTMLElement, options?: MapAdapterOptions): Promise<void>;
  setCenter(lng: number, lat: number): void;
  setZoom(zoom: number): void;
  renderPolygon(layer: MapPolygonLayer): void;
  renderPolyline(layer: MapPolylineLayer): void;
  renderMarker(marker: MapMarker): void;
  clearLayer(layerId: string): void;
  onMapClick(callback: (point: LngLat) => void): void;
  onPolygonClick(callback: (layer: MapPolygonLayer) => void): void;
  destroy(): void;
}
