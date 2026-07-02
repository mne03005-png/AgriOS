import { PartialType } from '@nestjs/swagger';
import { CreateFertilizerTankDto } from './create-fertilizer-tank.dto';

export class UpdateFertilizerTankDto extends PartialType(CreateFertilizerTankDto) {}
