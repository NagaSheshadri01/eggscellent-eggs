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
  // Clean baseline fallback placeholder if coords are missing or no tiers provided
  if (!userCoords?.lat || !userCoords?.lng || !storeCoords?.lat || !storeCoords?.lng || !configuredTiers || configuredTiers.length === 0) return 30; 

  const calculatedDistance = getHaversineDistance(storeCoords.lat, storeCoords.lng, userCoords.lat, userCoords.lng);

  // Scan the admin's custom JSONB tier arrays for a matching range intersection
  const matchedTier = configuredTiers.find(
    tier => calculatedDistance >= Number(tier.from_km) && calculatedDistance < Number(tier.to_km)
  );

  // Return the explicit tier price. If distance falls completely out of bounds, default to a max zone parameter.
  return matchedTier ? Number(matchedTier.price) : 60;
};
