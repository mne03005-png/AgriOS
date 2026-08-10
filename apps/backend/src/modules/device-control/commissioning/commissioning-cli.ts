import { ConfigService } from '@nestjs/config';
import { ModbusTcpTransport } from '../transports/modbus-tcp.transport';
import { PlcProfileValidator } from './plc-profile.validator';

export class CommissioningCli {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async run(argv: string[]) {
    const [command = 'status', ...args] = argv;
    this.rejectForbiddenCommand(command, args);
    if (command === 'status' || command === 'show-safety-gates') return this.status();
    if (command === 'profile') {
      if (args[0] === 'validate') return this.validateProfile(this.required(args[1], 'PROFILE_PATH_REQUIRED'));
      throw new Error('USAGE: profile validate <path>');
    }
    if (command === 'show-profile') return this.showProfile(this.required(args[0], 'PROFILE_PATH_REQUIRED'));
    if (command === 'generate-evidence') return this.generateEvidence(this.required(args[0], 'PROFILE_PATH_REQUIRED'));
    if (command === 'connection-check' || command === 'read-health') return this.connectionCheck();
    if (['read-discrete-input', 'read-coil', 'read-holding-register', 'read-input-register'].includes(command)) {
      return this.read(command, this.required(args[0], 'PROFILE_PATH_REQUIRED'), this.required(args[1], 'LOGICAL_NAME_REQUIRED'));
    }
    throw new Error(`UNKNOWN_READ_ONLY_COMMAND: ${command}`);
  }

  status(profileStatus: PlcProfileValidationSummary = { status: 'NOT_LOADED', sha256: 'NOT_LOADED' }) {
    return {
      controlMode: this.env.DEVICE_CONTROL_MODE ?? 'MOCK', dryRun: this.env.DEVICE_CONTROL_DRY_RUN ?? 'true',
      plcTransport: this.env.PLC_TRANSPORT ?? 'FAKE', realWriteEnabled: this.env.PLC_REAL_WRITE_ENABLED ?? 'false',
      profileStatus: profileStatus.status, profileSHA256: profileStatus.sha256,
      targetHost: this.env.PLC_MODBUS_HOST ?? '127.0.0.1', targetPort: this.env.PLC_MODBUS_PORT ?? '502',
      unitId: this.env.PLC_MODBUS_UNIT_ID ?? 'UNCONFIRMED', readOnly: true, realWrite: 'DISABLED'
    };
  }

  private async validateProfile(path: string) {
    const result = await new PlcProfileValidator().validateFile(path);
    return { ...this.status({ status: result.realProfileValid ? 'VALID' : result.schemaValid ? 'TEST_ONLY' : 'INVALID / INCOMPLETE', sha256: result.sha256 }), validation: this.publicValidation(result) };
  }

  private async showProfile(path: string) {
    const result = await new PlcProfileValidator().validateFile(path);
    return { profileName: result.profileName, profileSHA256: result.sha256, schemaValid: result.schemaValid, realProfileValid: result.realProfileValid, mappingCount: Array.isArray(result.profile?.mapping) ? result.profile.mapping.length : 0 };
  }

  private async generateEvidence(path: string) {
    const result = await new PlcProfileValidator().validateFile(path);
    return { runId: `commissioning-${Date.now()}`, generatedAt: new Date().toISOString(), target: 'FAKE', ...this.status({ status: result.realProfileValid ? 'VALID' : 'INVALID / INCOMPLETE', sha256: result.sha256 }), validation: this.publicValidation(result) };
  }

  private async connectionCheck() {
    this.assertLoopback();
    const transport = new ModbusTcpTransport(new ConfigService(this.safeTransportConfig()));
    try { await transport.connect(); return { ...(await transport.healthCheck()), target: 'FAKE', readOnly: true }; }
    finally { await transport.disconnect(); }
  }

  private async read(command: string, path: string, logicalName: string) {
    this.assertLoopback();
    const validation = await new PlcProfileValidator().validateFile(path);
    if (!validation.schemaValid || validation.profile?.testOnly !== true || validation.profile?.realHardwareApproved === true) throw new Error('READ_REQUIRES_VALID_TEST_ONLY_PROFILE');
    const point = validation.profile.mapping.find((item: any) => item.logicalName === logicalName);
    if (!point) throw new Error('LOGICAL_POINT_NOT_FOUND');
    const transport = new ModbusTcpTransport(new ConfigService({ ...this.safeTransportConfig(), PLC_MODBUS_UNIT_ID: String(validation.profile.transport.unitId) }));
    await transport.connect();
    try {
      const methods: Record<string, (address: number) => Promise<unknown>> = {
        'read-discrete-input': (address) => transport.readDiscreteInput(address), 'read-coil': (address) => transport.readCoil(address),
        'read-holding-register': (address) => transport.readHoldingRegister(address), 'read-input-register': (address) => transport.readInputRegister(address)
      };
      return { logicalName, value: await methods[command](point.address), profileSHA256: validation.sha256, target: 'FAKE', readOnly: true };
    } finally { await transport.disconnect(); }
  }

  private safeTransportConfig() {
    return { ...this.env, DEVICE_CONTROL_MODE: 'MOCK', DEVICE_CONTROL_DRY_RUN: 'true', VALVE_ALLOW_REAL_CONTROL: 'false', ENABLE_AUTO_EXECUTION: 'false', PLC_TRANSPORT: 'FAKE', PLC_REAL_WRITE_ENABLED: 'false' };
  }
  private assertLoopback() { if (!['127.0.0.1', 'localhost', '::1'].includes(this.env.PLC_MODBUS_HOST ?? '127.0.0.1')) throw new Error('P0_COMMISSIONING_LOOPBACK_ONLY'); }
  private rejectForbiddenCommand(command: string, args: string[]) {
    const text = [command, ...args].join(' ').toLowerCase();
    if (/(write|pump-start|pump-stop|valve-open|valve-close|--force|--unsafe|--yes|--real)/.test(text)) throw new Error('READ_ONLY_COMMAND_FORBIDDEN');
  }
  private required(value: string | undefined, code: string) { if (!value) throw new Error(code); return value; }
  private publicValidation(result: any) { return { schemaValid: result.schemaValid, realProfileValid: result.realProfileValid, errors: result.errors, profileName: result.profileName, sha256: result.sha256 }; }
}

type PlcProfileValidationSummary = { status: string; sha256: string };
