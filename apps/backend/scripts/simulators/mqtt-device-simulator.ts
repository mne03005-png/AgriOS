import mqtt from 'mqtt';

type Scenario = 'normal' | 'low-pressure' | 'no-flow' | 'offline';

const brokerUrl = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
const deviceCode = process.env.DEVICE_CODE ?? 'demo-soil-sensor-a';
const scenario = (process.env.SCENARIO ?? 'normal') as Scenario;
const intervalMs = Number(process.env.INTERVAL_MS ?? 5000);

function buildTelemetry(sequence: number) {
  const baseMoisture = 34 + Math.sin(sequence / 3) * 5;
  const basePressure = scenario === 'low-pressure' ? 62 : 180 + Math.sin(sequence / 4) * 12;
  const baseFlow = scenario === 'no-flow' ? 0 : 12 + Math.sin(sequence / 5) * 2;
  return {
    soilMoisture: Number(baseMoisture.toFixed(1)),
    temperature: Number((29 + Math.sin(sequence / 7) * 3).toFixed(1)),
    humidity: Number((64 + Math.sin(sequence / 6) * 5).toFixed(1)),
    pressureKpa: Number(basePressure.toFixed(1)),
    flowRateM3h: Number(baseFlow.toFixed(2)),
    valveOpeningPercent: scenario === 'no-flow' ? 80 : 65,
    pumpFrequencyHz: scenario === 'no-flow' ? 36 : 32,
    fertilizerTankLevelL: 320,
    batteryPercent: 88,
    signalStrength: -62,
    scenario,
    timestamp: new Date().toISOString()
  };
}

function buildStatus(online: boolean) {
  return {
    online,
    scenario,
    timestamp: new Date().toISOString(),
    message: online ? 'P13 simulator online' : 'P13 simulator offline anomaly'
  };
}

function publishJson(client: mqtt.MqttClient, topic: string, payload: unknown) {
  const message = JSON.stringify(payload);
  client.publish(topic, message);
  console.log(`[P13 MQTT simulator] ${topic} ${message}`);
}

function main() {
  const client = mqtt.connect(brokerUrl, { clientId: `agrios-p13-simulator-${Date.now()}` });
  let sequence = 0;

  client.on('connect', () => {
    console.log(`[P13 MQTT simulator] connected: ${brokerUrl}`);
    publishJson(client, `agrios/device/${deviceCode}/status`, buildStatus(true));

    setInterval(() => {
      sequence += 1;
      if (scenario === 'offline' && sequence % 4 === 0) {
        publishJson(client, `agrios/device/${deviceCode}/status`, buildStatus(false));
        return;
      }
      publishJson(client, `agrios/device/${deviceCode}/status`, buildStatus(true));
      publishJson(client, `agrios/device/${deviceCode}/telemetry`, buildTelemetry(sequence));
    }, intervalMs);
  });

  client.on('error', (error) => {
    console.error(`[P13 MQTT simulator] error: ${error.message}`);
  });
}

main();

