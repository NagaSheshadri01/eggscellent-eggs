// Haversine mathematical distance core logic
export const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Absolute float distance in kilometers
};

// Tier Evaluator Engine
export const evaluateTieredDeliveryFee = (
  storeCoords: { lat: number; lng: number } | null | undefined,
  userCoords: { lat: number; lng: number } | null | undefined,
  configuredTiers: Array<{ from_km: number; to_km: number; price: number }>
): number => {
  if (!userCoords?.lat || !userCoords?.lng || !storeCoords?.lat || !storeCoords?.lng || !configuredTiers || configuredTiers.length === 0) {
    return 30; // Standard reliable default fallback
  }

  // Calculate precise straight-line distance via Haversine
  const distance = getHaversineDistance(storeCoords.lat, storeCoords.lng, userCoords.lat, userCoords.lng);

  // 1. Attempt to find an exact interval match: [from_km, to_km)
  const matchedTier = configuredTiers.find(
    tier => distance >= Number(tier.from_km) && distance < Number(tier.to_km)
  );

  if (matchedTier) {
    return Number(matchedTier.price);
  }

  // 2. OUT OF BOUNDS SAFE FALLBACK: Pick the highest pricing tier cap in the array
  const sortedTiers = [...configuredTiers].sort((a, b) => Number(b.price) - Number(a.price));
  return Number(sortedTiers[0].price);
};
