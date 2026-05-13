import type { MapsProvider, ParsedAddress, AutocompletePrediction, LatLng } from "./types";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let loaderPromise: Promise<any> | null = null;
const loadGoogleMaps = (): Promise<any> => {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  // @ts-ignore
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (!API_KEY) return Promise.reject(new Error("Google Maps API key missing"));
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&region=IN`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      // @ts-ignore
      resolve(window.google);
    };
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
};

const parseComponents = (components: any[]): Partial<ParsedAddress> => {
  const get = (type: string) => components.find((c) => c.types?.includes(type));
  const sublocality = get("sublocality_level_1") || get("sublocality") || get("neighborhood");
  return {
    area: sublocality?.long_name,
    city: get("locality")?.long_name || get("administrative_area_level_2")?.long_name,
    state: get("administrative_area_level_1")?.long_name,
    pincode: get("postal_code")?.long_name,
    country: get("country")?.long_name,
  };
};

export const googleMapsProvider: MapsProvider = {
  isAvailable() {
    return !!API_KEY;
  },

  async autocomplete(input: string): Promise<AutocompletePrediction[]> {
    if (!input || input.length < 3) return [];
    const google = await loadGoogleMaps();
    return new Promise((resolve) => {
      const svc = new google.maps.places.AutocompleteService();
      svc.getPlacePredictions(
        { input, componentRestrictions: { country: "in" } },
        (preds: any[] | null) => {
          resolve(
            (preds || []).map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text,
              secondaryText: p.structured_formatting?.secondary_text,
            }))
          );
        }
      );
    });
  },

  async placeDetails(placeId: string): Promise<ParsedAddress | null> {
    const google = await loadGoogleMaps();
    return new Promise((resolve) => {
      const div = document.createElement("div");
      const svc = new google.maps.places.PlacesService(div);
      svc.getDetails(
        { placeId, fields: ["address_components", "formatted_address", "geometry"] },
        (place: any, status: string) => {
          if (status !== "OK" || !place) return resolve(null);
          const parsed = parseComponents(place.address_components || []);
          resolve({
            formatted: place.formatted_address,
            ...parsed,
            lat: place.geometry?.location?.lat?.(),
            lng: place.geometry?.location?.lng?.(),
          });
        }
      );
    });
  },

  async reverseGeocode({ lat, lng }: LatLng): Promise<ParsedAddress | null> {
    const google = await loadGoogleMaps();
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any[] | null, status: string) => {
        if (status !== "OK" || !results?.length) return resolve(null);
        const r = results[0];
        const parsed = parseComponents(r.address_components || []);
        resolve({ formatted: r.formatted_address, ...parsed, lat, lng });
      });
    });
  },
};