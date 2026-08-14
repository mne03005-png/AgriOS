import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import LoginScreen from '../screens/LoginScreen';
import TabNavigator from './TabNavigator';

export default function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return status === 'signed-in' ? <TabNavigator /> : <LoginScreen />;
}
