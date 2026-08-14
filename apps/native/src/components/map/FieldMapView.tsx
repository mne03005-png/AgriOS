import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, Region } from 'react-native-maps';
import { useMapStore } from '../../stores/map.store';
import { useGpsCaptureStore } from '../../stores/gps-capture.store';
import { polygonCoordinates } from '../../services/geometry';
import { DEFAULT_LOCATION, getCurrentLocationSafe } from '../../services/location';
import type { FieldBoundary, MapLayer } from '../../types/domain';
import MapFloatingControls from './MapFloatingControls';
import FieldDetailSheet from './FieldDetailSheet';
import GpsCaptureControl from './GpsCaptureControl';

const DEFAULT_REGION: Region = {
  latitude: DEFAULT_LOCATION.latitude,
  longitude: DEFAULT_LOCATION.longitude,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05
};

const LAYER_STYLE: Record<string, { stroke: string; fill: string }> = {
  FIELD: { stroke: '#16a34a', fill: 'rgba(22,163,74,0.33)' },
  IRRIGATION_ZONE: { stroke: '#2563eb', fill: 'rgba(37,99,235,0.2)' },
  OBSTACLE: { stroke: '#dc2626', fill: 'rgba(220,38,38,0.2)' },
  WATER: { stroke: '#06b6d4', fill: 'rgba(6,182,212,0.2)' },
  ORTHOMOSAIC: { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.33)' }
};
const LINE_STYLE: Record<string, string> = {
  PIPELINE: '#60a5fa',
  DRONE_ROUTE: '#9333ea',
  GPS_TRACK: '#84cc16'
};

function polygonLayersOf(type: MapLayer['type'], layers: MapLayer[]) {
  return layers.filter((layer) => layer.type === type);
}

export default function FieldMapView({ farmId }: { farmId: string }) {
  const mapRef = useRef<MapView | null>(null);
  const hasFitToDataRef = useRef(false);
  const ignoreNextMapPressRef = useRef(false);
  const [isLocating, setIsLocating] = useState(false);
  const mapData = useMapStore((state) => state.mapData);
  const activeLayers = useMapStore((state) => state.activeLayers);
  const selectedFeature = useMapStore((state) => state.selectedFeature);
  const gpsCapturePoints = useGpsCaptureStore((state) => state.points);
  const selectFeature = useMapStore((state) => state.selectFeature);
  const clearSelection = useMapStore((state) => state.clearSelection);

  const boundaryShapes = useMemo(
    () =>
      (mapData.fieldBoundaries ?? [])
        .map((boundary) => ({ boundary, coordinates: polygonCoordinates(boundary.polygon) }))
        .filter((item): item is { boundary: FieldBoundary; coordinates: NonNullable<ReturnType<typeof polygonCoordinates>> } => Boolean(item.coordinates?.length)),
    [mapData.fieldBoundaries]
  );

  const irrigationZones = useMemo(() => polygonLayersOf('IRRIGATION_ZONE', mapData.irrigationZones ?? []), [mapData.irrigationZones]);
  const obstacleLayers = useMemo(() => mapData.obstacles ?? [], [mapData.obstacles]);
  const waterLayers = useMemo(() => mapData.waterChannels ?? [], [mapData.waterChannels]);
  const pipelineLayers = useMemo(() => mapData.pipelines ?? [], [mapData.pipelines]);
  const droneRouteLayers = useMemo(
    () => [...(mapData.droneRoutes ?? []), ...(mapData.droneRouteLayers ?? [])],
    [mapData.droneRoutes, mapData.droneRouteLayers]
  );

  // Fit the camera to the real field geometry once per farm's data load, not on every render or
  // selection change -- that would fight a user who has since panned/zoomed manually.
  useEffect(() => {
    hasFitToDataRef.current = false;
  }, [farmId]);

  useEffect(() => {
    if (hasFitToDataRef.current || !boundaryShapes.length || !mapRef.current) return;
    hasFitToDataRef.current = true;
    const allCoords = boundaryShapes.flatMap((item) => item.coordinates);
    mapRef.current.fitToCoordinates(allCoords, { edgePadding: { top: 80, right: 60, bottom: 220, left: 60 }, animated: true });
  }, [boundaryShapes]);

  function handleMapPress() {
    if (ignoreNextMapPressRef.current) {
      ignoreNextMapPressRef.current = false;
      return;
    }
    // A blank-map tap must clear whatever is selected -- ported from the fishing app's
    // handleMapPress()/ignoreNextMapPressRef guard in MapScreen.js, which stops a Marker/Polygon
    // press from being immediately undone by the map's own onPress firing right after it.
    clearSelection();
  }

  function handleBoundaryPress(boundary: FieldBoundary) {
    ignoreNextMapPressRef.current = true;
    setTimeout(() => {
      ignoreNextMapPressRef.current = false;
    }, 0);
    selectFeature(boundary, 'FIELD');
  }

  function fitToGeometry() {
    if (!boundaryShapes.length || !mapRef.current) return;
    const allCoords = boundaryShapes.flatMap((item) => item.coordinates);
    mapRef.current.fitToCoordinates(allCoords, { edgePadding: { top: 80, right: 60, bottom: 220, left: 60 }, animated: true });
  }

  async function focusCurrentLocation() {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const result = await getCurrentLocationSafe({ requestPermission: true });
      const nextRegion: Region = { ...result.location, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      mapRef.current?.animateToRegion(nextRegion, 600);
    } finally {
      setIsLocating(false);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {activeLayers.FIELD &&
          boundaryShapes.map(({ boundary, coordinates }) => (
            <Polygon
              key={boundary.id}
              coordinates={coordinates}
              tappable
              onPress={() => handleBoundaryPress(boundary)}
              strokeColor={selectedFeature?.id === boundary.id ? '#0f766e' : LAYER_STYLE.FIELD.stroke}
              strokeWidth={selectedFeature?.id === boundary.id ? 4 : 3}
              fillColor={LAYER_STYLE.FIELD.fill}
            />
          ))}

        {activeLayers.IRRIGATION_ZONE &&
          irrigationZones.map((layer) => {
            const coordinates = polygonCoordinates(layer.geoJson);
            if (!coordinates?.length) return null;
            return <Polygon key={layer.id} coordinates={coordinates} strokeColor={LAYER_STYLE.IRRIGATION_ZONE.stroke} fillColor={LAYER_STYLE.IRRIGATION_ZONE.fill} strokeWidth={3} />;
          })}

        {activeLayers.OBSTACLE &&
          obstacleLayers.map((layer) => {
            const coordinates = polygonCoordinates(layer.geoJson);
            if (!coordinates?.length) return null;
            return <Polygon key={layer.id} coordinates={coordinates} strokeColor={LAYER_STYLE.OBSTACLE.stroke} fillColor={LAYER_STYLE.OBSTACLE.fill} strokeWidth={3} />;
          })}

        {activeLayers.WATER &&
          waterLayers.map((layer) => {
            const coordinates = polygonCoordinates(layer.geoJson);
            if (!coordinates?.length) return null;
            return <Polygon key={layer.id} coordinates={coordinates} strokeColor={LAYER_STYLE.WATER.stroke} fillColor={LAYER_STYLE.WATER.fill} strokeWidth={3} />;
          })}

        {activeLayers.PIPELINE &&
          pipelineLayers.map((layer) => {
            const coordinates = polygonCoordinates(layer.geoJson);
            if (!coordinates || coordinates.length < 2) return null;
            return <Polyline key={layer.id} coordinates={coordinates} strokeColor={LINE_STYLE.PIPELINE} strokeWidth={4} lineDashPattern={[10, 8]} />;
          })}

        {activeLayers.DRONE_ROUTE &&
          droneRouteLayers.map((layer) => {
            const coordinates = polygonCoordinates(layer.geoJson);
            if (!coordinates || coordinates.length < 2) return null;
            return <Polyline key={layer.id} coordinates={coordinates} strokeColor={LINE_STYLE.DRONE_ROUTE} strokeWidth={4} />;
          })}

        {activeLayers.GPS_TRACK &&
          (mapData.gpsTracks ?? []).map((track) => {
            const coordinates = polygonCoordinates(track.trackJson);
            if (!coordinates || coordinates.length < 2) return null;
            return <Polyline key={track.id} coordinates={coordinates} strokeColor={LINE_STYLE.GPS_TRACK} strokeWidth={4} />;
          })}

        {gpsCapturePoints.length > 1 ? (
          <Polyline
            coordinates={gpsCapturePoints.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
            strokeColor="#22c55e"
            strokeWidth={5}
          />
        ) : null}

        {activeLayers.VALVE &&
          (mapData.valveMarkers ?? []).map((device) =>
            device.latitude && device.longitude ? (
              <Marker key={device.id} coordinate={{ latitude: Number(device.latitude), longitude: Number(device.longitude) }} title={device.name} description={device.online ? '在线' : '离线'} pinColor="#f97316" />
            ) : null
          )}
        {activeLayers.SENSOR &&
          (mapData.sensorMarkers ?? []).map((device) =>
            device.latitude && device.longitude ? (
              <Marker key={device.id} coordinate={{ latitude: Number(device.latitude), longitude: Number(device.longitude) }} title={device.name} description={device.online ? '在线' : '离线'} pinColor="#2563eb" />
            ) : null
          )}
        {activeLayers.PUMP &&
          (mapData.pumpMarkers ?? []).map((device) =>
            device.latitude && device.longitude ? (
              <Marker key={device.id} coordinate={{ latitude: Number(device.latitude), longitude: Number(device.longitude) }} title={device.name} description={device.online ? '在线' : '离线'} pinColor="#0f172a" />
            ) : null
          )}
      </MapView>

      <MapFloatingControls isLocating={isLocating} onFocusCurrentLocation={focusCurrentLocation} onFitToGeometry={fitToGeometry} canFitToGeometry={boundaryShapes.length > 0} />

      {selectedFeature ? (
        <FieldDetailSheet boundary={selectedFeature} onClose={clearSelection} />
      ) : (
        <GpsCaptureControl farmId={farmId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 }
});
