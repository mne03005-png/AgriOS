import { canonicalRole, type CanonicalRole } from './permissions';
import type { NavigationItem } from '../config/navigation';

// UX-1B single source of truth for "where does each canonical role land by default."
// DEFAULT_WORKSPACE_ROUTE is a default, not an access restriction -- it must never be used
// to gate or narrow route access. Route authorization stays entirely in the router's own
// meta.roles + canAccess() check (see router/index.ts).
export const DEFAULT_WORKSPACE_ROUTE: Record<CanonicalRole, string> = {
  FARMER: '/cockpit',
  MANAGER: '/manager',
  INSTALLER: '/installer-checks',
  ENGINEER: '/engineer',
  SUPER_ADMIN: '/platform'
};

// Accepts a raw legacy role or an already-canonical role (same "?? "-chained inputs used
// throughout the app, e.g. authStore.user?.canonicalRole ?? authStore.user?.role).
// canonicalRole() safely defaults any unrecognized value to FARMER, so an unknown/malformed
// role can never resolve here to a privileged workspace such as /platform.
export function getDefaultRouteForRole(role?: string | null): string {
  return DEFAULT_WORKSPACE_ROUTE[canonicalRole(role ?? undefined)];
}

// Open-redirect guard: only a same-origin, root-relative path ("/x", not "//x" or
// "https://x") is ever accepted as an explicit post-login destination.
export function isSafeInternalPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

// Priority: 1) a legitimate explicit redirect/deep-link destination, 2) otherwise the
// canonical role's default landing. Used after login and after session restoration.
export function resolveLandingRoute(role: string | undefined | null, explicitTarget?: unknown): string {
  if (isSafeInternalPath(explicitTarget)) return explicitTarget;
  return getDefaultRouteForRole(role);
}

// UX-1E: 首页 in the shared primaryNavigation config is a placeholder pointing at /cockpit.
// For FARMER that already IS their default landing, so it's a no-op. For MANAGER, whose
// default landing is /manager, this makes the 首页 tab/link actually go there instead of the
// literal Farmer Home -- without duplicating a second nav array or hardcoding a role branch
// into every consumer (AppTabBar.vue, App.vue). INSTALLER/ENGINEER/SUPER_ADMIN are left
// untouched: they already get their own workspace entry as a separate item, so rewriting
// their 首页 too would just create a confusing duplicate link to the same destination.
export function applyRoleAwareHome(items: NavigationItem[], role: CanonicalRole): NavigationItem[] {
  if (role !== 'FARMER' && role !== 'MANAGER') return items;
  const homePath = getDefaultRouteForRole(role);
  return items.map((item) => (item.path === '/cockpit' ? { ...item, path: homePath } : item));
}
