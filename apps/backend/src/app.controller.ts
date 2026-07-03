import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'AgriOS API information' })
  getApiInfo() {
    return {
      name: 'AgriOS API',
      status: 'running',
      version: '0.1.0',
      documentation: '/api/docs',
      health: {
        live: '/api/v1/health/live',
        ready: '/api/v1/health/ready'
      }
    };
  }
}
