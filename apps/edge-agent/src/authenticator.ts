import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class CommandAuthenticator {
  private constructor(private readonly key: Buffer) {}
  static async fromKeyFile(path: string) { const key = await readFile(path); if (!key.length) throw new Error('EDGE_MACHINE_HMAC_KEY_EMPTY'); return new CommandAuthenticator(key); }
  verify(value: Record<string, unknown>) {
    if (typeof value.signature !== 'string') return false;
    const expected = createHmac('sha256', this.key).update(canonical(value)).digest('hex');
    const actual = Buffer.from(value.signature, 'utf8'); const wanted = Buffer.from(expected, 'utf8');
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  }
}
export function canonical(value: Record<string, unknown>) { const { signature: _signature, ...body } = value; return JSON.stringify(body, Object.keys(body).sort()); }
