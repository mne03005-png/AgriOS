import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/auth.store';

// Reuses the existing AgriOS /auth/login endpoint -- no second auth system, no embedded demo
// credentials. The account/password fields are always blank on load.
export default function LoginScreen() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const error = useAuthStore((state) => state.error);

  const isPhone = /^\d+$/.test(account.trim());

  async function handleSubmit() {
    if (!account.trim() || !password) return;
    setSubmitting(true);
    await login(isPhone ? { phone: account.trim(), password } : { email: account.trim(), password });
    setSubmitting(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={styles.title}>AgriOS</Text>
        <Text style={styles.subtitle}>登录以管理您的农场</Text>

        <TextInput
          style={styles.input}
          placeholder="手机号或邮箱"
          autoCapitalize="none"
          autoCorrect={false}
          value={account}
          onChangeText={setAccount}
        />
        <TextInput style={styles.input} placeholder="密码" secureTextEntry value={password} onChangeText={setPassword} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>登录</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center' },
  form: { paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#16a34a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },
  submitButton: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' }
});
