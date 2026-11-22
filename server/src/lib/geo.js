const CITY_SPEED_KMH = 18; // average city two-wheeler speed incl. traffic (assumption)
const HANDOVER_MIN = 5;

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  // 1.3x detour factor: roads are not straight lines
  return +(2 * R * Math.asin(Math.sqrt(s)) * 1.3).toFixed(2);
}

export function etaMinutes(km) {
  return Math.round((km / CITY_SPEED_KMH) * 60 + HANDOVER_MIN);
}

// Fuzz coordinates to ~1km so exact locations are only shown to the parties involved
export function fuzz(lat, lng) {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

export const VEHICLE_MAX_KG = { BICYCLE: 10, BIKE: 25, CAR: 80, VAN: 500 };
