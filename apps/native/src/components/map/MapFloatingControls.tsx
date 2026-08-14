import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Floating vertical tool stack, ported from the fishing app's src/components/map/MapControls.js
// layout/interaction pattern (icon + label buttons stacked along the right edge). AgriOS-specific
// actions only: 定位 (current location) and 适应范围 (fit to field geometry) -- no blind-box/heatmap/
// add-spot fishing tools carried over.
export default function MapFloatingControls({
  isLocating,
  onFocusCurrentLocation,
  onFitToGeometry,
  canFitToGeometry
}: {
  isLocating: boolean;
  onFocusCurrentLocation: () => void;
  onFitToGeometry: () => void;
  canFitToGeometry: boolean;
}) {
  return (
    <View style={styles.floatingTools} pointerEvents="box-none">
      <ToolButton icon="locate-outline" label="定位" onPress={onFocusCurrentLocation} busy={isLocating} />
      {canFitToGeometry ? <ToolButton icon="scan-outline" label="适应范围" onPress={onFitToGeometry} /> : null}
    </View>
  );
}

function ToolButton({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable style={styles.toolButton} onPress={onPress} disabled={busy}>
      <Ionicons name={icon} size={20} color="#1f2933" />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingTools: {
    position: 'absolute',
    right: 16,
    top: 100,
    gap: 10
  },
  toolButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4
  },
  toolText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2
  }
});
