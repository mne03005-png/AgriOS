import { PartialType } from '@nestjs/swagger';
import { CreateRotationGroupDto } from './create-rotation-group.dto';

export class UpdateRotationGroupDto extends PartialType(CreateRotationGroupDto) {}
