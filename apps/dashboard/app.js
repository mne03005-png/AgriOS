// OpenAgriOS v0.1-alpha dashboard. No build step, no framework — polls the public snapshot
// endpoint and renders it. Deliberately minimal: this demo does not need a SPA.
const params = new URLSearchParams(window.location.search);
const FARM_ID = params.get('farmId') || 'openagrios-demo-farm';
const POLL_MS = 5000;
const ENDPOINT = `/api/v1/open/farms/${FARM_ID}/snapshot`;

const app = document.getElementById('app');
const connection = document.getElementById('connection');
const template = document.getElementById('snapshot-template');

function fmt(value, digits = 1) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

function freshnessLabel(reportedAt) {
  if (!reportedAt) return 'no telemetry yet';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(reportedAt).getTime()) / 1000));
  if (seconds < 60) return `updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `updated ${minutes}m ago`;
}

function render(snapshot) {
  const node = template.content.cloneNode(true);
  const field = (name) => node.querySelector(`[data-field="${name}"]`);

  field('farmName').textContent = snapshot.farm?.name ?? '—';
  field('fieldName').textContent = snapshot.field?.name ?? '—';
  field('deviceCode').textContent = snapshot.device?.code ?? '—';

  const online = Boolean(snapshot.device?.online);
  const badge = field('statusBadge');
  badge.textContent = snapshot.device ? (online ? 'Online' : 'Offline') : 'No device yet';
  badge.className = `status-badge ${online ? 'is-online' : 'is-offline'}`;
  field('freshness').textContent = freshnessLabel(snapshot.telemetry?.reportedAt);

  field('soilMoisture').textContent = fmt(snapshot.telemetry?.soilMoisture);
  field('temperature').textContent = fmt(snapshot.telemetry?.temperature);
  field('humidity').textContent = fmt(snapshot.telemetry?.humidity);
  field('battery').textContent = fmt(snapshot.telemetry?.battery);

  const alertList = field('alertList');
  const alertEmpty = field('alertEmpty');
  const alerts = snapshot.alerts ?? [];
  if (alerts.length) {
    alertEmpty.hidden = true;
    for (const alert of alerts) {
      const li = document.createElement('li');
      li.className = `alert-item severity-${(alert.severity || 'low').toLowerCase()}`;
      li.textContent = alert.message;
      alertList.appendChild(li);
    }
  } else {
    alertEmpty.hidden = false;
  }

  field('endpoint').textContent = ENDPOINT;

  app.innerHTML = '';
  app.appendChild(node);
}

async function poll() {
  try {
    const response = await fetch(ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const snapshot = body?.data ?? body;
    render(snapshot);
    connection.textContent = 'connected';
    connection.className = 'connection is-connected';
  } catch (error) {
    connection.textContent = `disconnected — ${error.message}`;
    connection.className = 'connection is-disconnected';
  }
}

poll();
setInterval(poll, POLL_MS);
