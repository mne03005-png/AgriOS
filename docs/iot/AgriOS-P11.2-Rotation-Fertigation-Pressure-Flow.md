# AgriOS P11.2 Rotation, Fertigation, Pressure and Flow

P11.2 adds backend foundations for irrigation rotation groups, normalized pressure/flow telemetry, fertigation tasks, operation reports, and farm activity timeline.

## Scope

- AgriOS keeps owning farm business records, approvals, safety, action queue, and audit trails.
- ThingsBoard/Webhook ingestion remains compatible. P11.2 only adds normalized snapshots beside existing telemetry records.
- Pump, valve, fertigation, and dissolving commands still go through DeviceControl and ActionQueue.
- This stage does not enable default automatic pump or valve execution.

## New Capabilities

- Irrigation rotation groups: group valves by field/design and start a rotation run.
- Normalized telemetry: pressureKpa, flowRateM3h, valveOpeningPercent, pumpFrequencyHz, pumpRunningStatus, fertilizerTankLevelL, waterTankLevelL, batteryPercent, signalStrength.
- Irrigation monitoring: configurable anomaly rules for pressure, flow, valve, pump, and tank level.
- Fertigation: fertilizer tanks, recipes, fertigation tasks, and dissolve fertilizer tasks.
- Operation reports: generated summaries for irrigation, fertigation, rotation, device inspection, and anomaly records.
- Farm activity timeline: key events written for mobile cockpit and field history.

## Important Safety Rule

Starting a rotation group or fertigation task does not directly control hardware. The backend creates:

1. DecisionRecord
2. ActionPlan
3. ActionQueueJob
4. EventLog
5. UsageRecord
6. FarmActivity

DeviceControl remains the final execution abstraction, and existing safety/action queue checks remain in front of physical execution.

## API Examples

Create rotation group:

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-rotation/groups \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"fieldId\":\"field_001\",\"name\":\"洋葱地A轮灌组\",\"targetPressureKpa\":180,\"targetFlowRate\":12.5}"
```

Add valve:

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-rotation/groups/{groupId}/valves \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"device_valve_001\",\"fieldId\":\"field_001\",\"valveOrder\":1,\"targetOpeningPercent\":80,\"maxIrrigationMinutes\":30}"
```

Start rotation:

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-rotation/groups/{groupId}/start \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"人工确认后开始轮灌\"}"
```

Create anomaly rule:

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-monitoring/rules \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"name\":\"主管压力过低\",\"type\":\"PRESSURE_DROP\",\"thresholdJson\":{\"min\":120,\"severity\":\"HIGH\"}}"
```

Query device latest telemetry:

```bash
curl http://localhost:3000/api/v1/iot/devices/{deviceId}/telemetry/latest
```

Create fertilizer tank:

```bash
curl -X POST http://localhost:3000/api/v1/fertigation/tanks \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"name\":\"洋葱地A水溶肥罐1\",\"capacityL\":500,\"currentLevelL\":320,\"fertilizerType\":\"高钾水溶肥\"}"
```

Create fertigation task:

```bash
curl -X POST http://localhost:3000/api/v1/fertigation/tasks \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"fieldId\":\"field_001\",\"tankId\":\"tank_001\",\"durationMinutes\":45,\"targetWaterVolume\":1200,\"targetFertilizerVolume\":80}"
```

Start fertigation task:

```bash
curl -X POST http://localhost:3000/api/v1/fertigation/tasks/{taskId}/start \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"人工确认液位后执行\"}"
```

Generate operation report:

```bash
curl -X POST http://localhost:3000/api/v1/operation-reports/generate \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"type\":\"FERTIGATION\",\"title\":\"水肥作业日报\"}"
```

Query farm activities:

```bash
curl "http://localhost:3000/api/v1/farm-activities?farmId=farm_001"
```

## Mobile API Enhancements

- `/api/v1/mobile/cockpit`: pressureSummary, flowSummary, pumpStatus, fertigationStatus, tankLevelWarnings, activeRotationRuns, latestActivities.
- `/api/v1/mobile/map`: rotationGroups, fertilizerTanks, fertigationDevices, pressureSensors, flowMeters.
- `/api/v1/mobile/operations`: actionPlans, rotationRuns, fertigationTasks, dissolveTasks, pumpOperations.
- `/api/v1/mobile/alerts`: safetyAlerts and irrigation anomalies.
- `/api/v1/mobile/reports/summary`: irrigation volume, fertigation task summary, pressure/flow anomaly counts, rotation success rate.

## Database Additions

- DeviceTelemetrySnapshot
- IrrigationRotationGroup
- IrrigationRotationValve
- IrrigationRotationSchedule
- IrrigationRotationRun
- IrrigationAnomalyRule
- IrrigationAnomalyEvent
- FertilizerTank
- FertigationRecipe
- FertigationTask
- DissolveFertilizerTask
- OperationReport
- FarmActivity
- SensorRecord.normalizedJson
