import { PartialType } from '@nestjs/mapped-types';
import { CreateFarmInputDto } from './create-farm-input.dto';

export class UpdateFarmInputDto extends PartialType(CreateFarmInputDto) {}
