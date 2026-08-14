import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../stores/auth.store';
import { getOperations } from '../api/mobile-api';
import EmptyState from '../components/common/EmptyState';

type ActionPlan = { id: string; status?: string; createdAt?: string; recommendation?: string };
type OperationsData = { actionPlans?: ActionPlan[] };

export default function OperationsScreen() {
  const farmId = useAuthStore((state) => state.user?.farmId ?? '');
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const result = await getOperations(farmId);
      setData(result as OperationsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '作业记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const items = data?.actionPlans ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>作业</Text>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && !data ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
        {data && items.length === 0 ? <EmptyState title="暂无作业记录" description="当前农场还没有作业计划。" /> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.rowTitle}>{item.recommendation ?? '作业'}</Text>
            <Text style={styles.rowStatus}>{item.status ?? '-'}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', paddingHorizontal: 20, paddingTop: 12 },
  content: { padding: 20, gap: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  row: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rowStatus: { fontSize: 12, color: '#64748b' }
});
