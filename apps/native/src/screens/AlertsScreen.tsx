import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../stores/auth.store';
import { getAlerts } from '../api/mobile-api';
import EmptyState from '../components/common/EmptyState';

type SafetyAlert = { id: string; message?: string; severity?: string; createdAt?: string };
type AlertsData = { safetyAlerts?: SafetyAlert[]; anomalies?: SafetyAlert[] };

export default function AlertsScreen() {
  const farmId = useAuthStore((state) => state.user?.farmId ?? '');
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const result = await getAlerts(farmId);
      setData(result as AlertsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '告警加载失败');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const items = [...(data?.safetyAlerts ?? []), ...(data?.anomalies ?? [])];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>告警</Text>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && !data ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
        {data && items.length === 0 ? <EmptyState title="暂无告警" description="当前农场没有待处理的告警。" /> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.rowMessage}>{item.message ?? '告警'}</Text>
            {item.createdAt ? <Text style={styles.rowMeta}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text> : null}
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
  row: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, gap: 4 },
  rowMessage: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rowMeta: { fontSize: 12, color: '#94a3b8' }
});
