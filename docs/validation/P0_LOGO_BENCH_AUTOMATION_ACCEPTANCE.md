# P0-5 LOGO! Bench Automation Acceptance

## Scope and safety boundary

P0-5 converts the pre-hardware bench plan into an executable, fake-only validation package. It does not contain or infer Siemens LOGO! I/Q/M/V/VM or Modbus addresses. The repository defaults remain `DEVICE_CONTROL_MODE=MOCK`, dry-run enabled, automatic execution disabled, fake PLC transport selected, and real PLC writes disabled.

- REAL LOGO CONNECTED = NO
- REAL MODBUS WRITE = NO
- REAL HARDWARE ENABLED = NO
- LOGO REAL MODBUS ADDRESS = UNCONFIRMED

## Implemented components

- `agrios-plc-commissioning`: read-only CLI for status, profile validation/display, loopback connection and health checks, mapped reads, safety-gate display, and sanitized evidence generation.
- `PlcProfileValidator`: strict validation and SHA-256 hashing. Missing identity, transport, source, mapping, scale, feedback semantics, or verification data fails closed. Example/test-only profiles can never become real-hardware-valid.
- `verify-p0-logo-bench-automation.ts`: 100-cycle fake-controller acceptance runner and machine-readable JSON plus Markdown evidence generator.
- Existing P0 PLC and P0 Modbus suites remain the protocol/control regression source. Modbus traffic is restricted to a fake server on `127.0.0.1`.

No new dependency was introduced.

## Commissioning CLI

Commands:

- `status`
- `profile validate <profile.json>`
- `connection-check`
- `read-health`
- `read-discrete-input <profile.json> <logicalName>`
- `read-coil <profile.json> <logicalName>`
- `read-holding-register <profile.json> <logicalName>`
- `read-input-register <profile.json> <logicalName>`
- `show-safety-gates`
- `show-profile <profile.json>`
- `generate-evidence <profile.json>`

The CLI has no write, pump, or valve command. `--force`, `--unsafe`, `--yes`, and `--real` are rejected. Network operations reject non-loopback targets. Output excludes passwords, tokens, HMAC/JWT/MQTT secrets, and environment-file contents.

## Automated results and gates

The 100-cycle distribution is 20 valve cycles, 20 pump cycles, 10 duplicate deliveries, 10 delayed ACKs, 10 timeouts, 10 disconnect/reconnect cases, and five each for emergency stop, no-water, overload, and feedback mismatch.

Acceptance requires all of the following:

- Tests: at least 100; failures: 0
- Duplicate physical execution: 0
- Unsafe pump start: 0
- Lost STOP command: 0
- Unhandled timeout: 0
- Invalid ACK accepted: 0
- Expired command executed: 0
- Profile gate bypass: 0
- Real hardware connections: 0
- Real Modbus writes: 0

The runner also verifies expiry boundaries, valve-open/pump-start and pump-stop/valve-close interlocks, E-stop blocking, STOP safe-state availability, ACK tenant/farm/device/command correlation, test-profile exclusion from REAL mode, and CLI bypass rejection. The existing P0 Modbus suite covers connect/command timeout, disconnect/reconnect, invalid unit/address, and fake-only Modbus reads/writes.

ACK results in this historical automation report are software/test acknowledgements. They are not evidence of real physical completion; Batch 3 requires separately verified profile-backed state before business completion.

Evidence is written beneath `artifacts/validation/` as JSON and Markdown. It records the Git revision, branch, profile hash, fake target, per-cycle timings/results, and aggregate safety metrics. It contains no secret material.

## Remaining real-hardware evidence

Before a real profile or any real write can be enabled, commissioning still requires the physical nameplate and exact part number, hardware and firmware versions, LOGO!Soft Comfort version and backed-up project, official Modbus manual/version, enabled server mode and confirmed unit ID, actual I/O layout, and a manually cross-checked Modbus mapping including scale and feedback semantics.

P0-5 therefore closes the software preparation package only; real PLC readiness remains **NO** until those artifacts and explicit approval exist.
