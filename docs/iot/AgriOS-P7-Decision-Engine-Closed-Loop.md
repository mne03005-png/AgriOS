# AgriOS P7 Decision Engine And Closed-loop IoT Execution

P7 adds the backend decision layer on top of existing ThingsBoard telemetry ingestion.

## Boundary

- Existing IoT webhook ingestion is not changed.
- ThingsBoard remains the device and telemetry base.
- AgriOS reads persisted sensor/device/field data and creates decisions.
- Action execution is explicit through API or `autoExecute=true`.
- No frontend page is included.

## Pipeline

```text
Sensor telemetry -> SensorRecord -> FieldStateSnapshot -> DecisionRecord -> ActionPlan -> ActionExecution -> DeviceCommand/MQTT -> Feedback
```

## Engines

- Field State Engine: builds a field state snapshot from latest telemetry, current crop season, and device health.
- Strategy Engine: evaluates irrigation/device risk strategy using explainable rules.
- Action Planner: converts a decision into executable device commands.
- Action Executor: sends commands through existing DeviceService/MQTT and records execution.
- Decision Engine: orchestrates the full pipeline.

## API Examples

Run decision without execution:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/run \
  -H "Content-Type: application/json" \
  -d "{\"autoExecute\":false,\"source\":\"MANUAL_TEST\"}"
```

Run decision and execute planned actions:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/run \
  -H "Content-Type: application/json" \
  -d "{\"autoExecute\":true,\"source\":\"CLOSED_LOOP_TEST\"}"
```

Execute an existing action plan:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/action-plans/{id}/execute \
  -H "Content-Type: application/json" \
  -d "{\"force\":false}"
```

Submit execution feedback:

```bash
curl -X PATCH http://localhost:3000/api/v1/decision-engine/action-executions/{id}/feedback \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"ACKED\",\"message\":\"Pump started and confirmed\"}"
```

Query decisions:

```bash
curl http://localhost:3000/api/v1/decision-engine/decisions
curl http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/state/latest
```

## First strategy rules

- `soilMoisture < 35`: recommend `SHOULD_IRRIGATE`.
- `soilMoisture > 60`: recommend `STOP_IRRIGATION`.
- otherwise: recommend `NO_ACTION`.
- if no soil moisture telemetry exists: recommend device check when devices are offline.

## Execution safety

The first P7 backend version does not modify telemetry ingestion and does not run a scheduler. It supports explicit closed-loop execution by API. Operators can run with `autoExecute=false` to inspect the decision and plan before sending commands.
