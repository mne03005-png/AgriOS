import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import FieldsScreen from '../screens/FieldsScreen';
import OperationsScreen from '../screens/OperationsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type TabParamList = {
  首页: undefined;
  田块: undefined;
  作业: undefined;
  告警: undefined;
  我的: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  首页: 'home-outline',
  田块: 'map-outline',
  作业: 'construct-outline',
  告警: 'notifications-outline',
  我的: 'person-outline'
};

// NATIVE-MAP-1 section 15: real Chinese product tab labels with real vector icons -- no
// pseudo-icon-as-text ("警 告警"), no Tesla/Cockpit/backend/raw-role wording anywhere here.
export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name as keyof TabParamList]} size={size} color={color} />,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8'
      })}
    >
      <Tab.Screen name="首页" component={HomeScreen} />
      <Tab.Screen name="田块" component={FieldsScreen} />
      <Tab.Screen name="作业" component={OperationsScreen} />
      <Tab.Screen name="告警" component={AlertsScreen} />
      <Tab.Screen name="我的" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
