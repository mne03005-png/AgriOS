import { createRouter, createWebHistory } from 'vue-router';
import CockpitPage from '../pages/CockpitPage.vue';
import MapPage from '../pages/MapPage.vue';
import OperationsPage from '../pages/OperationsPage.vue';
import AIPage from '../pages/AIPage.vue';
import ProfilePage from '../pages/ProfilePage.vue';
import FieldDetailPage from '../pages/FieldDetailPage.vue';
import AlertsPage from '../pages/AlertsPage.vue';
import ReportsPage from '../pages/ReportsPage.vue';
import BoundaryReviewPage from '../pages/BoundaryReviewPage.vue';
import DroneOperationsPage from '../pages/DroneOperationsPage.vue';
import DroneReviewPage from '../pages/DroneReviewPage.vue';
import OperationReportDetailPage from '../pages/OperationReportDetailPage.vue';
import DemoStatusPage from '../pages/DemoStatusPage.vue';
import ShowcasePage from '../pages/ShowcasePage.vue';
import LoginPage from '../pages/LoginPage.vue';
import ChangePasswordPage from '../pages/ChangePasswordPage.vue';
import InstallerChecksPage from '../pages/InstallerChecksPage.vue';
import EdgeGatewayPage from '../pages/EdgeGatewayPage.vue';
import BluetoothMaintenancePage from '../pages/BluetoothMaintenancePage.vue';
import DeviceIntegrationPage from '../pages/DeviceIntegrationPage.vue';
import ValveControlTestPage from '../pages/ValveControlTestPage.vue';
import ReadOnlyTelemetryPage from '../pages/ReadOnlyTelemetryPage.vue';
import FarmRecordsPage from '../pages/FarmRecordsPage.vue';
import ForbiddenPage from '../pages/ForbiddenPage.vue';
import ManagerWorkbenchPage from '../pages/ManagerWorkbenchPage.vue';
import EngineerWorkbenchPage from '../pages/EngineerWorkbenchPage.vue';
import SuperAdminPage from '../pages/SuperAdminPage.vue';
import ActionQueuePage from '../pages/ActionQueuePage.vue';
import { authStore } from '../stores/auth.store';
import { canAccess, type CanonicalRole } from '../services/permissions';
import { getDefaultRouteForRole } from '../services/role-navigation';

function normalizeBase(base: string) {
  return base.endsWith('/') ? base : `${base}/`;
}

function resolveRouterBase() {
  const configuredBase = import.meta.env.VITE_ROUTER_BASE ?? import.meta.env.BASE_URL;
  if (configuredBase && configuredBase !== '/') return normalizeBase(configuredBase);
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/mobile')) return '/mobile/';
  return '/';
}

function isProductionMobileHost() {
  return typeof window !== 'undefined' && window.location.hostname === 'agrios.xyzwtt.com';
}

function hasStoredToken() {
  if (typeof localStorage === 'undefined') return false;
  return Boolean(localStorage.getItem('agrios_access_token'));
}

export const router = createRouter({
  history: createWebHistory(resolveRouterBase()),
  routes: [
    { path: '/', redirect: () => getDefaultRouteForRole(authStore.user?.canonicalRole ?? authStore.user?.role) },
    { path: '/cockpit', component: CockpitPage },
    { path: '/map', component: MapPage },
    { path: '/operations', component: OperationsPage },
    { path: '/ai', component: AIPage },
    { path: '/profile', component: ProfilePage },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/change-password', component: ChangePasswordPage },
    { path: '/farm-records', component: FarmRecordsPage },
    { path: '/manager', component: ManagerWorkbenchPage, meta: { roles: ['MANAGER', 'SUPER_ADMIN'] } },
    { path: '/engineer', component: EngineerWorkbenchPage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/platform', component: SuperAdminPage, meta: { roles: ['SUPER_ADMIN'] } },
    { path: '/installer-checks', component: InstallerChecksPage, meta: { roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/edge-gateways', component: EdgeGatewayPage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/bluetooth-maintenance', component: BluetoothMaintenancePage, meta: { roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/device-integration', component: DeviceIntegrationPage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/devices', component: ReadOnlyTelemetryPage, meta: { roles: ['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/valve-control-test', component: ValveControlTestPage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/action-queue', component: ActionQueuePage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/showcase', component: ShowcasePage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/fields/:fieldId', component: FieldDetailPage, props: true },
    { path: '/alerts', component: AlertsPage },
    { path: '/reports', component: ReportsPage },
    { path: '/demo-status', component: DemoStatusPage, meta: { roles: ['ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/operation-reports/:id', component: OperationReportDetailPage, props: true },
    { path: '/drone-operations', component: DroneOperationsPage, meta: { roles: ['MANAGER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/drone-reviews', component: DroneReviewPage, meta: { roles: ['MANAGER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/boundaries/review', component: BoundaryReviewPage, meta: { roles: ['MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] } },
    { path: '/forbidden', component: ForbiddenPage, meta: { public: true } },
    { path: '/:pathMatch(.*)*', redirect: () => getDefaultRouteForRole(authStore.user?.canonicalRole ?? authStore.user?.role) }
  ]
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (!hasStoredToken()) return { path: '/login', query: { redirect: to.fullPath } };
  const roles = to.meta.roles as CanonicalRole[] | undefined;
  if (!canAccess(roles, authStore.user?.canonicalRole ?? authStore.user?.role)) return { path: '/forbidden' };
  return true;
});
