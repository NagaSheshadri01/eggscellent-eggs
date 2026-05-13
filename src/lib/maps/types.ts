export type LatLng = { lat: number; lng: number };

export type ParsedAddress = {
  formatted: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

export type AutocompletePrediction = {
  placeId: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
};

export interface MapsProvider {
  isAvailable(): boolean;
  autocomplete(input: string): Promise<AutocompletePrediction[]>;
  placeDetails(placeId: string): Promise<ParsedAddress | null>;
  reverseGeocode(coords: LatLng): Promise<ParsedAddress | null>;
}

export const getCurrentPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
  });