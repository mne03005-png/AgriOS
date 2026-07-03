# Emergency Device Control Stop

Current production safety posture must remain:

```text
DEVICE_CONTROL_MODE=MOCK
DEVICE_CONTROL_DRY_RUN=true
VALVE_ALLOW_REAL_CONTROL=false
ENABLE_AUTO_EXECUTION=false
```

Verify through readiness:

```bash
curl -s https://agrios-api.xyzwtt.com/api/v1/health/ready
```

Emergency stop options:

1. Keep the four safety switches above unchanged.
2. Stop `agrios-backend` if the API must be halted:

   ```bash
   pm2 stop agrios-backend
   pm2 save
   ```

3. If future MQTT or HTTP control channels are enabled, disconnect those channels at their broker/gateway layer and keep backend dry-run enabled.

Do not delete databases or business data to stop device control.
