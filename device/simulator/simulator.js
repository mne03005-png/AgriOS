// OpenAgriOS v0.1-alpha sensor simulator.
//
// Publishes the canonical telemetry payload every 5 seconds to a versioned MQTT topic, so the
// full pipeline (Sensor Simulator -> MQTT Broker -> Backend -> Database -> Dashboard) can be
// demonstrated with zero physical hardware. See docs/mqtt-spec.md for the topic/payload contract.
const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const farmId = process.env.FARM_ID || 'openagrios-demo-farm';
const fieldId = process.env.FIELD_ID || 'openagrios-demo-field-01';
const deviceId = process.env.DEVICE_ID || 'sensor-001';
const intervalMs = Number(process.env.INTERVAL_MS || 5000);
// normal: gentle fluctuation, always online.
// offline: periodically stops publishing to exercise the backend's offline detection.
const scenario = process.env.SCENARIO || 'normal';

const baseline = { soilMoisture: 35, temperature: 28, humidity: 70 };
let battery = 95;
let tick = 0;

function topic() {
  return `agrios/v1/farm/${farmId}/device/${deviceId}/telemetry`;
}

function nextReading() {
  tick += 1;
  // Slow battery drain with a floor, so a long-running demo can still show a low-battery alert.
  battery = Math.max(5, Number((battery - 0.02).toFixed(2)));
  return {
    deviceId,
    fieldId,
    timestamp: new Date().toISOString(),
    status: 'online',
    data: {
      soilMoisture: Number((baseline.soilMoisture + Math.sin(tick / 6) * 4).toFixed(1)),
      temperature: Number((baseline.temperature + Math.sin(tick / 9) * 3).toFixed(1)),
      humidity: Number((baseline.humidity + Math.sin(tick / 7) * 5).toFixed(1)),
      battery
    }
  };
}

function main() {
  const client = mqtt.connect(brokerUrl, { clientId: `openagrios-simulator-${deviceId}-${Date.now()}` });

  client.on('connect', () => {
    console.log(`[OpenAgriOS simulator] connected to ${brokerUrl}, publishing ${topic()} every ${intervalMs}ms (scenario=${scenario})`);

    setInterval(() => {
      if (scenario === 'offline' && tick > 0 && tick % 12 === 0) {
        console.log('[OpenAgriOS simulator] simulating an offline gap — no message this tick');
        tick += 1;
        return;
      }
      const reading = nextReading();
      client.publish(topic(), JSON.stringify(reading));
      console.log(`[OpenAgriOS simulator] published: soilMoisture=${reading.data.soilMoisture}% temperature=${reading.data.temperature}C humidity=${reading.data.humidity}% battery=${reading.data.battery}%`);
    }, intervalMs);
  });

  client.on('error', (error) => {
    console.error(`[OpenAgriOS simulator] MQTT error: ${error.message}`);
  });
}

main();
