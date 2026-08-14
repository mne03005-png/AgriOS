// NATIVE-MAP-1 section 10: Apple's MapKit (react-native-maps on iOS, no `provider` prop set)
// consumes WGS84 coordinates directly -- unlike AMap/Baidu on the Web client, it does not apply
// China's mandatory GCJ-02 survey offset, so no coordinate transform belongs on this path.
// AgriOS's own storage format is already WGS84 (see apps/mobile/src/services/coordinate-transform.ts's
// header comment), so every FieldBoundary/MapLayer/GpsTrack geometry this app reads is used as-is.
//
// This file exists so that fact is a checkable, named decision rather than an implicit absence:
// if a future provider needs a transform (e.g. an Android AMap/Baidu native SDK), it is added
// here and only here, never by mutating stored geometry or by adding it inline in geometry.ts.
export const NATIVE_MAP_COORDINATE_TRANSFORM = 'NONE_APPLE_MAPKIT_USES_WGS84_DIRECTLY' as const;
