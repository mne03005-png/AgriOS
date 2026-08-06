import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token returned by login or a previous refresh' })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
