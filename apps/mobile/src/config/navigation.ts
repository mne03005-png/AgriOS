import type { CanonicalRole } from '../services/permissions';

// UX-HOTFIX (PROD-USABILITY-1): icon is a NavIcon.vue glyph name, never a Chinese character or
// text symbol -- rendering `icon` next to `label` as raw text used to produce visibly duplicated
// pseudo-icon-text like "警 告警"/"据 数据"/"人 我的". See components/common/NavIcon.vue for the
// actual SVG glyphs.
export type NavIconName = 'home' | 'field' | 'task' | 'alert' | 'chart' | 'user' | 'workspace' | 'tools' | 'settings' | 'platform';
export type NavigationItem = { path: string; label: string; icon: NavIconName; roles?: CanonicalRole[] };

// UX-1E accepted normal (FARMER/MANAGER) mobile domains: 首页/田块/作业/告警/我的. The 首页
// entry's path ('/cockpit') is a role-aware placeholder -- see role-navigation.ts's
// applyRoleAwareHome(), which rewrites it to each role's actual default landing. /map is kept
// as the compatibility route behind the 田块 label (not renamed -- see UX-1E section 7).
export const primaryNavigation: NavigationItem[] = [
  { path: '/cockpit', label: '首页', icon: 'home' },
  { path: '/map', label: '田块', icon: 'field' },
  { path: '/operations', label: '作业', icon: 'task' },
  { path: '/alerts', label: '告警', icon: 'alert' },
  { path: '/profile', label: '我的', icon: 'user' }
];

// Desktop-only addition to reach the accepted six-domain shell (首页/田块/作业/告警/数据/我的)
// without adding a sixth mobile bottom tab (UX-1E section 13 explicitly forbids that). Only
// consumed by App.vue's desktop sidebar, never by AppTabBar.vue.
export const desktopSecondaryNavigation: NavigationItem[] = [{ path: '/reports', label: '数据', icon: 'chart' }];

export const workspaceNavigation: NavigationItem[] = [
  { path: '/manager', label: '管理工作台', icon: 'workspace', roles: ['MANAGER', 'SUPER_ADMIN'] },
  { path: '/installer-checks', label: '安装任务', icon: 'tools', roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] },
  { path: '/engineer', label: '工程师工作台', icon: 'settings', roles: ['ENGINEER', 'SUPER_ADMIN'] },
  { path: '/platform', label: '平台管理', icon: 'platform', roles: ['SUPER_ADMIN'] }
];
