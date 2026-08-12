import type { CanonicalRole } from '../services/permissions';

export type NavigationItem = { path: string; label: string; icon: string; roles?: CanonicalRole[] };

// UX-1E accepted normal (FARMER/MANAGER) mobile domains: 首页/田块/作业/告警/我的. The 首页
// entry's path ('/cockpit') is a role-aware placeholder -- see role-navigation.ts's
// applyRoleAwareHome(), which rewrites it to each role's actual default landing. /map is kept
// as the compatibility route behind the 田块 label (not renamed -- see UX-1E section 7).
export const primaryNavigation: NavigationItem[] = [
  { path: '/cockpit', label: '首页', icon: '⌂' },
  { path: '/map', label: '田块', icon: '◇' },
  { path: '/operations', label: '作业', icon: '✓' },
  { path: '/alerts', label: '告警', icon: '警' },
  { path: '/profile', label: '我的', icon: '人' }
];

// Desktop-only addition to reach the accepted six-domain shell (首页/田块/作业/告警/数据/我的)
// without adding a sixth mobile bottom tab (UX-1E section 13 explicitly forbids that). Only
// consumed by App.vue's desktop sidebar, never by AppTabBar.vue.
export const desktopSecondaryNavigation: NavigationItem[] = [{ path: '/reports', label: '数据', icon: '据' }];

export const workspaceNavigation: NavigationItem[] = [
  { path: '/manager', label: '管理工作台', icon: '管', roles: ['MANAGER', 'SUPER_ADMIN'] },
  { path: '/installer-checks', label: '安装任务', icon: '装', roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] },
  { path: '/engineer', label: '工程师工作台', icon: '工', roles: ['ENGINEER', 'SUPER_ADMIN'] },
  { path: '/platform', label: '平台管理', icon: '台', roles: ['SUPER_ADMIN'] }
];
