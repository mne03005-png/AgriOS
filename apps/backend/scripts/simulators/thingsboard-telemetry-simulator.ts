type Scenario = 'normal' | 'dry' | 'low-pressure' | 'no-flow';

const apiBaseUrl = process.env.AGRIOS_API_URL ?? 'http://localhost:3000/api/v1';
const webhookPath = process.env.AGRIOS_WEBHOOK_PATH ?? '/iot/thingsboard/telemetry';
const webhookSecret = process.env.THINGSBOARD_WEBHOOK_SECRET ?? 'agrios_tb_secret';
const deviceName = process.env.DEVICE_NAME ?? 'demo-soil-sensor-a';
const thingsboardDeviceId = process.env.THINGSBOARD_DEVICE_ID ?? 'tb-demo-soil-a';
const scenario = (process.env.SCENARIO ?? 'normal') as Scenario;

function buildPayload() {
  const soilMoisture = scenario === 'dry' ? 18 : 34;
  const pressureKpa = scenario === 'low-pressure' ? 58 : 186;
  const flowRateM3h = scenario === 'no-flow' ? 0 : 12.4;
  const values = {
    soilMoisture,
    temperature: 31,
    humidity: 64,
    pressureKpa,
    flowRateM3h,
    valveOpeningPercent: scenario === 'no-flow' ? 80 : 60,
    pumpFrequencyHz: scenario === 'no-flow' ? 35 : 30,
    fertilizerTankLevelL: 320,
    batteryPercent: 91,
    signalStrength: -60,
    scenario
  };
  return {
    deviceName,
    deviceId: thingsboardDeviceId,
    thingsboardDeviceId,
    ts: Date.now(),
    values,
    metadata: {
      deviceName,
      thingsboardDeviceId,
      source: 'p13-thingsboard-telemetry-simulator'
    },
    soilMoisture,
    temperature: values.temperature,
    humidity: values.humidity,
    battery: values.batteryPercent,
    rawPayload: { simulator: 'P13.0', scenario, values }
  };
}

async function main() {
  const target = `${apiBaseUrl}${webhookPath}`;
  const payload = buildPayload();
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-thingsboard-secret': webhookSecret
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  console.log(`[P13 ThingsBoard simulator] POST ${target}`);
  console.log(`[P13 ThingsBoard simulator] status=${response.status}`);
  console.log(text);
}

void main().catch((error) => {
  console.error(`[P13 ThingsBoard simulator] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

