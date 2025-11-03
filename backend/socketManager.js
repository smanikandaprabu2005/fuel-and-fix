/**
 * Simple in-memory socket manager.
 * Maps user/provider IDs to socket ids and stores provider metadata (role, location).
 * For production, move to Redis or another shared store.
 */
const providers = new Map(); // providerId -> { socketId, role, coordinates }

function registerProvider(providerId, socketId, role, coordinates) {
  const id = providerId?.toString();
  if (!id) return;
  const existing = providers.get(id) || {};
  providers.set(id, { socketId, role: role || existing.role, coordinates: coordinates || existing.coordinates });
}

function unregisterSocket(socketId) {
  for (const [id, info] of providers.entries()) {
    if (info.socketId === socketId) {
      providers.delete(id);
      return id;
    }
  }
}

function findProvidersWithin(radiusMeters, centerCoords, role) {
  // Naive Haversine check since providers store [lng, lat]
  const [centerLng, centerLat] = centerCoords;
  const results = [];

  for (const [id, info] of providers.entries()) {
    if (role && info.role !== role) continue;
    if (!info.coordinates) continue;
    const [lng, lat] = info.coordinates;
    const d = distanceInMeters(centerLat, centerLng, lat, lng);
    if (d <= radiusMeters) results.push({ id, socketId: info.socketId, distance: d, coordinates: info.coordinates });
  }

  return results;
}

function getProvider(providerId) {
  return providers.get(providerId?.toString());
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371e3; // metres
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

module.exports = { registerProvider, unregisterSocket, findProvidersWithin, getProvider };
// Expose internal map for diagnostics (dev only)
module.exports.__getInternal = () => providers;
