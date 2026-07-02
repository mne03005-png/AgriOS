import { PartialType } from '@nestjs/swagger';
import { CreateFieldBoundaryDto } from './create-field-boundary.dto';

export class UpdateFieldBoundaryDto extends PartialType(CreateFieldBoundaryDto) {}
