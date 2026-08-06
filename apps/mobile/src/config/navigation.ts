import type { CanonicalRole } from '../services/permissions';

export type NavigationItem = { path: string; label: string; icon: string; roles?: CanonicalRole[] };

export const primaryNavigation: NavigationItem[] = [
  { path: '/cockpit', label: '首页', icon: '⌂' },
  { path: '/map', label: '地图', icon: '◇' },
  { path: '/operations', label: '作业', icon: '✓' },
  { path: '/farm-records', label: '农事', icon: '田' },
  { path: '/profile', label: '我的', icon: '人' }
];

export const workspaceNavigation: NavigationItem[] = [
  { path: '/manager', label: '管理工作台', icon: '管', roles: ['MANAGER', 'SUPER_ADMIN'] },
  { path: '/installer-checks', label: '安装任务', icon: '装', roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] },
  { path: '/engineer', label: '工程师工作台', icon: '工', roles: ['ENGINEER', 'SUPER_ADMIN'] },
  { path: '/platform', label: '平台管理', icon: '台', roles: ['SUPER_ADMIN'] }
];
