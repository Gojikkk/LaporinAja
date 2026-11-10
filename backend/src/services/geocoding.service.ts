import { HttpError } from "../utils/http-error";
import { env } from "../config/env";

export type GeocodingCandidate = {
  latitude: number;
  longitude: number;
  displayName: string;
  address?: {
    city?: string;
    district?: string;
    village?: string;
    locationDetail?: string;
  };
};

export type GeocodedAddress = {
  displayName: string;
  address?: GeocodingCandidate["address"];
};

type NominatimAddress = Record<string, unknown>;

type NominatimResult = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
  name?: unknown;
  address?: NominatimAddress;
};

const cacheTtlMs = 24 * 60 * 60 * 1000;
const cacheMaxEntries = 500;
const minimumRequestIntervalMs = 1_100;
const cache = new Map<string, { expiresAt: number; candidates: GeocodingCandidate[] }>();
const reverseCache = new Map<string, { expiresAt: number; address: GeocodedAddress }>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function firstAddressValue(address: NominatimAddress | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = address?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function mapAddress(address: NominatimAddress | undefined, name: unknown): GeocodingCandidate["address"] {
  const mapped = {
    city: firstAddressValue(address, "city", "town", "municipality", "county"),
    district: firstAddressValue(address, "city_district", "district", "state_district"),
    village: firstAddressValue(address, "village", "suburb", "quarter", "neighbourhood"),
    locationDetail: typeof name === "string" && name.trim()
      ? name.trim()
      : firstAddressValue(address, "road", "pedestrian", "footway", "path", "park", "amenity", "leisure")
  };
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}

function readCache(key: string): GeocodingCandidate[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.candidates;
}

function saveCache(key: string, candidates: GeocodingCandidate[]): void {
  cache.set(key, { expiresAt: Date.now() + cacheTtlMs, candidates });
  if (cache.size > cacheMaxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

async function queryNominatim(query: string): Promise<GeocodingCandidate[]> {
  const url = new URL(env.geocodingSearchUrl);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "id",
    addressdetails: "1"
  }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": env.geocodingUserAgent,
        "Accept-Language": "id"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new HttpError(502, "LOCATION_SEARCH_UNAVAILABLE", "Layanan pencarian lokasi sedang tidak tersedia");
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      throw new HttpError(502, "LOCATION_SEARCH_INVALID_RESPONSE", "Respons pencarian lokasi tidak valid");
    }
    return payload.flatMap((item: NominatimResult) => {
      if (!item || typeof item !== "object") return [];
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          typeof item.display_name !== "string") {
        return [];
      }
      return [{
        latitude,
        longitude,
        displayName: item.display_name,
        address: mapAddress(item.address, item.name)
      }];
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      throw new HttpError(504, "LOCATION_SEARCH_TIMEOUT", "Pencarian lokasi memerlukan waktu terlalu lama");
    }
    throw new HttpError(502, "LOCATION_SEARCH_UNAVAILABLE", "Tidak dapat menghubungi layanan pencarian lokasi");
  } finally {
    clearTimeout(timeout);
  }
}

async function queryNominatimReverse(latitude: number, longitude: number): Promise<GeocodedAddress> {
  const url = new URL(env.geocodingSearchUrl);
  url.pathname = url.pathname.replace(/\/search\/?$/, "/reverse");
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1"
  }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": env.geocodingUserAgent,
        "Accept-Language": "id"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new HttpError(502, "LOCATION_LOOKUP_UNAVAILABLE", "Layanan lokasi sedang tidak tersedia");
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new HttpError(502, "LOCATION_LOOKUP_INVALID_RESPONSE", "Respons lokasi tidak valid");
    }
    const result = payload as NominatimResult;
    if (typeof result.display_name !== "string") {
      throw new HttpError(404, "LOCATION_NOT_FOUND", "Alamat untuk titik lokasi tidak ditemukan");
    }
    return {
      displayName: result.display_name,
      address: mapAddress(result.address, result.name)
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      throw new HttpError(504, "LOCATION_LOOKUP_TIMEOUT", "Pencarian alamat memerlukan waktu terlalu lama");
    }
    throw new HttpError(502, "LOCATION_LOOKUP_UNAVAILABLE", "Tidak dapat menghubungi layanan pencarian lokasi");
  } finally {
    clearTimeout(timeout);
  }
}

function enqueueProviderRequest<T>(request: () => Promise<T>): Promise<T> {
  const task = requestQueue.then(async () => {
    const delay = minimumRequestIntervalMs - (Date.now() - lastRequestAt);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestAt = Date.now();
    return request();
  });
  requestQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function searchLocations(rawQuery: string): Promise<GeocodingCandidate[]> {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  const key = query.toLocaleLowerCase("id");
  const cached = readCache(key);
  if (cached) return cached;

  return enqueueProviderRequest(async () => {
    const queuedCache = readCache(key);
    if (queuedCache) return queuedCache;
    const candidates = await queryNominatim(query);
    saveCache(key, candidates);
    return candidates;
  });
}

export async function reverseLookupLocation(latitude: number, longitude: number): Promise<GeocodedAddress> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.address;
  if (cached) reverseCache.delete(key);

  return enqueueProviderRequest(async () => {
    const queuedCache = reverseCache.get(key);
    if (queuedCache && queuedCache.expiresAt > Date.now()) return queuedCache.address;
    const address = await queryNominatimReverse(latitude, longitude);
    reverseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, address });
    if (reverseCache.size > cacheMaxEntries) {
      const oldest = reverseCache.keys().next().value;
      if (oldest) reverseCache.delete(oldest);
    }
    return address;
  });
}
