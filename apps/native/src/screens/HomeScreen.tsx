import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../stores/auth.store';
import { getCockpit } from '../api/mobile-api';
import EmptyState from '../components/common/EmptyState';

type CockpitData = {
  farm?: { name?: string; fields?: unknown[] };
  deviceOnlineRate?: number;
  pendingAlerts?: number;
  todayRiskLevel?: string;
};

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const farmId = user?.farmId ?? '';
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const result = await getCockpit(farmId);
      setData(result as CockpitData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!farmId) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState title="没有可用农场" description="当前账号未关联农场，请联系管理员。" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={styles.greeting}>你好，{user?.name ?? '农场用户'}</Text>
        <Text style={styles.farmName}>{data?.farm?.name ?? (loading ? '加载中…' : '农场')}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && !data ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}

        {data ? (
          <View style={styles.cardRow}>
            <SummaryCard label="田块数" value={String((data.farm?.fields ?? []).length)} />
            <SummaryCard label="设备在线率" value={`${data.deviceOnlineRate ?? 0}%`} />
            <SummaryCard label="待处理告警" value={String(data.pendingAlerts ?? 0)} tone={Number(data.pendingAlerts ?? 0) > 0 ? 'warn' : 'ok'} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, tone === 'warn' && styles.cardValueWarn]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 8 },
  greeting: { fontSize: 15, color: '#64748b' },
  farmName: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  card: { flex: 1, backgroundColor: '#ffffff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 4 },
  cardValue: { fontSize: 20, fontWeight: '900', color: '#16a34a' },
  cardValueWarn: { color: '#dc2626' },
  cardLabel: { fontSize: 12, color: '#64748b' }
});
