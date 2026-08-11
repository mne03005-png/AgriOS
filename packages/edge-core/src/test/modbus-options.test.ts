import { strict as assert } from 'node:assert';
import test from 'node:test';
import { CoreModbusTcpTransport, ModbusTcpOptions, validateModbusTcpOptions } from '../modbus-tcp.transport';

const valid: ModbusTcpOptions = {
  host: '127.0.0.1',
  port: 502,
  unitId: 1,
  connectTimeoutMs: 2_000,
  commandTimeoutMs: 2_000,
  retry: 1
};

test('1 valid options pass shared validation', () => {
  assert.equal(validateModbusTcpOptions(valid), valid);
});

const invalidCases: Array<[string, Partial<ModbusTcpOptions>]> = [
  ['2 port 0', { port: 0 }],
  ['3 port 65536', { port: 65536 }],
  ['4 port NaN', { port: Number.NaN }],
  ['5 unitId -1', { unitId: -1 }],
  ['6 unitId 256', { unitId: 256 }],
  ['7 retry -1', { retry: -1 }],
  ['8 retry 6', { retry: 6 }],
  ['9 connect timeout 0', { connectTimeoutMs: 0 }],
  ['10 connect timeout -1', { connectTimeoutMs: -1 }],
  ['11 connect timeout NaN', { connectTimeoutMs: Number.NaN }],
  ['12 connect timeout 60001', { connectTimeoutMs: 60001 }],
  ['13 command timeout 0', { commandTimeoutMs: 0 }],
  ['14 command timeout -1', { commandTimeoutMs: -1 }],
  ['15 command timeout NaN', { commandTimeoutMs: Number.NaN }],
  ['16 command timeout 60001', { commandTimeoutMs: 60001 }],
  ['17 fractional timeout', { commandTimeoutMs: 1.5 }],
  ['18 empty host', { host: '   ' }]
];

for (const [name, override] of invalidCases) {
  test(`${name} rejects before connect`, async () => {
    let connectCalls = 0;
    const transport = new CoreModbusTcpTransport(() => ({ ...valid, ...override }), () => false);
    (transport as any).client.connectTCP = async () => { connectCalls += 1; };
    await assert.rejects(
      () => transport.connect(),
      (error: any) => error?.response?.errorCode === 'INVALID_MODBUS_OPTIONS'
    );
    assert.equal(connectCalls, 0);
  });
}
