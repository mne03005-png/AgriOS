<template>
  <section class="page">
    <header class="section-header">
      <div>
        <p class="eyebrow">Platform</p>
        <h1>平台管理</h1>
        <p class="subtle">当前模式：平台模式 · 跨租户操作必须显式进入租户/农场上下文，后端仍独立执行权限与审计检查。</p>
      </div>
    </header>

    <!-- 租户: real GET /tenants data only, no fabricated tenant KPIs -->
    <section class="panel">
      <div class="panel-title">租户</div>
      <p v-if="tenantsLoading" class="subtle">正在读取租户列表…</p>
      <p v-else-if="tenantsError" class="warning-text">{{ tenantsError }}</p>
      <p v-else-if="!tenants.length" class="empty-state">暂无租户数据</p>
      <template v-else>
        <button
          v-for="tenant in tenants"
          :key="tenant.id"
          class="device-row"
          type="button"
          :class="{ active: platformContextStore.selectedTenantId === tenant.id }"
          @click="selectTenant(tenant)"
        >
          <span>
            <strong>{{ tenant.name }}</strong>
            <small>{{ tenant.type ?? '-' }} · {{ tenant.status ?? '-' }}</small>
          </span>
        </button>
      </template>
    </section>

    <!-- 选择农场: only once a tenant is explicitly selected; tenant selection alone never implies
         farm context (UX-1H section 19) -->
    <section v-if="platformContextStore.selectedTenantId" class="panel">
      <div class="panel-title">选择农场 · {{ platformContextStore.selectedTenantName }}</div>
      <p v-if="farmsLoading" class="subtle">正在读取农场列表…</p>
      <p v-else-if="farmsError" class="warning-text">{{ farmsError }}</p>
      <p v-else-if="!farmsForSelectedTenant.length" class="empty-state">该租户暂无农场</p>
      <template v-else>
        <div v-for="farm in farmsForSelectedTenant" :key="farm.id" class="panel">
          <div class="card-topline">
            <strong>{{ farm.name }}</strong>
            <span class="subtle">{{ (farm.fields ?? []).length }} 个田块</span>
          </div>
          <button class="primary-button" type="button" @click="enterFarmOperationMode(farm)">进入农场运营 →</button>
        </div>
      </template>
    </section>
    <p v-else class="subtle">请选择租户以查看可进入的农场。</p>

    <!-- 平台工具: existing honest placeholder capabilities only -- no ThingsBoard Sync button, no
         Check Health button (UX-1H sections 21-23; P1-TB-TENANT-MAPPING stays explicitly open). -->
    <section class="panel">
      <div class="panel-title">平台工具</div>
      <div class="workspace-grid">
        <div v-for="item in platformTools" :key="item.name" class="panel">
          <strong>{{ item.name }}</strong>
          <span class="capability-state">{{ item.state }}</span>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getTenants, type Tenant } from '../api/tenant-api';
import { getFarms, type Farm } from '../api/farm-api';
import { farmStore } from '../stores/farm.store';
import { platformContextStore } from '../stores/platform-context.store';

const router = useRouter();

const tenants = ref<Tenant[]>([]);
const tenantsLoading = ref(true);
const tenantsError = ref('');

const farms = ref<Farm[]>([]);
const farmsLoading = ref(true);
const farmsError = ref('');

const farmsForSelectedTenant = computed(() =>
  farms.value.filter((farm) => farm.tenantId === platformContextStore.selectedTenantId)
);

// UX-1H section 18: only the existing, still-unimplemented placeholder capabilities. Distinct
// from the 租户/选择农场 flow above (which is a real, working discovery-and-entry path), these
// remain honest PARTIAL/BLOCKED_BY_CONFIG states -- no new mutation UI is added here.
const platformTools = [
  { name: '平台健康', state: 'PARTIAL' },
  { name: '关键告警', state: 'PARTIAL' },
  { name: '设备总览', state: 'PARTIAL' },
  { name: '集成状态', state: 'BLOCKED_BY_CONFIG' },
  { name: '审计摘要', state: 'PARTIAL' },
  { name: '高风险审批', state: 'PARTIAL' }
];

// Visiting /platform is itself the explicit "return to / stay in Platform Mode" action (UX-1H
// section 10/31): clear any active farm-operation context and the tenant picker's own selection
// unconditionally on mount, so this route always deterministically represents Platform Mode
// regardless of how it was reached (fresh login, or explicitly returning from Farm Operation
// Mode). This is the entire "返回平台模式" mechanism -- App.vue's header link just navigates here.
farmStore.clearCurrentFarm();
platformContextStore.clear();

onMounted(loadPlatformData);
async function loadPlatformData() {
  tenantsLoading.value = true;
  tenantsError.value = '';
  farmsLoading.value = true;
  farmsError.value = '';
  // Independent, isolated per section -- one failing fetch must not block the other.
  const [tenantsResult, farmsResult] = await Promise.allSettled([getTenants(), getFarms()]);
  if (tenantsResult.status === 'fulfilled') tenants.value = tenantsResult.value.data ?? [];
  else tenantsError.value = '租户列表读取失败';
  tenantsLoading.value = false;

  if (farmsResult.status === 'fulfilled') farms.value = farmsResult.value.data ?? [];
  else farmsError.value = '农场列表读取失败';
  farmsLoading.value = false;
}

function selectTenant(tenant: Tenant) {
  const next = platformContextStore.selectedTenantId === tenant.id ? null : tenant.id;
  platformContextStore.selectTenant(next, next ? tenant.name : null);
}

function enterFarmOperationMode(farm: Farm) {
  farmStore.setCurrentFarm(farm.id, farm.name);
  router.push('/cockpit');
}
</script>
