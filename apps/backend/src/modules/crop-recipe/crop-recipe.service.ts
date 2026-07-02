import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCropIrrigationRecipeDto } from './dto/create-crop-irrigation-recipe.dto';
import { UpdateCropIrrigationRecipeDto } from './dto/update-crop-irrigation-recipe.dto';

@Injectable()
export class CropRecipeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCropIrrigationRecipeDto) {
    return (this.prisma as any).cropIrrigationRecipe.create({ data: { ...dto, isActive: dto.isActive ?? true } });
  }

  findAll(query: Record<string, unknown> = {}) {
    return (this.prisma as any).cropIrrigationRecipe.findMany({
      where: {
        ...(typeof query.cropType === 'string' ? { cropType: query.cropType } : {}),
        ...(typeof query.cropStage === 'string' ? { cropStage: query.cropStage } : {}),
        ...(typeof query.soilType === 'string' ? { soilType: query.soilType } : {}),
        isActive: query.includeInactive === 'true' ? undefined : true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async match(input: { cropType?: string; cropStage?: string; soilType?: string }) {
    if (!input.cropType || !input.cropStage) return null;
    return (this.prisma as any).cropIrrigationRecipe.findFirst({
      where: {
        cropType: input.cropType,
        cropStage: input.cropStage,
        isActive: true,
        OR: [{ soilType: input.soilType }, { soilType: null }]
      },
      orderBy: [{ soilType: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async update(id: string, dto: UpdateCropIrrigationRecipeDto) {
    const existing = await (this.prisma as any).cropIrrigationRecipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Crop irrigation recipe not found');
    return (this.prisma as any).cropIrrigationRecipe.update({ where: { id }, data: dto });
  }
}
