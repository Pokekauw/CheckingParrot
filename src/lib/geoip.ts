/* ------------------------------------------------------------------ */
/*  IP → cirkalokation (GeoIP) med cache og tidszone-fallback          */
/* ------------------------------------------------------------------ */

export type GeoLookup = {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  lat: number;
  lon: number;
  source: string;
};

type CacheEntry = { geo: GeoLookup; at: number };
const geoCache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

export function isPublicIp(ip: string): boolean {
  if (!ip || ip === "ukendt") return false;
  if (ip === "::1" || ip === "0.0.0.0" || ip.startsWith("127.")) return false;
  if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  if (/^(fc|fd|fe80):/i.test(ip)) return false;
  return ip.includes(".") || ip.includes(":");
}

const TZ_COORDS: Record<
  string,
  { city: string; country: string; code: string; lat: number; lon: number }
> = {
  "Europe/Copenhagen": { city: "København", country: "Danmark", code: "DK", lat: 55.6761, lon: 12.5683 },
  "Europe/Stockholm": { city: "Stockholm", country: "Sverige", code: "SE", lat: 59.3293, lon: 18.0686 },
  "Europe/Oslo": { city: "Oslo", country: "Norge", code: "NO", lat: 59.9139, lon: 10.7522 },
  "Europe/Helsinki": { city: "Helsinki", country: "Finland", code: "FI", lat: 60.1699, lon: 24.9384 },
  "Atlantic/Reykjavik": { city: "Reykjavik", country: "Island", code: "IS", lat: 64.1466, lon: -21.9426 },
  "America/Godthab": { city: "Nuuk", country: "Grønland", code: "GL", lat: 64.1814, lon: -51.6941 },
  "Atlantic/Faroe": { city: "Tórshavn", country: "Færøerne", code: "FO", lat: 62.0079, lon: -6.791 },
  "Europe/Berlin": { city: "Berlin", country: "Tyskland", code: "DE", lat: 52.52, lon: 13.405 },
  "Europe/Amsterdam": { city: "Amsterdam", country: "Holland", code: "NL", lat: 52.3676, lon: 4.9041 },
  "Europe/London": { city: "London", country: "Storbritannien", code: "GB", lat: 51.5074, lon: -0.1278 },
  "Europe/Paris": { city: "Paris", country: "Frankrig", code: "FR", lat: 48.8566, lon: 2.3522 },
  "Europe/Madrid": { city: "Madrid", country: "Spanien", code: "ES", lat: 40.4168, lon: -3.7038 },
  "Europe/Rome": { city: "Rom", country: "Italien", code: "IT", lat: 41.9028, lon: 12.4964 },
  "Europe/Warsaw": { city: "Warszawa", country: "Polen", code: "PL", lat: 52.2297, lon: 21.0122 },
  "Europe/Zurich": { city: "Zürich", country: "Schweiz", code: "CH", lat: 47.3769, lon: 8.5417 },
  "Europe/Vienna": { city: "Wien", country: "Østrig", code: "AT", lat: 48.2082, lon: 16.3738 },
  "Europe/Prague": { city: "Prag", country: "Tjekkiet", code: "CZ", lat: 50.0755, lon: 14.4378 },
  "Europe/Brussels": { city: "Bruxelles", country: "Belgien", code: "BE", lat: 50.8503, lon: 4.3517 },
  "Europe/Dublin": { city: "Dublin", country: "Irland", code: "IE", lat: 53.3498, lon: -6.2603 },
  "Europe/Lisbon": { city: "Lissabon", country: "Portugal", code: "PT", lat: 38.7223, lon: -9.1393 },
  "Europe/Athens": { city: "Athen", country: "Grækenland", code: "GR", lat: 37.9838, lon: 23.7275 },
  "Europe/Istanbul": { city: "Istanbul", country: "Tyrkiet", code: "TR", lat: 41.0082, lon: 28.9784 },
  "America/New_York": { city: "New York", country: "USA", code: "US", lat: 40.7128, lon: -74.006 },
  "America/Chicago": { city: "Chicago", country: "USA", code: "US", lat: 41.8781, lon: -87.6298 },
  "America/Denver": { city: "Denver", country: "USA", code: "US", lat: 39.7392, lon: -104.9903 },
  "America/Los_Angeles": { city: "Los Angeles", country: "USA", code: "US", lat: 34.0522, lon: -118.2437 },
  "America/Toronto": { city: "Toronto", country: "Canada", code: "CA", lat: 43.6532, lon: -79.3832 },
  "America/Vancouver": { city: "Vancouver", country: "Canada", code: "CA", lat: 49.2827, lon: -123.1207 },
  "America/Sao_Paulo": { city: "São Paulo", country: "Brasilien", code: "BR", lat: -23.5505, lon: -46.6333 },
  "America/Mexico_City": { city: "Mexico City", country: "Mexico", code: "MX", lat: 19.4326, lon: -99.1332 },
  "America/Buenos_Aires": { city: "Buenos Aires", country: "Argentina", code: "AR", lat: -34.6037, lon: -58.3816 },
  "Asia/Tokyo": { city: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lon: 139.6503 },
  "Asia/Seoul": { city: "Seoul", country: "Sydkorea", code: "KR", lat: 37.5665, lon: 126.978 },
  "Asia/Singapore": { city: "Singapore", country: "Singapore", code: "SG", lat: 1.3521, lon: 103.8198 },
  "Asia/Hong_Kong": { city: "Hong Kong", country: "Hong Kong", code: "HK", lat: 22.3193, lon: 114.1694 },
  "Asia/Shanghai": { city: "Shanghai", country: "Kina", code: "CN", lat: 31.2304, lon: 121.4737 },
  "Asia/Dubai": { city: "Dubai", country: "UAE", code: "AE", lat: 25.2048, lon: 55.2708 },
  "Asia/Kolkata": { city: "Mumbai", country: "Indien", code: "IN", lat: 19.076, lon: 72.8777 },
  "Asia/Bangkok": { city: "Bangkok", country: "Thailand", code: "TH", lat: 13.7563, lon: 100.5018 },
  "Australia/Sydney": { city: "Sydney", country: "Australien", code: "AU", lat: -33.8688, lon: 151.2093 },
  "Pacific/Auckland": { city: "Auckland", country: "New Zealand", code: "NZ", lat: -36.8485, lon: 174.7633 },
  "Africa/Johannesburg": { city: "Johannesburg", country: "Sydafrika", code: "ZA", lat: -26.2041, lon: 28.0473 },
  "Africa/Cairo": { city: "Kairo", country: "Egypten", code: "EG", lat: 30.0444, lon: 31.2357 },
};

async function fetchIpWhoIs(ip: string): Promise<GeoLookup | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      success?: boolean;
      country?: string;
      country_code?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      connection?: { isp?: string; org?: string };
    };
    if (!j.success || typeof j.latitude !== "number" || typeof j.longitude !== "number") return null;
    return {
      country: j.country ?? "Ukendt",
      countryCode: j.country_code ?? "??",
      region: j.region ?? "",
      city: j.city ?? "Ukendt",
      isp: j.connection?.isp || j.connection?.org || "Ukendt netværk",
      lat: j.latitude,
      lon: j.longitude,
      source: "IP-geolokation (ipwho.is)",
    };
  } catch {
    return null;
  }
}

async function fetchIpApi(ip: string): Promise<GeoLookup | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,isp,org`,
      { signal: ctrl.signal, cache: "no-store" },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
      isp?: string;
      org?: string;
    };
    if (j.status !== "success" || typeof j.lat !== "number" || typeof j.lon !== "number") return null;
    return {
      country: j.country ?? "Ukendt",
      countryCode: j.countryCode ?? "??",
      region: j.regionName ?? "",
      city: j.city ?? "Ukendt",
      isp: j.isp || j.org || "Ukendt netværk",
      lat: j.lat,
      lon: j.lon,
      source: "IP-geolokation (ip-api)",
    };
  } catch {
    return null;
  }
}

export async function lookupIpLocation(
  ip: string,
  fallbackTimezone?: string | null,
  egressIp?: string | null,
): Promise<GeoLookup> {
  /* 1. Offentlig klient-IP */
  if (isPublicIp(ip)) {
    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.geo;

    const geo = (await fetchIpWhoIs(ip)) ?? (await fetchIpApi(ip));
    if (geo) {
      geoCache.set(ip, { geo, at: Date.now() });
      return geo;
    }
  }

  /* 2. Lokal/privat IP → brug browserens tidszone hvis kendt */
  if (fallbackTimezone && TZ_COORDS[fallbackTimezone]) {
    const tz = TZ_COORDS[fallbackTimezone];
    return {
      country: tz.country,
      countryCode: tz.code,
      region: fallbackTimezone,
      city: tz.city,
      isp: "Lokal forbindelse",
      lat: tz.lat,
      lon: tz.lon,
      source: "Lokal IP · tidszone-cirkalokation",
    };
  }

  /* 3. Ellers forsøg serverens offentlige egress-IP */
  if (egressIp && isPublicIp(egressIp)) {
    const cached = geoCache.get(egressIp);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return { ...cached.geo, source: "Lokal IP · server-egress lokation" };
    }
    const geo = (await fetchIpWhoIs(egressIp)) ?? (await fetchIpApi(egressIp));
    if (geo) {
      geoCache.set(egressIp, { geo, at: Date.now() });
      return { ...geo, source: "Lokal IP · server-egress lokation" };
    }
  }

  /* 4. Sidste fallback (København) */
  return {
    country: "Danmark",
    countryCode: "DK",
    region: "Hovedstaden",
    city: "København",
    isp: "Lokalt netværk",
    lat: 55.6761,
    lon: 12.5683,
    source: "Standard-lokation",
  };
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return "🌐";
  const upper = code.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + upper.charCodeAt(0) - 65, 0x1f1e6 + upper.charCodeAt(1) - 65);
}
