<template>
  <section class="page map-page">
    <DemoHeader />
    <div v-if="mapStore.isMock" class="mock-banner">当前为模拟地图数据</div>
    <MapToolbar />
    <div ref="mapEl" class="map-sdk-host"></div>
    <FarmMapCanvas
      class="svg-fallback"
      :fields="mapStore.mapData.fieldBoundaries ?? []"
      :sensors="mapStore.mapData.sensorMarkers ?? []"
      :valves="mapStore.mapData.valveMarkers ?? []"
      @select-field="selectField"
    />
    <LayerPanel :active-layers="mapStore.activeLayers" @toggle="toggleLayer" />
    <DrawBoundaryTool :points="mapStore.drawingPoints" @start="startDrawing" @stop="stopDrawing" @save="saveBoundary" />
    <GpsBoundaryRecorder
      :points="mapStore.gpsTrackPoints"
      :recording="mapStore.gpsRecording"
      @start="startGps"
      @stop="stopGps"
      @submit="submitGps"
    />
    <FieldBottomSheet :field="mapStore.selectedField" />
    <DroneOperationCard v-if="selectedDroneOperation" :item="selectedDroneOperation" />
    <section v-if="!hasMapData || !demoReady" class="panel">
      <div class="panel-title">Map data not ready</div>
      <p class="warning-text">请先执行 npx prisma db seed，确认 Demo 边界、图层和设备已生成。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { createFieldBoundary, importGpsTrack } from '../api/gis-api';
import DroneOperationCard from '../components/drone/DroneOperationCard.vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import DrawBoundaryTool from '../components/map/DrawBoundaryTool.vue';
import FarmMapCanvas from '../components/map/FarmMapCanvas.vue';
import FieldBottomSheet from '../components/map/FieldBottomSheet.vue';
import GpsBoundaryRecorder from '../components/map/GpsBoundaryRecorder.vue';
import LayerPanel from '../components/map/LayerPanel.vue';
import MapToolbar from '../components/map/MapToolbar.vue';
import { createMapAdapter, type LngLat, type MapAdapter } from '../map-adapters';
import { mapStore } from '../stores/map.store';
import { farmStore } from '../stores/farm.store';

const mapEl = ref<HTMLElement | null>(null);
const selectedDroneOperation = ref<any | null>(null);
const demoReady = ref(true);
const hasMapData = computed(() => Boolean((mapStore.mapData.fieldBoundaries ?? []).length || (mapStore.mapData.droneRouteLayers ?? []).length || (mapStore.mapData.droneCoverageLayers ?? []).length));
let adapter: MapAdapter | null = null;

async function loadForCurrentFarm() {
  // Race guard: mirrors CockpitPage/ManagerWorkbenchPage (UX-1D section 31) -- a slower
  // response for a farm the user has since navigated away from must not overwrite the map.
  const requestedFarmId = farmStore.currentFarmIdOrDefault;
  const [health] = await Promise.all([getDemoHealth(requestedFarmId), mapStore.loadMapData(requestedFarmId)]);
  if (requestedFarmId !== farmStore.currentFarmIdOrDefault) return;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
  renderAll();
}

onMounted(async () => {
  await loadForCurrentFarm();
  await nextTick();
  await initMap();
  renderAll();
  window.addEventListener('agrios:gps-point', onGpsPoint as EventListener);
});

onBeforeUnmount(() => {
  adapter?.destroy();
  window.removeEventListener('agrios:gps-point', onGpsPoint as EventListener);
});

// Map respects the shared CURRENT FARM (UX-1D section 23) -- reload when it changes after
// the initial mount (e.g. a field deep link elsewhere corrected the farm context).
watch(() => farmStore.currentFarmIdOrDefault, loadForCurrentFarm);

async function initMap() {
  if (!mapEl.value) return;
  adapter = createMapAdapter(mapStore.provider);
  await adapter.init(mapEl.value, { center: { lng: 118.1, lat: 36.7 }, zoom: 13 });
  adapter.onMapClick((point) => {
    if (mapStore.drawingMode) {
      mapStore.addDrawingPoint(point);
      renderDrawing();
    }
  });
  adapter.onPolygonClick((layer) => selectField(layer.data ?? layer));
}

function renderAll() {
  if (!adapter) return;
  renderBoundaries();
  renderLayers();
  renderDevices();
  renderTracks();
  renderDrawing();
  renderGpsTrack();
}

function renderBoundaries() {
  if (!adapter || !mapStore.activeLayers.FIELD) return;
  for (const boundary of mapStore.mapData.fieldBoundaries ?? []) {
    const coordinates = polygonCoordinates(boundary.polygon) ?? fallbackPolygon(boundary.id);
    adapter.renderPolygon({
      id: `boundary-${boundary.id}`,
      type: 'FIELD',
      coordinates,
      data: boundary,
      style: { stroke: '#16a34a', fill: '#16a34a55', strokeWidth: 4 }
    });
  }
}

function renderLayers() {
  if (!adapter) return;
  const layers = [
    ...(mapStore.mapData.irrigationZones ?? []).map((item: any) => ({ ...item, type: 'IRRIGATION_ZONE' })),
    ...(mapStore.mapData.waterChannels ?? []).map((item: any) => ({ ...item, type: 'WATER' })),
    ...(mapStore.mapData.pipelines ?? []).map((item: any) => ({ ...item, type: 'PIPELINE' })),
    ...(mapStore.mapData.obstacles ?? []).map((item: any) => ({ ...item, type: 'OBSTACLE' })),
    ...(mapStore.mapData.droneRoutes ?? []).map((item: any) => ({ ...item, type: 'DRONE_ROUTE' })),
    ...(mapStore.mapData.droneRouteLayers ?? []).map((item: any) => ({ ...item, type: 'DRONE_ROUTE' })),
    ...(mapStore.mapData.droneCoverageLayers ?? []).map((item: any) => ({ ...item, type: item.styleJson?.layerRole === 'DRONE_COVERAGE' ? 'ORTHOMOSAIC' : item.type ?? 'ORTHOMOSAIC' })),
    ...(mapStore.mapData.prescriptionLayers ?? []).map((item: any) => ({ ...item, type: item.type ?? 'ORTHOMOSAIC' })),
    ...(mapStore.mapData.orthomosaicLayers ?? []).map((item: any) => ({ ...item, type: 'ORTHOMOSAIC' }))
  ];
  for (const layer of layers) {
    if (!mapStore.activeLayers[layer.type]) continue;
    const coordinates = polygonCoordinates(layer.geoJson) ?? fallbackPolygon(layer.id);
    if (['PIPELINE', 'DRONE_ROUTE'].includes(layer.type)) {
      adapter.renderPolyline({ id: `layer-${layer.id}`, type: layer.type, coordinates, style: layerStyle(layer.type), data: layer });
    } else {
      adapter.renderPolygon({ id: `layer-${layer.id}`, type: layer.type, coordinates, style: layerStyle(layer.type), data: layer });
    }
  }
}

function renderDevices() {
  if (!adapter) return;
  const markerGroups = [
    ['VALVE', mapStore.mapData.valveMarkers ?? []],
    ['SENSOR', mapStore.mapData.sensorMarkers ?? []],
    ['PUMP', mapStore.mapData.pumpMarkers ?? []]
  ] as const;
  for (const [type, markers] of markerGroups) {
    if (!mapStore.activeLayers[type]) continue;
    markers.forEach((marker: any, index: number) => {
      const point = marker.longitude && marker.latitude ? { lng: Number(marker.longitude), lat: Number(marker.latitude) } : fallbackPoint(index);
      adapter?.renderMarker({ id: `${type}-${marker.id ?? index}`, type, ...point, label: marker.name ?? type, data: marker });
    });
  }
}

function renderTracks() {
  if (!adapter || !mapStore.activeLayers.GPS_TRACK) return;
  for (const track of mapStore.mapData.gpsTracks ?? []) {
    const coordinates = lineCoordinates(track.trackJson) ?? fallbackPolygon(track.id);
    adapter.renderPolyline({ id: `track-${track.id}`, type: 'GPS_TRACK', coordinates, style: { stroke: '#84cc16', strokeWidth: 4 } });
  }
}

function renderDrawing() {
  if (!adapter) return;
  adapter.clearLayer('drawing-line');
  if (mapStore.drawingPoints.length > 1) {
    adapter.renderPolyline({ id: 'drawing-line', coordinates: mapStore.drawingPoints, style: { stroke: '#f97316', strokeWidth: 5, dasharray: '8 6' } });
  }
}

function renderGpsTrack() {
  if (!adapter) return;
  adapter.clearLayer('gps-recording');
  if (mapStore.gpsTrackPoints.length > 1) {
    adapter.renderPolyline({ id: 'gps-recording', coordinates: mapStore.gpsTrackPoints, style: { stroke: '#22c55e', strokeWidth: 5 } });
  }
}

function toggleLayer(type: string) {
  mapStore.toggleLayer(type);
  adapter?.destroy();
  void initMap().then(renderAll);
}

function startDrawing() {
  mapStore.startDrawing();
}

function stopDrawing() {
  mapStore.stopDrawing();
}

async function saveBoundary(name: string) {
  if (mapStore.drawingPoints.length < 3) return;
  const polygon = {
    type: 'Polygon',
    coordinates: [[...mapStore.drawingPoints.map((point) => [point.lng, point.lat]), [mapStore.drawingPoints[0].lng, mapStore.drawingPoints[0].lat]]]
  };
  await createFieldBoundary({ farmId: farmStore.currentFarmIdOrDefault, name, source: 'MANUAL_DRAW', coordinateSystem: 'WGS84', polygon });
  mapStore.stopDrawing();
  mapStore.drawingPoints = [];
  await mapStore.refreshLayers(farmStore.currentFarmIdOrDefault);
  renderAll();
}

function startGps() {
  mapStore.startGpsRecording();
}

function stopGps() {
  mapStore.stopGpsRecording();
}

async function submitGps(name: string) {
  if (mapStore.gpsTrackPoints.length < 3) return;
  await importGpsTrack({ farmId: farmStore.currentFarmIdOrDefault, name, source: 'MOBILE_GPS', coordinateSystem: 'WGS84', points: mapStore.gpsTrackPoints, closeLoop: true });
  mapStore.stopGpsRecording();
  await mapStore.refreshLayers(farmStore.currentFarmIdOrDefault);
  renderAll();
}

function onGpsPoint(event: CustomEvent<LngLat & { timestamp?: string }>) {
  mapStore.addGpsPoint(event.detail);
  renderGpsTrack();
}

function selectField(field: any) {
  const droneOperationId = field?.styleJson?.droneOperationId;
  if (droneOperationId) {
    selectedDroneOperation.value = (mapStore.mapData.droneOperations ?? []).find((item: any) => item.id === droneOperationId) ?? {
      id: droneOperationId,
      operationType: field.styleJson?.operationType,
      status: 'IMPORTED',
      rawJson: { mapLayerName: field.name }
    };
    return;
  }
  selectedDroneOperation.value = null;
  mapStore.selectField(field);
}

function layerStyle(type: string) {
  const styles: Record<string, Record<string, string | number>> = {
    FIELD: { stroke: '#16a34a', fill: '#16a34a55', strokeWidth: 4 },
    IRRIGATION_ZONE: { stroke: '#2563eb', fill: '#2563eb33', strokeWidth: 4 },
    OBSTACLE: { stroke: '#dc2626', fill: '#dc262633', strokeWidth: 4 },
    WATER: { stroke: '#06b6d4', fill: '#06b6d433', strokeWidth: 4 },
    ROAD: { stroke: '#64748b', fill: '#64748b22', strokeWidth: 4 },
    PIPELINE: { stroke: '#60a5fa', strokeWidth: 5, dasharray: '10 8' },
    DRONE_ROUTE: { stroke: '#9333ea', strokeWidth: 4 },
    ORTHOMOSAIC: { stroke: '#94a3b8', fill: '#94a3b855', strokeWidth: 2 }
  };
  return styles[type] ?? styles.FIELD;
}

function polygonCoordinates(geoJson: any): LngLat[] | null {
  const geometry = geoJson?.type === 'Feature' ? geoJson.geometry : geoJson;
  const ring =
    geometry?.type === 'Polygon'
      ? geometry.coordinates?.[0]
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates?.[0]?.[0]
        : geometry?.type === 'LineString'
          ? geometry.coordinates
          : geometry?.type === 'MultiLineString'
            ? geometry.coordinates?.[0]
            : null;
  if (!Array.isArray(ring)) return null;
  return ring.map((item: number[]) => ({ lng: Number(item[0]), lat: Number(item[1]) }));
}

function lineCoordinates(geoJson: any): LngLat[] | null {
  return polygonCoordinates(geoJson);
}

function fallbackPolygon(seed: string): LngLat[] {
  const offset = (String(seed).charCodeAt(0) % 10) * 0.004;
  return [
    { lng: 118.08 + offset, lat: 36.7 + offset },
    { lng: 118.12 + offset, lat: 36.7 + offset },
    { lng: 118.12 + offset, lat: 36.74 + offset },
    { lng: 118.08 + offset, lat: 36.74 + offset }
  ];
}

function fallbackPoint(index: number): LngLat {
  return { lng: 118.09 + index * 0.012, lat: 36.71 + index * 0.008 };
}
</script>
