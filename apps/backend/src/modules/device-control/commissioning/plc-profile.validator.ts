import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalPlcLogicalName, expectedFeedbackLogicalName, findPlcMappingByLogicalName, isReadCapableMapping, isSupportedFeedbackMapping, isWriteCapableMapping, PlcProfileMapping } from '@agrios/edge-core';

export interface PlcProfileValidation {
  schemaValid: boolean;
  realProfileValid: boolean;
  errors: string[];
  profileName: string;
  sha256: string;
  profile?: Record<string, any>;
}

const requiredText = ['profileVersion', 'vendor', 'family', 'model', 'partNumber', 'hardwareVersion', 'firmwareVersion'] as const;
const mappingText = ['logicalName', 'type', 'functionCode', 'dataType', 'unit', 'readWrite', 'failSafeState'] as const;

export class PlcProfileValidator {
  async validateFile(path: string) {
    const content = await readFile(path);
    return this.validate(content);
  }

  validate(content: Buffer | string): PlcProfileValidation {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let profile: Record<string, any>;
    try { profile = JSON.parse(bytes.toString('utf8')); }
    catch { return { schemaValid: false, realProfileValid: false, errors: ['INVALID_JSON'], profileName: 'UNKNOWN', sha256 }; }

    const errors: string[] = [];
    for (const field of requiredText) if (!this.confirmedText(profile[field])) errors.push(`MISSING_OR_UNCONFIRMED_${field}`);
    const transport = profile.transport;
    if (!transport || typeof transport !== 'object') errors.push('MISSING_transport');
    else {
      if (transport.type !== 'MODBUS_TCP') errors.push('INVALID_transport.type');
      if (!this.confirmedText(transport.host)) errors.push('MISSING_transport.host');
      if (!Number.isInteger(transport.port) || transport.port < 1 || transport.port > 65535) errors.push('INVALID_transport.port');
      if (!Number.isInteger(transport.unitId) || transport.unitId < 0 || transport.unitId > 255) errors.push('INVALID_transport.unitId');
    }
    const source = profile.source;
    for (const field of ['manualName', 'manualVersion', 'manualUrlOrReference', 'verifiedBy', 'verifiedAt']) {
      if (!this.confirmedText(source?.[field])) errors.push(`MISSING_OR_UNCONFIRMED_source.${field}`);
    }
    if (!Array.isArray(profile.mapping) || profile.mapping.length === 0) errors.push('MISSING_mapping');
    else {
      profile.mapping.forEach((item: Record<string, any>, index: number) => this.validateMapping(item, index, errors));
      this.validateMappingReferences(profile.mapping as PlcProfileMapping[], errors);
    }

    const schemaValid = errors.length === 0;
    const testOnly = profile.testOnly === true || profile.realHardwareApproved !== true;
    if (testOnly) errors.push('REAL_HARDWARE_NOT_APPROVED');
    return {
      schemaValid,
      realProfileValid: schemaValid && !testOnly,
      errors,
      profileName: this.confirmedText(profile.name) ? profile.name : this.confirmedText(profile.profile) ? profile.profile : 'UNNAMED',
      sha256,
      profile
    };
  }

  private validateMapping(item: Record<string, any>, index: number, errors: string[]) {
    for (const field of mappingText) if (!this.confirmedText(item?.[field])) errors.push(`MAPPING_${index}_${field}_UNCONFIRMED`);
    if (!Number.isInteger(item?.address) || item.address < 0 || item.address > 0xffff) errors.push(`MAPPING_${index}_address_INVALID`);
    if (!Number.isFinite(item?.scale)) errors.push(`MAPPING_${index}_scale_UNCONFIRMED`);
    if (!Number.isInteger(item?.timeoutMs) || item.timeoutMs < 1) errors.push(`MAPPING_${index}_timeoutMs_INVALID`);
    if (!Number.isInteger(item?.retry) || item.retry < 0) errors.push(`MAPPING_${index}_retry_INVALID`);
  }

  private validateMappingReferences(mapping: PlcProfileMapping[], errors: string[]) {
    const names = mapping.map((item) => canonicalPlcLogicalName(item.logicalName));
    names.forEach((name, index) => { if (name && names.indexOf(name) !== index) errors.push(`MAPPING_${index}_logicalName_DUPLICATE`); });
    mapping.forEach((item, index) => {
      if (!isWriteCapableMapping(item)) return;
      const reference = canonicalPlcLogicalName(item.feedbackPoint);
      if (!reference) { errors.push(`MAPPING_${index}_feedbackPoint_UNCONFIRMED`); return; }
      const feedback = findPlcMappingByLogicalName(mapping, reference);
      if (!feedback) { errors.push(`MAPPING_${index}_feedbackPoint_NOT_FOUND`); return; }
      if (feedback === item) errors.push(`MAPPING_${index}_feedbackPoint_SELF_REFERENCE`);
      if (!isReadCapableMapping(feedback)) errors.push(`MAPPING_${index}_feedbackPoint_NOT_READ_CAPABLE`);
      if (!isSupportedFeedbackMapping(feedback)) errors.push(`MAPPING_${index}_feedbackPoint_FUNCTION_UNSUPPORTED`);
      if (!Number.isInteger(feedback.address) || String(feedback.functionCode).toUpperCase() === 'UNCONFIRMED') errors.push(`MAPPING_${index}_feedbackPoint_UNCONFIRMED_MAPPING`);
      const expected = expectedFeedbackLogicalName(item.logicalName);
      if (expected && reference !== expected) errors.push(`MAPPING_${index}_feedbackPoint_SEMANTIC_MISMATCH`);
    });
  }

  private confirmedText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.toUpperCase() !== 'UNCONFIRMED';
  }
}
