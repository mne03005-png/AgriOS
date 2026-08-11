import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RunExecutionDto } from './dto/run-execution.dto';
import { ExecutionService } from './execution.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('P11 自主执行')
@Controller('execution')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.ACTION_EXECUTE)
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('run')
  @ApiOkResponse({ description: '执行手动/辅助/自动设备动作' })
  run(@Body() dto: RunExecutionDto) {
    return this.executionService.run(dto);
  }
}
