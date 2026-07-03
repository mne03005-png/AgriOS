import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @Allow()
  currentPassword!: string;

  @ApiProperty({ description: 'New password' })
  @Allow()
  newPassword!: string;
}
