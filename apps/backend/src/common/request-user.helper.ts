export interface HeaderLike {
  [key: string]: string | string[] | undefined;
}

export function getCurrentUserId(headers: HeaderLike) {
  const value = headers['x-user-id'];
  return Array.isArray(value) ? value[0] : value;
}
