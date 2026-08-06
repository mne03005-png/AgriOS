import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ReauthenticateDto {
  @ApiProperty({ description: 'Current account password' })
  @IsString()
  @MinLength(8)
  password!: string;
}
