import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './modules/auth/public.decorator';

@ApiTags('system')
@Controller()
export class AppController {
  @Public()
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
