import { PartialType } from '@nestjs/swagger';
import { CreateDroneOperationDto } from './create-drone-operation.dto';

export class UpdateDroneOperationDto extends PartialType(CreateDroneOperationDto) {}
