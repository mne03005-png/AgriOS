import { Module } from '@nestjs/common';
import { CropRecipeController } from './crop-recipe.controller';
import { CropRecipeService } from './crop-recipe.service';

@Module({
  controllers: [CropRecipeController],
  providers: [CropRecipeService],
  exports: [CropRecipeService]
})
export class CropRecipeModule {}
