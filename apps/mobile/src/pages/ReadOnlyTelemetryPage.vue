<template>
  <section class="page">
    <section class="panel readonly-banner">
      <div class="panel-title">Read-only device telemetry</div>
      <p class="subtle">Current mode is read-only. Device control is disabled by backend policy.</p>
    </section>

    <section class="panel">
      <div class="panel-title">Devices</div>
      <div v-if="loading" class="subtle">Loading devices...</div>
      <div v-else-if="error" class="warning-text">{{ error }}</div>
      <div v-else-if="!devices.length" class="empty-state">No device telemetry yet.</div>
      <button v-for="device in devices" :key="device.id" class="device-row" type="button" @click="selectDevice(device)">
        <span>
          <strong>{{ device.name ?? device.code ?? device.id }}</strong>
          <small>{{ device.type ?? 'DEVICE' }} · {{ device.online ? 'ONLINE' : 'OFFLINE' }}</small>
        </span>
        <span class="quality-pill">{{ latestQuality(device) }}</span>
      </button>
    </section>

    <section class="panel">
      <div class="panel-title">Latest telemetry</div>
      <div v-if="selected">
        <p class="subtle">{{ selected.name }} · last report {{ selected.lastTelemetryAt ?? selected.lastReportedAt ?? '--' }}</p>
        <div class="metric-grid tight">
          <div class="metric-card"><span>Battery</span><strong>{{ valueOf(selected, 'batteryPercent') }}</strong></div>
          <div class="metric-card"><span>Signal</span><strong>{{ valueOf(selected, 'signalStrength') }}</strong></div>
          <div class="metric-card"><span>Quality</span><strong>{{ latestQuality(selected) }}</strong></div>
          <div class="metric-card"><span>Source</span><strong>{{ selected.source ?? 'thingsboard' }}</strong></div>
        </div>
      </div>
      <p v-else class="subtle">Select a device to view telemetry.</p>
    </section>

    <section class="panel">
      <div class="panel-title">History trend</div>
      <div class="segmented">
        <button :class="{ active: range === '24h' }" @click="loadHistory('24h')">24h</button>
        <button :class="{ active: range === '7d' }" @click="loadHistory('7d')">7d</button>
      </div>
      <div v-if="historyLoading" class="subtle">Loading trend...</div>
      <div v-else-if="!history.length" class="empty-state">No history in selected range.</div>
      <div v-else class="trend-list">
        <div v-for="item in history" :key="item.id" class="trend-row">
          <span>{{ item.reportedAt }}</span>
          <strong>{{ item.qualityStatus ?? 'GOOD' }} · {{ item.qualityScore ?? 100 }}</strong>
        </div>
      </div>
    </section>

    <section v-if="isAdmin" class="panel">
      <div class="panel-title">Dead letters</div>
      <p v-for="item in deadLetters" :key="item.id" class="list-line">
        {{ item.eventType }} · {{ item.deviceName ?? item.thingsboardDeviceId ?? 'unknown' }} · {{ item.status }}
      </p>
      <p v-if="!deadLetters.length" class="subtle">No pending dead letters.</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getReadOnlyDeadLetters, getReadOnlyDeviceHistory, getReadOnlyDevices } from '../api/mobile-api';
import { authStore } from '../stores/auth.store';
import { canonicalRole } from '../services/permissions';

const loading = ref(true);
const historyLoading = ref(false);
const error = ref('');
const devices = ref<any[]>([]);
const selected = ref<any | null>(null);
const history = ref<any[]>([]);
const deadLetters = ref<any[]>([]);
const range = ref<'24h' | '7d'>('24h');
// The previous check read a localStorage role key the app never populated, so the dead
// letters panel never rendered for anyone. Use the canonical role source (same one router
// guards use) instead. This route is already restricted to INSTALLER/ENGINEER/SUPER_ADMIN;
// the dead letters panel further narrows to SUPER_ADMIN (the canonical mapping of the
// legacy PLATFORM_ADMIN role this check originally intended).
const isAdmin = ref(canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role) === 'SUPER_ADMIN');

onMounted(async () => {
  try {
    const [deviceResult, deadLetterResult] = await Promise.all([getReadOnlyDevices(), getReadOnlyDeadLetters()]);
    devices.value = deviceResult.data.items ?? [];
    deadLetters.value = deadLetterResult.data.items ?? [];
    if (devices.value[0]) await selectDevice(devices.value[0]);
  } catch {
    error.value = 'Failed to load read-only telemetry.';
  } finally {
    loading.value = false;
  }
});

async function selectDevice(device: any) {
  selected.value = device;
  await loadHistory(range.value);
}

async function loadHistory(nextRange: '24h' | '7d') {
  range.value = nextRange;
  if (!selected.value?.id) return;
  historyLoading.value = true;
  try {
    const result = await getReadOnlyDeviceHistory(selected.value.id, nextRange);
    history.value = result.data.items ?? [];
  } finally {
    historyLoading.value = false;
  }
}

function valueOf(device: any, key: string) {
  const value = device.currentStatus?.[key] ?? device[key];
  return value ?? '--';
}

function latestQuality(device: any) {
  return device.currentStatus?.qualityStatus ?? device.qualityStatus ?? 'GOOD';
}
</script>
