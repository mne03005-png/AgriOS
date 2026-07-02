import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DigitalTwinService } from './digital-twin.service';
import { PreviewFieldDto } from './dto/preview-field.dto';

@ApiTags('P11 数字孪生')
@Controller('digital-twin')
export class DigitalTwinController {
  constructor(private readonly digitalTwinService: DigitalTwinService) {}

  @Post('fields/:fieldId/preview')
  @ApiOkResponse({ description: '地块灌溉 What-if 预览' })
  preview(@Param('fieldId') fieldId: string, @Body() dto: PreviewFieldDto) {
    return this.digitalTwinService.previewField(fieldId, dto);
  }
}
