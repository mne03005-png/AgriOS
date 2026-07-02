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
import InstallerChecksPage from '../pages/InstallerChecksPage.vue';
import EdgeGatewayPage from '../pages/EdgeGatewayPage.vue';
import BluetoothMaintenancePage from '../pages/BluetoothMaintenancePage.vue';
import DeviceIntegrationPage from '../pages/DeviceIntegrationPage.vue';
import ValveControlTestPage from '../pages/ValveControlTestPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/cockpit' },
    { path: '/cockpit', component: CockpitPage },
    { path: '/map', component: MapPage },
    { path: '/operations', component: OperationsPage },
    { path: '/ai', component: AIPage },
    { path: '/profile', component: ProfilePage },
    { path: '/login', component: LoginPage },
    { path: '/installer-checks', component: InstallerChecksPage },
    { path: '/edge-gateways', component: EdgeGatewayPage },
    { path: '/bluetooth-maintenance', component: BluetoothMaintenancePage },
    { path: '/device-integration', component: DeviceIntegrationPage },
    { path: '/valve-control-test', component: ValveControlTestPage },
    { path: '/showcase', component: ShowcasePage },
    { path: '/fields/:fieldId', component: FieldDetailPage, props: true },
    { path: '/alerts', component: AlertsPage },
    { path: '/reports', component: ReportsPage },
    { path: '/demo-status', component: DemoStatusPage },
    { path: '/operation-reports/:id', component: OperationReportDetailPage, props: true },
    { path: '/drone-operations', component: DroneOperationsPage },
    { path: '/drone-reviews', component: DroneReviewPage },
    { path: '/boundaries/review', component: BoundaryReviewPage }
  ]
});
