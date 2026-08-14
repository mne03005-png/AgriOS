import Constants from 'expo-constants';

// Mirrors apps/mobile/src/api/http.ts's resolveBaseUrl(): same backend, same API surface, no
// second backend. __DEV__ picks a LAN-reachable dev URL; production points at the same API the
// Web client uses.
function resolveBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (fromExtra) return fromExtra;
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const devHost = hostUri?.split(':')[0];
    if (devHost) return `http://${devHost}:3000/api/v1`;
    return 'http://localhost:3000/api/v1';
  }
  return 'https://agrios-api.xyzwtt.com/api/v1';
}

export const API_BASE_URL = resolveBaseUrl();
