import { PartialType } from '@nestjs/swagger';
import { CreateCropIrrigationRecipeDto } from './create-crop-irrigation-recipe.dto';

export class UpdateCropIrrigationRecipeDto extends PartialType(CreateCropIrrigationRecipeDto) {}
