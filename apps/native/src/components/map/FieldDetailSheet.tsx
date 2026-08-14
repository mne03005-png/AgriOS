import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FieldBoundary } from '../../types/domain';

const STATUS_LABEL: Record<string, string> = {
  CANDIDATE: '待审核',
  APPROVED: '已确认',
  ARCHIVED: '已归档'
};

// Native equivalent of apps/mobile/src/components/map/FieldBottomSheet.vue: conditionally
// rendered only when a feature is selected, with an explicit close button wired to the same
// clearSelection() the blank-map-tap path uses -- not two different "clear" implementations.
export default function FieldDetailSheet({ boundary, onClose }: { boundary: FieldBoundary; onClose: () => void }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{boundary.name ?? '地块详情'}</Text>
          <Text style={styles.subtitle}>
            面积 {boundary.areaMu ?? '-'} 亩 · 来源 {boundary.source ?? '-'} · {STATUS_LABEL[boundary.status] ?? boundary.status}
          </Text>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="关闭" hitSlop={8}>
          <Ionicons name="close" size={18} color="#1f2933" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#64748b' },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
