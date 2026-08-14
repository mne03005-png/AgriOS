import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useGpsCaptureStore } from '../../stores/gps-capture.store';
import { requestLocationPermission } from '../../services/location';
import { importGpsTrack } from '../../api/gis-api';
import { useMapStore } from '../../stores/map.store';

const MIN_POINTS_TO_SUBMIT = 3;

// GPS field-boundary capture (NATIVE-MAP-1 section 14): 开始采集 starts a continuous foreground
// location watch (expo-location watchPositionAsync); each fix is appended to gps-capture.store
// and rendered live on the map. 结束采集 stops the watch. 提交 submits the closed loop to the
// existing /gis/gps-tracks/import endpoint (via importGpsTrack) -- no new backend route, no
// device-control action.
export default function GpsCaptureControl({ farmId }: { farmId: string }) {
  const recording = useGpsCaptureStore((state) => state.recording);
  const points = useGpsCaptureStore((state) => state.points);
  const start = useGpsCaptureStore((state) => state.start);
  const stop = useGpsCaptureStore((state) => state.stop);
  const reset = useGpsCaptureStore((state) => state.reset);
  const addPoint = useGpsCaptureStore((state) => state.addPoint);
  const loadMapData = useMapStore((state) => state.loadMapData);

  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  async function handleStart() {
    const permission = await requestLocationPermission({ allowRequest: true });
    if (!permission.granted) {
      Alert.alert('需要定位权限', '采集地块边界需要定位权限，请在系统设置中开启。');
      return;
    }
    start();
    subscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (position) => {
        addPoint({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          timestamp: new Date(position.timestamp).toISOString()
        });
      }
    );
  }

  function handleStop() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    stop();
  }

  async function handleSubmit() {
    if (points.length < MIN_POINTS_TO_SUBMIT) {
      Alert.alert('采集点不足', `至少需要 ${MIN_POINTS_TO_SUBMIT} 个采集点才能生成地块边界。`);
      return;
    }
    const trimmedName = name.trim() || `GPS边界_${new Date().toLocaleDateString('zh-CN')}`;
    setSubmitting(true);
    try {
      await importGpsTrack({ farmId, name: trimmedName, source: 'MOBILE_GPS', coordinateSystem: 'WGS84', points, closeLoop: true });
      reset();
      setName('');
      setExpanded(false);
      await loadMapData(farmId);
      Alert.alert('提交成功', '边界已提交，等待审核。');
    } catch (error) {
      Alert.alert('提交失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <Pressable style={styles.launchButton} onPress={() => setExpanded(true)}>
        <Ionicons name="walk-outline" size={20} color="#1f2933" />
        <Text style={styles.launchText}>GPS 走边界</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>GPS 走边界</Text>
        <Pressable onPress={() => (recording ? handleStop() : setExpanded(false))} hitSlop={8}>
          <Ionicons name="close" size={18} color="#1f2933" />
        </Pressable>
      </View>
      <Text style={styles.pointCount}>已采集 {points.length} 个点</Text>
      {!recording ? (
        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>开始采集</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.primaryButton, styles.stopButton]} onPress={handleStop}>
          <Text style={styles.primaryButtonText}>结束采集</Text>
        </Pressable>
      )}
      {!recording && points.length > 0 ? (
        <>
          <TextInput style={styles.input} placeholder="地块名称（可选）" value={name} onChangeText={setName} />
          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>提交边界</Text>}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  launchButton: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4
  },
  launchText: { fontSize: 13, fontWeight: '700', color: '#1f2933' },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  pointCount: { fontSize: 12, color: '#64748b' },
  primaryButton: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButton: { backgroundColor: '#dc2626' },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }
});
