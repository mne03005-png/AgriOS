import { PartialType } from '@nestjs/swagger';
import { CreateIrrigationDesignDto } from './create-irrigation-design.dto';

export class UpdateIrrigationDesignDto extends PartialType(CreateIrrigationDesignDto) {}
