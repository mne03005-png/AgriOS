import { OmitType } from '@nestjs/swagger';
import { ImportDroneOperationDto } from './import-drone-operation.dto';

export class CreateDroneOperationDto extends OmitType(ImportDroneOperationDto, ['fileName', 'fileType'] as const) {}
