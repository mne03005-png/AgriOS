import { Injectable } from '@nestjs/common';

export type CoordinateSystemCode = 'WGS84' | 'GCJ02' | 'BD09';
type Coordinate = [number, number, ...unknown[]];

const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0;
const EE = 0.006693421622965943;

@Injectable()
export class CoordinateTransformService {
  convertPoint(lng: number, lat: number, from: CoordinateSystemCode, to: CoordinateSystemCode) {
    if (from === to) return { lng, lat };
    if (from === 'WGS84' && to === 'GCJ02') return this.wgs84ToGcj02(lng, lat);
    if (from === 'GCJ02' && to === 'WGS84') return this.gcj02ToWgs84(lng, lat);
    if (from === 'GCJ02' && to === 'BD09') return this.gcj02ToBd09(lng, lat);
    if (from === 'BD09' && to === 'GCJ02') return this.bd09ToGcj02(lng, lat);
    if (from === 'WGS84' && to === 'BD09') {
      const gcj = this.wgs84ToGcj02(lng, lat);
      return this.gcj02ToBd09(gcj.lng, gcj.lat);
    }
    if (from === 'BD09' && to === 'WGS84') {
      const gcj = this.bd09ToGcj02(lng, lat);
      return this.gcj02ToWgs84(gcj.lng, gcj.lat);
    }
    return { lng, lat };
  }

  convertGeoJSON(geoJson: Record<string, any>, from: CoordinateSystemCode, to: CoordinateSystemCode) {
    if (from === to) return geoJson;
    return this.convertCoordinates(JSON.parse(JSON.stringify(geoJson)), from, to);
  }

  private convertCoordinates(value: any, from: CoordinateSystemCode, to: CoordinateSystemCode): any {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      const point = this.convertPoint(value[0], value[1], from, to);
      const rest = value.slice(2);
      return [point.lng, point.lat, ...rest];
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.convertCoordinates(item, from, to));
    }
    if (value && typeof value === 'object') {
      if ('coordinates' in value) {
        value.coordinates = this.convertCoordinates(value.coordinates, from, to);
      }
      if (Array.isArray(value.features)) {
        value.features = value.features.map((feature: any) => this.convertCoordinates(feature, from, to));
      }
      if (value.geometry) {
        value.geometry = this.convertCoordinates(value.geometry, from, to);
      }
    }
    return value;
  }

  private wgs84ToGcj02(lng: number, lat: number) {
    if (this.outOfChina(lng, lat)) return { lng, lat };
    let dLat = this.transformLat(lng - 105.0, lat - 35.0);
    let dLng = this.transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
    return { lng: lng + dLng, lat: lat + dLat };
  }

  private gcj02ToWgs84(lng: number, lat: number) {
    if (this.outOfChina(lng, lat)) return { lng, lat };
    const gcj = this.wgs84ToGcj02(lng, lat);
    return { lng: lng * 2 - gcj.lng, lat: lat * 2 - gcj.lat };
  }

  private gcj02ToBd09(lng: number, lat: number) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
    return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 };
  }

  private bd09ToGcj02(lng: number, lat: number) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) };
  }

  private outOfChina(lng: number, lat: number) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  private transformLat(x: number, y: number) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }

  private transformLng(x: number, y: number) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
    return ret;
  }
}
