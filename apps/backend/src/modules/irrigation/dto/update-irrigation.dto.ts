import { PartialType } from '@nestjs/mapped-types';
import { CreateIrrigationDto } from './create-irrigation.dto';

export class UpdateIrrigationDto extends PartialType(CreateIrrigationDto) {}
