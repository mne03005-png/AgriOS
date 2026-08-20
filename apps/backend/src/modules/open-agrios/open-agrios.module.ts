import { Module } from '@nestjs/common';
import { OpenAgriosMqttService } from './open-agrios-mqtt.service';
import { OpenAgriosPublicController } from './open-agrios-public.controller';

// OpenAgriOS v0.1-alpha: the demo telemetry pipeline (MQTT ingestion + public read API). See
// docs/AUDIT.md for why this is a new module rather than an extension of the existing MqttModule
// or the JWT-gated Farm/Field/Device/IoT controllers.
@Module({
  controllers: [OpenAgriosPublicController],
  providers: [OpenAgriosMqttService]
})
export class OpenAgriosModule {}
