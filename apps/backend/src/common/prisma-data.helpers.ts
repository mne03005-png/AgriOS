export function dateOrUndefined(value?: string) {
  return value ? new Date(value) : undefined;
}

export function removeUndefined<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}
