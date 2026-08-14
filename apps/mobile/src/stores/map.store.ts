import { reactive } from 'vue';
import { getMap } from '../api/mobile-api';
import { defaultFarmId, mockMap } from '../api/mock-data';

const savedLayers = localStorage.getItem('agrios.mobile.activeLayers');

export const mapStore = reactive({
  provider: import.meta.env.VITE_MAP_PROVIDER ?? 'mock',
  activeLayers: savedLayers
    ? (JSON.parse(savedLayers) as Record<string, boolean>)
    : {
        FIELD: true,
        IRRIGATION_ZONE: true,
        VALVE: true,
        SENSOR: true,
        PUMP: true,
        PIPELINE: true,
        WATER: true,
        OBSTACLE: true,
        GPS_TRACK: true,
        DRONE_ROUTE: true,
        ORTHOMOSAIC: true
      },
  selectedField: null as any | null,
  selectedBoundary: null as any | null,
  // Which activeLayers key the current selection was rendered under (e.g. 'FIELD' for a
  // boundary). Lets toggleLayer() know whether a layer it just hid owns the current selection.
  selectedLayerType: null as string | null,
  drawingMode: false,
  drawingPoints: [] as Array<{ lng: number; lat: number }>,
  gpsRecording: false,
  gpsTrackPoints: [] as Array<{ lng: number; lat: number; timestamp?: string }>,
  mapData: mockMap as any,
  isMock: true,
  async loadMapData(farmId = defaultFarmId) {
    const result = await getMap(farmId);
    this.mapData = result.data;
    this.isMock = result.isMock;
    // Never auto-select a boundary just because data loaded (initial mount, farm switch, or a
    // post-save refresh) -- a detail card must only ever appear from an explicit click. If a
    // boundary was already selected, re-validate it still exists in the freshly loaded data;
    // a boundary that was deleted/archived elsewhere must not leave a stale card on screen.
    if (this.selectedLayerType === 'FIELD' && this.selectedField) {
      const stillExists = (result.data.fieldBoundaries ?? []).some((item: any) => item.id === this.selectedField.id);
      if (!stillExists) this.clearSelection();
    }
    return result;
  },
  toggleLayer(type: string) {
    this.activeLayers[type] = !this.activeLayers[type];
    localStorage.setItem('agrios.mobile.activeLayers', JSON.stringify(this.activeLayers));
    // Turning off the layer that owns the current selection must clear it immediately -- a
    // detail card pointing at a now-hidden shape is stale, not just visually inconsistent.
    if (!this.activeLayers[type] && this.selectedLayerType === type) {
      this.clearSelection();
    }
  },
  startDrawing() {
    this.drawingMode = true;
    this.drawingPoints = [];
  },
  stopDrawing() {
    this.drawingMode = false;
  },
  addDrawingPoint(point: { lng: number; lat: number }) {
    if (this.drawingMode) this.drawingPoints.push(point);
  },
  startGpsRecording() {
    this.gpsRecording = true;
    this.gpsTrackPoints = [];
  },
  stopGpsRecording() {
    this.gpsRecording = false;
  },
  addGpsPoint(point: { lng: number; lat: number; timestamp?: string }) {
    if (this.gpsRecording) this.gpsTrackPoints.push(point);
  },
  selectField(field: any, layerType = 'FIELD') {
    this.selectedField = field;
    this.selectedBoundary = field;
    this.selectedLayerType = layerType;
  },
  clearSelection() {
    this.selectedField = null;
    this.selectedBoundary = null;
    this.selectedLayerType = null;
  },
  async refreshLayers(farmId = defaultFarmId) {
    return this.loadMapData(farmId);
  }
});
