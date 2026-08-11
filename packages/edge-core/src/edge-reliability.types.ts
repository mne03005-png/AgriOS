export type EdgePriority = 'CRITICAL' | 'CONTROL' | 'TELEMETRY' | 'BACKGROUND';
export type EdgeQueueStatus = 'PENDING' | 'SENDING' | 'ACKNOWLEDGED' | 'FAILED' | 'EXPIRED';
export type EdgeTelemetryQuality = 'GOOD' | 'DUPLICATE' | 'OUT_OF_ORDER' | 'LATE' | 'INVALID_TIMESTAMP' | 'MISSING_SEQUENCE';

export interface EdgeTelemetryEnvelope {
  messageId: string;
  edgeId: string;
  deviceId: string;
  tenantId: string;
  farmId: string;
  deviceTimestamp: string;
  edgeReceivedAt: string;
  sequence?: number;
  payload: Record<string, unknown>;
  quality: EdgeTelemetryQuality;
  priority: EdgePriority;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  status: EdgeQueueStatus;
}

export interface EdgeCommandRecord {
  commandId: string;
  edgeId: string;
  deviceId: string;
  tenantId: string;
  farmId: string;
  action: string;
  expiresAt: string;
  receivedAt: string;
  executedAt?: string;
  result?: Record<string, unknown>;
  ackStatus: EdgeQueueStatus;
}

export interface EdgeAckRecord {
  commandId: string;
  edgeId: string;
  deviceId: string;
  tenantId: string;
  farmId: string;
  status: string;
  feedback?: Record<string, unknown>;
  timestamp: string;
  signatureMetadata?: { algorithm: string; keyId?: string };
  priority: 'CRITICAL' | 'CONTROL';
  attemptCount: number;
  lastAttemptAt?: string;
  queueStatus: EdgeQueueStatus;
}

export interface EdgePersistentState {
  version: 1;
  telemetry: EdgeTelemetryEnvelope[];
  commands: EdgeCommandRecord[];
  acks: EdgeAckRecord[];
  lastSequence: Record<string, number>;
  lastSuccessfulUpload?: string;
  lastCommandReceived?: string;
  lastAckUploaded?: string;
}
