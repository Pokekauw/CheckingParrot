import { NextResponse } from "next/server";
import { db } from "@/db";
import { telemetrySessions } from "@/db/schema";
import { isPublicIp, lookupIpLocation } from "@/lib/geoip";
import { isBotUserAgent } from "@/lib/botFilter";
import type { InfoGroup, InfoRow } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

function headerIp(h: Headers): { ip: string; source: string; chain: string[] } {
  const cf = h.get("cf-connecting-ip");
  if (cf) return { ip: cf.trim(), source: "cf-connecting-ip", chain: [cf.trim()] };
  const trueClient = h.get("true-client-ip");
  if (trueClient) {
    return { ip: trueClient.trim(), source: "true-client-ip", chain: [trueClient.trim()] };
  }
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const chain = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const pub = chain.find((candidate) => isPublicIp(candidate));
    return { ip: pub ?? chain[0] ?? "ukendt", source: "x-forwarded-for", chain };
  }
  const real = h.get("x-real-ip");
  if (real) return { ip: real.trim(), source: "x-real-ip", chain: [real.trim()] };
  return { ip: "127.0.0.1", source: "socket (lokal)", chain: [] };
}

function ipKind(ip: string): string {
  if (ip === "::1" || ip.startsWith("127.")) return "loopback (lokal)";
  if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return "privat proxy-netværk";
  if (ip.includes(":")) return "offentlig IPv6";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return "offentlig IPv4";
  return "ukendt";
}

function isValidIpLiteral(ip: string | undefined): ip is string {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (trimmed.length > 45) return false;
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const v6 = /^[0-9a-fA-F:]+$/;
  return v4.test(trimmed) || (trimmed.includes(":") && v6.test(trimmed));
}

type Body = {
  sessionId?: string;
  interacted?: boolean;
  isBot?: boolean;
  publicIp?: string;
  fingerprint?: string;
  gpu?: string;
  screen?: string;
  platform?: string;
  timezone?: string;
  groups?: InfoGroup[];
  flat?: Record<string, string>;
};

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const h = req.headers;
  const ua = h.get("user-agent") ?? "";

  /* Sortér bots og passive sideåbninger uden brugerinteraktion fra */
  if (body.isBot || isBotUserAgent(ua) || !body.interacted) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const fromHeader = headerIp(h);
  let ip = fromHeader.ip;
  let source = fromHeader.source;

  /* Hvis reverse-proxy skjuler klienten bag en intern 10.x/127.x IP, brug klientens reelle offentlige IP */
  if (!isPublicIp(ip) && isValidIpLiteral(body.publicIp) && isPublicIp(body.publicIp.trim())) {
    ip = body.publicIp.trim();
    source = "klient offentlig IP";
  }

  /* Bemærk: vi sender IKKE serverens egen egress-IP som fallback, så datacenter-IP aldrig forveksles med en besøgende */
  const geo = await lookupIpLocation(ip, body.timezone ?? null, null);

  const rows: InfoRow[] = [
    { k: "Klient-IP", v: ip, hot: true },
    { k: "IP-type", v: `${ipKind(ip)} (${source})` },
    {
      k: "Cirkalokation",
      v: `${geo.city}${geo.region ? `, ${geo.region}` : ""} · ${geo.country} (${geo.countryCode})`,
      hot: true,
    },
    { k: "Koordinater", v: `${geo.lat.toFixed(4)}°, ${geo.lon.toFixed(4)}°` },
    { k: "ISP / Netværk", v: geo.isp },
    { k: "Lokationskilde", v: geo.source },
    { k: "Accept-Language", v: h.get("accept-language") ?? "ikke sendt" },
    { k: "Referer", v: h.get("referer") ?? "direkte besøg" },
  ];

  const netGroup: InfoGroup = {
    id: "net",
    title: "Netværk & lokation",
    glyph: "◎",
    hue: "var(--color-teal-glow)",
    rows,
  };

  const allGroups: InfoGroup[] = [netGroup, ...(Array.isArray(body.groups) ? body.groups : [])];

  const sessionId = (body.sessionId ?? "").slice(0, 64);
  if (sessionId) {
    const values = {
      id: sessionId,
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      region: geo.region,
      city: geo.city,
      isp: geo.isp,
      lat: geo.lat,
      lon: geo.lon,
      locSource: geo.source,
      userAgent: ua || null,
      acceptLanguage: h.get("accept-language") ?? null,
      referer: h.get("referer") ?? null,
      timezone: body.timezone ?? null,
      platform: body.platform ?? null,
      screen: body.screen ?? null,
      gpu: body.gpu ?? null,
      fingerprint: body.fingerprint ?? null,
      snapshot: {
        groups: allGroups,
        client: body.flat ?? {},
      } as Record<string, unknown>,
      lastSeenAt: new Date(),
    };
    try {
      await db
        .insert(telemetrySessions)
        .values(values)
        .onConflictDoUpdate({ target: telemetrySessions.id, set: values });
    } catch {
      /* telemetri er ikke kritisk */
    }
  }

  return NextResponse.json({
    ok: true,
    ip,
    geo,
    group: netGroup,
  });
}
