import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DecisionService } from './decision.service';
import { RunDecisionRequestDto } from './dto/run-decision-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('Decision')
@Controller('decision')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.ACTION_EXECUTE)
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  @ApiOkResponse({ description: 'Run decision and return field state, strategy, and action plan' })
  @Post('run')
  run(@Body() dto: RunDecisionRequestDto) {
    return this.decisionService.run(dto);
  }
}
