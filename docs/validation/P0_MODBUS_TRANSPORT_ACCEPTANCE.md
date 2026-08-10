# P0 Modbus TCP transport acceptance

Date: 2026-08-10

## Scope and result

- Primary bench PLC selected: Siemens LOGO! 8.4 12/24RCE, order number `6ED1052-1MD08-0BA2`.
- Runtime boundary: `PlcGatewayDeviceController → PlcTransportPort → ModbusTcpTransport`.
- `DeviceControlService` does not import or know Modbus.
- Library: `modbus-serial@8.0.25`, ISC license. It supplies the protocol client/server implementation; AgriOS does not implement Modbus frames itself.
- UC300 profile abstraction remains, but no UC300-specific real transport was developed.
- UG65 CN470 uses its Embedded Network Server with MQTT(S); ChirpStack is not required for P0.

## Safety gates

Every Modbus write requires all six values simultaneously:

1. `DEVICE_CONTROL_MODE=PLC_GATEWAY`
2. `DEVICE_CONTROL_DRY_RUN=false`
3. `VALVE_ALLOW_REAL_CONTROL=true`
4. `ENABLE_AUTO_EXECUTION=true`
5. `PLC_TRANSPORT=MODBUS_TCP`
6. `PLC_REAL_WRITE_ENABLED=true`

Defaults remain `MOCK`, dry-run, auto execution off, fake transport, and real writes off. Reads and connection configuration are separate, but no production or real PLC address was contacted during acceptance.

## Profile and addressing

`logo-8.4.example.json` contains logical points only. Every unit ID, coil, discrete input and register address is `null`; no Siemens address was inferred. Code rejects an incomplete real profile.

The test suite uses clearly labelled in-memory `TEST_ONLY` addresses against a localhost fake Modbus TCP server. These values are protocol fixtures and are not a LOGO! address map.

## Verification

The local suite covers 18 required scenarios: connect, connect timeout, reconnect, DI/coil/register reads, coil/register writes, wrong unit, invalid address, command timeout, disconnect, duplicate command, STOP priority, emergency stop, feedback mismatch, valve/pump interlock, and pump-stop/valve-close sequencing.

## Acceptance flags

- `REAL LOGO CONNECTED = NO`
- `REAL MODBUS WRITE = NO`
- `FAKE MODBUS SERVER = YES`
- `TRANSPORT IMPLEMENTED = YES`
- `REAL PLC READY = NO`

Before real commissioning obtain the physical nameplate, exact firmware, LOGO!Soft Comfort project, enabled Modbus access configuration, Siemens official address mapping for that project, signed wiring diagram, and feedback semantics.
