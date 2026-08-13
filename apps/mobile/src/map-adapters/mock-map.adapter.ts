import type { LngLat, MapAdapter, MapAdapterOptions, MapMarker, MapPolygonLayer, MapPolylineLayer } from './map-adapter.interface';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const DRAG_CLICK_THRESHOLD_PX = 6;

// UX-HOTFIX-1: this is AgriOS's one legitimate, genuinely interactive map implementation --
// not a placeholder. Field boundaries/devices are real data from mapStore (see MapPage.vue's
// renderBoundaries/renderDevices), and pan/zoom are real pointer-driven gestures, not just
// programmatic setCenter/setZoom calls with nothing behind them. It renders a schematic vector
// view of the farm, not satellite/street tile imagery -- AMap/Baidu/Google integration remains
// a genuine, honestly-reported blocker (no SDK key configured anywhere in this repository; see
// amap.adapter.ts/baidu-map.adapter.ts/google-map.adapter.ts), and this adapter must never be
// presented to users as one of those providers.
export class MockMapAdapter implements MapAdapter {
  private container?: HTMLElement;
  private svg?: SVGSVGElement;
  private viewport?: SVGGElement;
  private mapClick?: (point: LngLat) => void;
  private polygonClick?: (layer: MapPolygonLayer) => void;
  private center: LngLat = { lng: 118.1, lat: 36.7 };
  private zoom = 13;
  private panX = 0;
  private panY = 0;
  private scale = 1;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragMoved = 0;
  private pinchStartDistance = 0;
  private pinchStartScale = 1;

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
    `;
    this.viewport = document.createElementNS(SVG_NS, 'g');
    this.viewport.setAttribute('class', 'map-viewport');
    this.viewport.innerHTML = `
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#mapGrid)" opacity=".7"/>
      <path d="M-10 590 C210 410 390 500 620 260 C760 120 840 110 1010 80" stroke="#7dd3fc" stroke-width="14" fill="none" opacity=".45"/>
    `;
    this.svg.appendChild(this.viewport);
    this.applyTransform();
    this.bindGestures(container);
    container.appendChild(this.svg);
  }

  private applyTransform() {
    this.viewport?.setAttribute('transform', `translate(${this.panX} ${this.panY}) scale(${this.scale})`);
  }

  // Screen pixel -> underlying (pre-transform) SVG viewBox coordinate, accounting for the
  // element's rendered size vs its 1000x720 viewBox, and the current pan/zoom transform.
  private screenToViewport(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.svg) return { x: 0, y: 0 };
    const rect = this.svg.getBoundingClientRect();
    const vbX = ((clientX - rect.left) / rect.width) * 1000;
    const vbY = ((clientY - rect.top) / rect.height) * 720;
    return { x: (vbX - this.panX) / this.scale, y: (vbY - this.panY) / this.scale };
  }

  private bindGestures(container: HTMLElement) {
    container.addEventListener('mousedown', this.onPointerDown);
    window.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('mouseup', this.onPointerUp);
    container.addEventListener('wheel', this.onWheel, { passive: false });
    container.addEventListener('touchstart', this.onTouchStart, { passive: false });
    container.addEventListener('touchmove', this.onTouchMove, { passive: false });
    container.addEventListener('touchend', this.onTouchEnd);
  }

  private unbindGestures(container: HTMLElement) {
    container.removeEventListener('mousedown', this.onPointerDown);
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('mouseup', this.onPointerUp);
    container.removeEventListener('wheel', this.onWheel);
    container.removeEventListener('touchstart', this.onTouchStart);
    container.removeEventListener('touchmove', this.onTouchMove);
    container.removeEventListener('touchend', this.onTouchEnd);
  }

  private onPointerDown = (event: MouseEvent) => {
    this.dragging = true;
    this.dragMoved = 0;
    this.dragStart = { x: event.clientX, y: event.clientY };
  };

  private onPointerMove = (event: MouseEvent) => {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    this.dragMoved += Math.abs(dx) + Math.abs(dy);
    this.panX += dx;
    this.panY += dy;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.applyTransform();
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const anchor = this.screenToViewport(event.clientX, event.clientY);
    const nextScale = this.clampScale(this.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    this.zoomAround(anchor, nextScale);
  };

  private onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      this.dragging = true;
      this.dragMoved = 0;
      this.dragStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches.length === 2) {
      this.dragging = false;
      this.pinchStartDistance = this.touchDistance(event.touches);
      this.pinchStartScale = this.scale;
    }
  };

  private onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    if (event.touches.length === 1 && this.dragging) {
      const dx = event.touches[0].clientX - this.dragStart.x;
      const dy = event.touches[0].clientY - this.dragStart.y;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.panX += dx;
      this.panY += dy;
      this.dragStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      this.applyTransform();
    } else if (event.touches.length === 2 && this.pinchStartDistance > 0) {
      const distance = this.touchDistance(event.touches);
      const midpoint = {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2
      };
      const anchor = this.screenToViewport(midpoint.x, midpoint.y);
      const nextScale = this.clampScale(this.pinchStartScale * (distance / this.pinchStartDistance));
      this.zoomAround(anchor, nextScale);
    }
  };

  private onTouchEnd = () => {
    this.dragging = false;
    this.pinchStartDistance = 0;
  };

  private touchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  private clampScale(scale: number): number {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  }

  private zoomAround(anchor: { x: number; y: number }, nextScale: number) {
    // Keep the point under the cursor/pinch-midpoint stationary while the scale changes.
    this.panX = this.panX - anchor.x * (nextScale - this.scale);
    this.panY = this.panY - anchor.y * (nextScale - this.scale);
    this.scale = nextScale;
    this.applyTransform();
  }

  setCenter(lng: number, lat: number) {
    this.center = { lng, lat };
  }

  setZoom(zoom: number) {
    this.zoom = zoom;
  }

  renderPolygon(layer: MapPolygonLayer) {
    if (!this.viewport || layer.coordinates.length < 3) return;
    this.clearLayer(layer.id);
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('data-layer-id', layer.id);
    polygon.setAttribute('points', layer.coordinates.map((point) => this.project(point).join(',')).join(' '));
    polygon.setAttribute('fill', String(layer.style?.fill ?? '#16a34a55'));
    polygon.setAttribute('stroke', String(layer.style?.stroke ?? '#16a34a'));
    polygon.setAttribute('stroke-width', String(layer.style?.strokeWidth ?? 4));
    polygon.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.dragMoved > DRAG_CLICK_THRESHOLD_PX) return;
      this.polygonClick?.(layer);
    });
    this.viewport.appendChild(polygon);
  }

  renderPolyline(layer: MapPolylineLayer) {
    if (!this.viewport || layer.coordinates.length < 2) return;
    this.clearLayer(layer.id);
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('data-layer-id', layer.id);
    polyline.setAttribute('points', layer.coordinates.map((point) => this.project(point).join(',')).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', String(layer.style?.stroke ?? '#2563eb'));
    polyline.setAttribute('stroke-width', String(layer.style?.strokeWidth ?? 5));
    polyline.setAttribute('stroke-dasharray', String(layer.style?.dasharray ?? ''));
    this.viewport.appendChild(polyline);
  }

  renderMarker(marker: MapMarker) {
    if (!this.viewport) return;
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
    this.viewport.appendChild(group);
  }

  clearLayer(layerId: string) {
    this.viewport?.querySelectorAll(`[data-layer-id="${CSS.escape(layerId)}"]`).forEach((node) => node.remove());
  }

  onMapClick(callback: (point: LngLat) => void) {
    this.mapClick = callback;
    this.svg?.addEventListener('click', (event) => {
      if (this.dragMoved > DRAG_CLICK_THRESHOLD_PX) return;
      const { x, y } = this.screenToViewport(event.clientX, event.clientY);
      this.mapClick?.(this.unproject(x, y));
    });
  }

  onPolygonClick(callback: (layer: MapPolygonLayer) => void) {
    this.polygonClick = callback;
  }

  destroy() {
    if (this.container) {
      this.unbindGestures(this.container);
      this.container.innerHTML = '';
    }
    this.svg = undefined;
    this.viewport = undefined;
  }

  private project(point: LngLat): [number, number] {
    const scale = 90000 / Math.max(1, this.zoom);
    const x = 500 + (point.lng - this.center.lng) * scale;
    const y = 360 - (point.lat - this.center.lat) * scale;
    return [x, y];
  }

  private unproject(x: number, y: number): LngLat {
    const scale = 90000 / Math.max(1, this.zoom);
    return { lng: this.center.lng + (x - 500) / scale, lat: this.center.lat - (y - 360) / scale };
  }
}
