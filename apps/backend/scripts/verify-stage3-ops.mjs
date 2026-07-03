import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('ts-node/register');

const { normalizeRequestId } = require('../src/common/request-id.middleware.ts');
const { redactSensitive, limitText } = require('../src/common/logging/sensitive-redaction.ts');

const accepted = normalizeRequestId('stage3-request-123');
assert.equal(accepted, 'stage3-request-123');

const rejected = normalizeRequestId('bad id with spaces');
assert.match(rejected, /^[0-9a-f-]{36}$/i);

const redacted = redactSensitive({
  password: 'secret',
  nested: { accessToken: 'token', ok: true },
  Authorization: 'Bearer token'
});
assert.equal(redacted.password, '[REDACTED]');
assert.equal(redacted.nested.accessToken, '[REDACTED]');
assert.equal(redacted.Authorization, '[REDACTED]');
assert.equal(redacted.nested.ok, true);

assert.equal(limitText('abcdef', 3), 'abc...');
assert.equal(limitText('abc', 3), 'abc');

console.log('Stage 3 requestId and log redaction checks passed.');
