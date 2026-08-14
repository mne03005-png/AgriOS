import * as Location from 'expo-location';

// Pattern ported from the fishing app's src/utils/locationService.js (requestForegroundPermissionsAsync
// guard against re-prompting after a denial, getCurrentPositionAsync with a timeout + last-known-position
// fallback, honest success/failure result object) -- with AgriOS's own default location and Chinese
// permission copy. No fishing-related text or behavior (region/city resolution, etc.) is carried over.

// Same fallback center MapPage.vue's initMap() already uses for the Web AMap adapter
// (apps/mobile/src/pages/MapPage.vue) -- the demo farm's approximate area, not a fabricated value.
export const DEFAULT_LOCATION = { latitude: 36.7, longitude: 118.1 };

export const LOCATION_STATUS = {
  LOCATING: 'LOCATING',
  SUCCESS: 'SUCCESS',
  FALLBACK: 'FALLBACK'
} as const;
export type LocationStatus = (typeof LOCATION_STATUS)[keyof typeof LOCATION_STATUS];

const LOCATION_TIMEOUT_MS = 10000;
let permissionRequestedThisSession = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs = LOCATION_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), timeoutMs))
  ]);
}

export async function requestLocationPermission(options: { allowRequest?: boolean } = {}) {
  const { allowRequest = true } = options;
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      return { granted: true, status: current.status, canAskAgain: current.canAskAgain !== false };
    }
    if (!allowRequest || (permissionRequestedThisSession && current.status === 'denied')) {
      return { granted: false, status: current.status ?? 'denied', canAskAgain: current.canAskAgain !== false };
    }
    permissionRequestedThisSession = true;
    const result = await Location.requestForegroundPermissionsAsync();
    return { granted: result.status === 'granted', status: result.status, canAskAgain: result.canAskAgain !== false };
  } catch {
    return { granted: false, status: 'error', canAskAgain: false };
  }
}

export type SafeLocationResult = {
  success: boolean;
  location: { latitude: number; longitude: number };
  reason: string | null;
  usedFallback: boolean;
};

export async function getCurrentLocationSafe(options: { requestPermission?: boolean } = {}): Promise<SafeLocationResult> {
  const { requestPermission = true } = options;
  try {
    const permission = await requestLocationPermission({ allowRequest: requestPermission });
    if (!permission.granted) {
      return {
        success: false,
        location: { ...DEFAULT_LOCATION },
        reason: permission.status === 'denied' ? 'permission_denied' : 'permission_unavailable',
        usedFallback: true
      };
    }

    let position: Location.LocationObject | null = null;
    try {
      position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    } catch {
      try {
        position = await Location.getLastKnownPositionAsync();
      } catch {
        position = null;
      }
    }

    if (!position?.coords) {
      return { success: false, location: { ...DEFAULT_LOCATION }, reason: 'position_unavailable', usedFallback: true };
    }

    return {
      success: true,
      location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      reason: null,
      usedFallback: false
    };
  } catch (error) {
    const reason = error instanceof Error && error.message === 'LOCATION_TIMEOUT' ? 'timeout' : 'unknown_error';
    return { success: false, location: { ...DEFAULT_LOCATION }, reason, usedFallback: true };
  }
}
