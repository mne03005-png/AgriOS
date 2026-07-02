import { PartialType } from '@nestjs/swagger';
import { CreateSafetyPolicyDto } from './create-safety-policy.dto';

export class UpdateSafetyPolicyDto extends PartialType(CreateSafetyPolicyDto) {}
