import type { LngLat, MapAdapter, MapAdapterOptions, MapMarker, MapPolygonLayer, MapPolylineLayer } from './map-adapter.interface';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class MockMapAdapter implements MapAdapter {
  private container?: HTMLElement;
  private svg?: SVGSVGElement;
  private mapClick?: (point: LngLat) => void;
  private polygonClick?: (layer: MapPolygonLayer) => void;
  private center: LngLat = { lng: 118.1, lat: 36.7 };
  private zoom = 13;

  async init(container: HTMLElement, options: MapAdapterOptions = {}) {
    this.container = container;
    this.center = options.center ?? this.center;
    this.zoom = options.zoom ?? this.zoom;
    container.innerHTML = '';
    container.classList.add('real-map-container', 'mock-map-provider');
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 1000 720');
    this.svg.setAttribute('class', 'mock-map-svg');
    this.svg.innerHTML = `
      <defs>
        <pattern id="mapGrid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="#dbeafe" stroke-width="2"/>
        </pattern>
      </defs>
      <rect width="1000" height="720" fill="#eef8f0"/>
      <rect width="1000" height="720" fill="url(#mapGrid)" opacity=".7"/>
      <path d="M-10 590 C210 410 390 500 620 260 C760 120 840 110 1010 80" stroke="#7dd3fc" stroke-width="34" fill="none" opacity=".45"/>
      <text x="24" y="42" fill="#64748b" font-size="24">Mock GIS Map · SDK adapter ready</text>
    `;
    this.svg.addEventListener('click', (event) => {
      if (!this.svg || !this.mapClick) return;
      const rect = this.svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 1000;
      const y = ((event.clientY - rect.top) / rect.height) * 720;
      this.mapClick(this.unproject(x, y));
    });
    container.appendChild(this.svg);
  }

  setCenter(lng: number, lat: number) {
    this.center = { lng, lat };
  }

  setZoom(zoom: number) {
    this.zoom = zoom;
  }

  renderPolygon(layer: MapPolygonLayer) {
    if (!this.svg || layer.coordinates.length < 3) return;
    this.clearLayer(layer.id);
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('data-layer-id', layer.id);
    polygon.setAttribute('points', layer.coordinates.map((point) => this.project(point).join(',')).join(' '));
    polygon.setAttribute('fill', String(layer.style?.fill ?? '#16a34a55'));
    polygon.setAttribute('stroke', String(layer.style?.stroke ?? '#16a34a'));
    polygon.setAttribute('stroke-width', String(layer.style?.strokeWidth ?? 4));
    polygon.addEventListener('click', (event) => {
      event.stopPropagation();
      this.polygonClick?.(layer);
    });
    this.svg.appendChild(polygon);
  }

  renderPolyline(layer: MapPolylineLayer) {
    if (!this.svg || layer.coordinates.length < 2) return;
    this.clearLayer(layer.id);
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('data-layer-id', layer.id);
    polyline.setAttribute('points', layer.coordinates.map((point) => this.project(point).join(',')).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', String(layer.style?.stroke ?? '#2563eb'));
    polyline.setAttribute('stroke-width', String(layer.style?.strokeWidth ?? 5));
    polyline.setAttribute('stroke-dasharray', String(layer.style?.dasharray ?? ''));
    this.svg.appendChild(polyline);
  }

  renderMarker(marker: MapMarker) {
    if (!this.svg) return;
    this.clearLayer(marker.id);
    const [x, y] = this.project(marker);
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-layer-id', marker.id);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '11');
    circle.setAttribute('fill', marker.type === 'PUMP' ? '#0f172a' : marker.type === 'VALVE' ? '#f97316' : '#2563eb');
    group.appendChild(circle);
    if (marker.label) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(x + 14));
      text.setAttribute('y', String(y + 5));
      text.setAttribute('fill', '#0f172a');
      text.setAttribute('font-size', '18');
      text.textContent = marker.label;
      group.appendChild(text);
    }
    this.svg.appendChild(group);
  }

  clearLayer(layerId: string) {
    this.svg?.querySelectorAll(`[data-layer-id="${CSS.escape(layerId)}"]`).forEach((node) => node.remove());
  }

  onMapClick(callback: (point: LngLat) => void) {
    this.mapClick = callback;
  }

  onPolygonClick(callback: (layer: MapPolygonLayer) => void) {
    this.polygonClick = callback;
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
    this.svg = undefined;
  }

  private project(point: LngLat): [number, number] {
    const scale = 90000 / Math.max(1, this.zoom);
    const x = 500 + (point.lng - this.center.lng) * scale;
    const y = 360 - (point.lat - this.center.lat) * scale;
    return [Math.max(20, Math.min(980, x)), Math.max(20, Math.min(700, y))];
  }

  private unproject(x: number, y: number): LngLat {
    const scale = 90000 / Math.max(1, this.zoom);
    return { lng: this.center.lng + (x - 500) / scale, lat: this.center.lat - (y - 360) / scale };
  }
}
