import { create } from 'zustand';
import * as mobileApi from '../api/mobile-api';
import type { FieldBoundary, MobileMapData } from '../types/domain';

const emptyMapData: MobileMapData = {
  fieldBoundaries: [],
  irrigationZones: [],
  valveMarkers: [],
  sensorMarkers: [],
  pumpMarkers: [],
  waterChannels: [],
  pipelines: [],
  obstacles: [],
  droneRoutes: [],
  droneRouteLayers: [],
  droneCoverageLayers: [],
  orthomosaicLayers: [],
  droneOperations: [],
  gpsTracks: []
};

type LayerKey = 'FIELD' | 'IRRIGATION_ZONE' | 'VALVE' | 'SENSOR' | 'PUMP' | 'PIPELINE' | 'WATER' | 'OBSTACLE' | 'GPS_TRACK' | 'DRONE_ROUTE' | 'ORTHOMOSAIC';

type MapState = {
  mapData: MobileMapData;
  loading: boolean;
  error: string | null;
  activeLayers: Record<LayerKey, boolean>;
  // Selection lifecycle ported 1:1 from apps/mobile/src/stores/map.store.ts (the just-fixed
  // Web selection bug): no auto-select on load, explicit-click-only, and every path that can
  // invalidate a selection (stale reload, layer hide, farm change) clears it.
  selectedFeature: FieldBoundary | null;
  selectedLayerType: LayerKey | null;
  loadMapData: (farmId: string) => Promise<void>;
  selectFeature: (feature: FieldBoundary, layerType: LayerKey) => void;
  clearSelection: () => void;
  toggleLayer: (type: LayerKey) => void;
};

export const useMapStore = create<MapState>((set, get) => ({
  mapData: emptyMapData,
  loading: false,
  error: null,
  activeLayers: {
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
  selectedFeature: null,
  selectedLayerType: null,

  async loadMapData(farmId: string) {
    set({ loading: true, error: null });
    try {
      const data = await mobileApi.getMap(farmId);
      const state = get();
      // A selection whose boundary no longer exists in the freshly loaded data (deleted,
      // archived, or the farm itself changed) must not be left on screen as a stale card.
      const stillExists =
        state.selectedLayerType === 'FIELD' && state.selectedFeature
          ? (data.fieldBoundaries ?? []).some((item) => item.id === state.selectedFeature!.id)
          : true;
      set({
        mapData: data,
        loading: false,
        ...(stillExists ? {} : { selectedFeature: null, selectedLayerType: null })
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '地图数据加载失败' });
    }
  },

  selectFeature(feature, layerType) {
    set({ selectedFeature: feature, selectedLayerType: layerType });
  },

  clearSelection() {
    set({ selectedFeature: null, selectedLayerType: null });
  },

  toggleLayer(type) {
    const nextValue = !get().activeLayers[type];
    set((state) => ({ activeLayers: { ...state.activeLayers, [type]: nextValue } }));
    // Hiding the layer that owns the current selection must clear it immediately, matching the
    // Web store's toggleLayer() behavior -- a detail card pointing at a now-hidden shape is stale.
    if (!nextValue && get().selectedLayerType === type) {
      get().clearSelection();
    }
  }
}));
