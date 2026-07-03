const sensitiveKeyPattern = /(password|passwordHash|accessToken|refreshToken|authorization|cookie|database_url|jwt_secret|api[_-]?key|webhook[_-]?secret|token|secret)/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactSensitive(item)
    ])
  );
}

export function limitText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
