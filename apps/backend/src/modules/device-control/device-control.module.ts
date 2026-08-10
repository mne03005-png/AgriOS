import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DeviceModule } from '../device/device.module';
import { DeviceControlController } from './device-control.controller';
import { DeviceControlService } from './device-control.service';
import { ValveControlService } from './valve-control.service';
import { MockDeviceController } from './adapters/mock-device-controller';
import { MqttDeviceController } from './adapters/mqtt-device-controller';
import { ThingsboardDeviceController } from './adapters/thingsboard-device-controller';
import { EdgeHttpDeviceController } from './adapters/edge-http-device-controller';
import { PlcGatewayDeviceController } from './adapters/plc-gateway-device-controller';
import { BluetoothLocalDeviceController } from './adapters/bluetooth-local-device-controller';
import { ModbusTcpTransport } from './transports/modbus-tcp.transport';

@Module({
  imports: [AuditModule, AuthModule, DeviceModule],
  controllers: [DeviceControlController],
  providers: [
    DeviceControlService,
    ValveControlService,
    MockDeviceController,
    MqttDeviceController,
    ThingsboardDeviceController,
    EdgeHttpDeviceController,
    PlcGatewayDeviceController,
    BluetoothLocalDeviceController,
    ModbusTcpTransport
  ],
  exports: [DeviceControlService, ValveControlService]
})
export class DeviceControlModule {}
