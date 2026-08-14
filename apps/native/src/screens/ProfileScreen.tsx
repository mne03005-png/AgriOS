import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/auth.store';

const ROLE_LABEL: Record<string, string> = {
  FARMER: '种植户',
  MANAGER: '农场管理员',
  INSTALLER: '安装工程师',
  ENGINEER: '技术工程师',
  SUPER_ADMIN: '平台管理员'
};

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>我的</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? '-'}</Text>
        <Text style={styles.meta}>{ROLE_LABEL[user?.canonicalRole ?? ''] ?? user?.role ?? '-'}</Text>
        {user?.farm?.name ? <Text style={styles.meta}>{user.farm.name}</Text> : null}
        {user?.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
      </View>
      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', padding: 20, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 18, gap: 4 },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b' },
  logoutButton: { backgroundColor: '#fee2e2', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '700' }
});
