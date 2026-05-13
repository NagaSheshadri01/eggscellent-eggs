import type { MapsProvider, ParsedAddress, LatLng } from "./types";
import { googleMapsProvider } from "./googleProvider";

// Fallback provider used when no API key is configured. Returns nothing so the UI
// can gracefully degrade to manual entry.
const fallbackProvider: MapsProvider = {
  isAvailable: () => false,
  autocomplete: async () => [],
  placeDetails: async () => null,
  reverseGeocode: async (coords: LatLng) => {
    // best-effort using OSM Nominatim so users still get *something* without a key
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`,
        { headers: { "Accept-Language": "en" } }
      );
      const j = await r.json();
      const a = j.address || {};
      const area = [a.suburb, a.neighbourhood, a.road].filter(Boolean).join(", ");
      return {
        formatted: j.display_name || area,
        area,
        city: a.city || a.town || a.village || a.county,
        state: a.state,
        pincode: a.postcode,
        country: a.country,
        lat: coords.lat,
        lng: coords.lng,
      } as ParsedAddress;
    } catch {
      return null;
    }
  },
};

export const maps: MapsProvider = googleMapsProvider.isAvailable() ? googleMapsProvider : fallbackProvider;

export const isGoogleMapsConfigured = () => googleMapsProvider.isAvailable();

export type { MapsProvider, ParsedAddress, AutocompletePrediction, LatLng } from "./types";
export { getCurrentPosition } from "./types";