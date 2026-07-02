import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const VALVE_COMMAND_TYPES = ['OPEN', 'CLOSE', 'SET_OPENING', 'READ_STATUS', 'TEST_OPEN'] as const;
export type ValveCommandType = (typeof VALVE_COMMAND_TYPES)[number];

export const VALVE_ACK_STATUSES = ['ACCEPTED', 'REJECTED', 'EXECUTING', 'ACKED', 'FAILED', 'TIMEOUT'] as const;
export type ValveAckStatus = (typeof VALVE_ACK_STATUSES)[number];

export const VALVE_STATUSES = ['OPEN', 'CLOSED', 'OPENING', 'CLOSING', 'UNKNOWN', 'ERROR'] as const;
export type ValveStatus = (typeof VALVE_STATUSES)[number];

export class ValveCommandRequest {
  @IsString()
  commandId!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  farmId!: string;

  @IsOptional()
  @IsString()
  fieldId?: string;

  @IsString()
  deviceId!: string;

  @IsString()
  deviceCode!: string;

  @IsIn(VALVE_COMMAND_TYPES)
  commandType!: ValveCommandType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  openingPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  testDurationSeconds?: number;

  @IsString()
  requestedBy!: string;

  @IsBoolean()
  dryRun!: boolean;

  @IsString()
  requestedAt!: string;

  @IsInt()
  @Min(1000)
  timeoutMs!: number;
}

export class ValveCommandAck {
  @IsString()
  commandId!: string;

  @IsString()
  deviceId!: string;

  @IsBoolean()
  accepted!: boolean;

  @IsIn(VALVE_ACK_STATUSES)
  status!: ValveAckStatus;

  @IsOptional()
  @IsIn(VALVE_STATUSES)
  valveStatus?: ValveStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valveOpeningPercent?: number;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsString()
  timestamp!: string;
}

export class ValveFeedbackDto {
  @IsString()
  commandId!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceCode?: string;

  @IsOptional()
  @IsIn(VALVE_STATUSES)
  valveStatus?: ValveStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valveOpeningPercent?: number;

  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  errorCode?: string | null;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class SetValveOpeningDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  openingPercent!: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class TestOpenValveDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  testDurationSeconds?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ValveDryRunDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
