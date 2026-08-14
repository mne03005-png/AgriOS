import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../stores/auth.store';
import { useMapStore } from '../stores/map.store';
import { getCockpit } from '../api/mobile-api';
import FieldMapView from '../components/map/FieldMapView';
import EmptyState from '../components/common/EmptyState';
import type { Field } from '../types/domain';

type ViewMode = 'map' | 'list';

// 田块 owns spatial exploration as one screen with an internal 地图/列表 switch (NATIVE-MAP-1
// section 12) -- mirrors apps/mobile/src/pages/MapPage.vue rather than adding a separate
// primary "地图" tab.
export default function FieldsScreen() {
  const farmId = useAuthStore((state) => state.user?.farmId ?? '');
  const mapData = useMapStore((state) => state.mapData);
  const mapLoading = useMapStore((state) => state.loading);
  const mapError = useMapStore((state) => state.error);
  const loadMapData = useMapStore((state) => state.loadMapData);
  const clearSelection = useMapStore((state) => state.clearSelection);
  const selectFeature = useMapStore((state) => state.selectFeature);

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [fields, setFields] = useState<Field[] | null>(null);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!farmId) return;
    await loadMapData(farmId);
    try {
      const cockpit = await getCockpit(farmId);
      const farm = (cockpit as { farm?: { fields?: Field[] } })?.farm;
      setFields(farm?.fields ?? []);
      setFieldsError(null);
    } catch (error) {
      setFieldsError(error instanceof Error ? error.message : '田块列表加载失败');
    }
  }, [farmId, loadMapData]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // Switching 地图/列表 must never carry a stale selection back into view -- ported from
  // MapPage.vue's `watch(viewMode, clearSelection)`.
  useEffect(() => {
    clearSelection();
  }, [viewMode, clearSelection]);

  function openFieldOnMap(field: Field) {
    const boundary = (mapData.fieldBoundaries ?? []).find((item) => item.fieldId === field.id);
    setViewMode('map');
    if (boundary) selectFeature(boundary, 'FIELD');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>田块</Text>
        <View style={styles.switchGroup}>
          <ToggleButton label="地图" active={viewMode === 'map'} onPress={() => setViewMode('map')} />
          <ToggleButton label="列表" active={viewMode === 'list'} onPress={() => setViewMode('list')} />
        </View>
      </View>

      {viewMode === 'map' ? (
        farmId ? (
          <FieldMapView farmId={farmId} />
        ) : (
          <EmptyState title="没有可用农场" description="当前账号未关联农场，请联系管理员。" />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {mapLoading && !fields ? <ActivityIndicator style={styles.loadingIndicator} /> : null}
          {fieldsError || mapError ? <Text style={styles.errorText}>{fieldsError ?? mapError}</Text> : null}
          {fields && fields.length === 0 ? <EmptyState title="暂无田块" description="该农场下还没有登记的田块。" /> : null}
          {(fields ?? []).map((field) => {
            const hasBoundary = (mapData.fieldBoundaries ?? []).some((item) => item.fieldId === field.id);
            return (
              <Pressable key={field.id} style={styles.listRow} onPress={() => openFieldOnMap(field)}>
                <View style={styles.listRowMain}>
                  <Text style={styles.listRowTitle}>{field.name ?? '地块'}</Text>
                  <Text style={styles.listRowSubtitle}>{field.areaMu ?? '-'} 亩</Text>
                </View>
                <Text style={hasBoundary ? styles.badgeReady : styles.badgePending}>{hasBoundary ? '有边界' : '暂无边界'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggleButton, active && styles.toggleButtonActive]} onPress={onPress}>
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  toolbarTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  switchGroup: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3 },
  toggleButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  toggleButtonActive: { backgroundColor: '#ffffff' },
  toggleButtonText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  toggleButtonTextActive: { color: '#0f172a' },
  listContent: { padding: 16, gap: 10 },
  loadingIndicator: { marginTop: 24 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  listRowMain: { gap: 2 },
  listRowTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  listRowSubtitle: { fontSize: 12, color: '#64748b' },
  badgeReady: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  badgePending: { fontSize: 11, fontWeight: '700', color: '#94a3b8' }
});
