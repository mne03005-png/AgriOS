import type { MapAdapter } from './map-adapter.interface';
import { AMapAdapter } from './amap.adapter';
import { BaiduMapAdapter } from './baidu-map.adapter';
import { GoogleMapAdapter } from './google-map.adapter';
import { MockMapAdapter } from './mock-map.adapter';

export function createMapAdapter(provider = import.meta.env.VITE_MAP_PROVIDER ?? 'mock'): MapAdapter {
  if (provider === 'amap' && import.meta.env.VITE_AMAP_KEY) return new AMapAdapter();
  if (provider === 'google' && import.meta.env.VITE_GOOGLE_MAP_KEY) return new GoogleMapAdapter();
  if (provider === 'baidu' && import.meta.env.VITE_BAIDU_MAP_KEY) return new BaiduMapAdapter();
  return new MockMapAdapter();
}

export * from './map-adapter.interface';
