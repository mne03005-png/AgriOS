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
    this.selectedField = result.data.fieldBoundaries?.[0] ?? null;
    return result;
  },
  toggleLayer(type: string) {
    this.activeLayers[type] = !this.activeLayers[type];
    localStorage.setItem('agrios.mobile.activeLayers', JSON.stringify(this.activeLayers));
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
  selectField(field: any) {
    this.selectedField = field;
    this.selectedBoundary = field;
  },
  async refreshLayers(farmId = defaultFarmId) {
    return this.loadMapData(farmId);
  }
});
