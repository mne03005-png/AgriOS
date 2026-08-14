import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#334155' },
  description: { fontSize: 13, color: '#94a3b8', textAlign: 'center' }
});
