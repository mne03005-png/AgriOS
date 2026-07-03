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
    { path: '/', redirect: '/cockpit' },
    { path: '/cockpit', component: CockpitPage },
    { path: '/map', component: MapPage },
    { path: '/operations', component: OperationsPage },
    { path: '/ai', component: AIPage },
    { path: '/profile', component: ProfilePage },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/change-password', component: ChangePasswordPage },
    { path: '/installer-checks', component: InstallerChecksPage },
    { path: '/edge-gateways', component: EdgeGatewayPage },
    { path: '/bluetooth-maintenance', component: BluetoothMaintenancePage },
    { path: '/device-integration', component: DeviceIntegrationPage },
    { path: '/devices', component: ReadOnlyTelemetryPage },
    { path: '/valve-control-test', component: ValveControlTestPage },
    { path: '/showcase', component: ShowcasePage },
    { path: '/fields/:fieldId', component: FieldDetailPage, props: true },
    { path: '/alerts', component: AlertsPage },
    { path: '/reports', component: ReportsPage },
    { path: '/demo-status', component: DemoStatusPage },
    { path: '/operation-reports/:id', component: OperationReportDetailPage, props: true },
    { path: '/drone-operations', component: DroneOperationsPage },
    { path: '/drone-reviews', component: DroneReviewPage },
    { path: '/boundaries/review', component: BoundaryReviewPage },
    { path: '/:pathMatch(.*)*', redirect: '/cockpit' }
  ]
});

router.beforeEach((to) => {
  if (!isProductionMobileHost() || to.meta.public || hasStoredToken()) return true;
  return { path: '/login', query: { redirect: to.fullPath } };
});
