import { create } from 'zustand';

export type CapturedPoint = { lng: number; lat: number; timestamp: string };

type GpsCaptureState = {
  recording: boolean;
  points: CapturedPoint[];
  start: () => void;
  addPoint: (point: CapturedPoint) => void;
  stop: () => void;
  reset: () => void;
};

// Backs the GPS field-boundary capture flow (NATIVE-MAP-1 section 14): 开始采集 -> continuous
// GPS points appended here while recording -> rendered live as a Polyline by FieldMapView ->
// 结束采集 -> review -> submit via gis-api.importGpsTrack (the existing endpoint the Web
// client's GpsBoundaryRecorder.vue already uses). No device-control action anywhere in this flow.
export const useGpsCaptureStore = create<GpsCaptureState>((set) => ({
  recording: false,
  points: [],
  start: () => set({ recording: true, points: [] }),
  addPoint: (point) => set((state) => (state.recording ? { points: [...state.points, point] } : state)),
  stop: () => set({ recording: false }),
  reset: () => set({ recording: false, points: [] })
}));
