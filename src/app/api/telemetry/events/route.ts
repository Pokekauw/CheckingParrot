import { NextResponse } from "next/server";
import { db } from "@/db";
import { telemetryEvents, telemetrySessions } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { OP_CODE } from "@/lib/opcode";
import { isBotUserAgent } from "@/lib/botFilter";
import type { InfoGroup } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

type IncomingEvent = {
  type?: string;
  at?: number;
  tMs?: number;
  x?: number;
  y?: number;
  key?: string;
  target?: string;
  detail?: Record<string, unknown>;
};

function fallbackGroupsFromSession(s: typeof telemetrySessions.$inferSelect): InfoGroup[] {
  const snap = (s.snapshot ?? {}) as { groups?: InfoGroup[]; client?: Record<string, string> };
  if (Array.isArray(snap.groups) && snap.groups.length > 0) return snap.groups;

  const groups: InfoGroup[] = [
    {
      id: "net",
      title: "Netværk & lokation",
      glyph: "◎",
      hue: "var(--color-teal-glow)",
      rows: [
        { k: "Klient-IP", v: s.ip ?? "ukendt", hot: true },
        {
          k: "Cirkalokation",
          v: s.city ? `${s.city}${s.region ? `, ${s.region}` : ""} · ${s.country ?? ""}` : "ukendt",
          hot: true,
        },
        {
          k: "Koordinater",
          v: s.lat != null && s.lon != null ? `${s.lat.toFixed(4)}°, ${s.lon.toFixed(4)}°` : "ukendt",
        },
        { k: "ISP / Netværk", v: s.isp ?? "ukendt" },
        { k: "Accept-Language", v: s.acceptLanguage ?? "ikke sendt" },
        { k: "Referer", v: s.referer ?? "direkte besøg" },
      ],
    },
    {
      id: "device",
      title: "Enhed & hardware",
      glyph: "▣",
      hue: "var(--color-amber-sun)",
      rows: [
        { k: "Platform", v: s.platform ?? "ukendt", hot: true },
        { k: "Skærm", v: s.screen ?? "ukendt", hot: true },
        { k: "GPU", v: s.gpu ?? "ukendt" },
        { k: "Tidszone", v: s.timezone ?? "ukendt" },
        { k: "Fingeraftryk", v: s.fingerprint ?? "ukendt" },
        { k: "User-Agent", v: s.userAgent ?? "ukendt" },
      ],
    },
  ];

  if (snap.client && Object.keys(snap.client).length > 0) {
    groups.push({
      id: "extra",
      title: "Øvrige klient-felter",
      glyph: "▤",
      hue: "var(--color-info-blue)",
      rows: Object.entries(snap.client).map(([k, v]) => ({ k, v: String(v) })),
    });
  }
  return groups;
}

export async function POST(req: Request) {
  if (isBotUserAgent(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, stored: 0, ignored: true });
  }

  let body: { sessionId?: string; events?: IncomingEvent[] } = {};
  try {
    body = (await req.json()) as { sessionId?: string; events?: IncomingEvent[] };
  } catch {
    return NextResponse.json({ ok: false, error: "ugyldig json" }, { status: 400 });
  }
  const sessionId = (body.sessionId ?? "").slice(0, 64);
  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  if (!sessionId || events.length === 0) return NextResponse.json({ ok: true, stored: 0 });

  try {
    /* Gem kun events for en registreret menneskelig session */
    const existing = await db
      .select({ id: telemetrySessions.id })
      .from(telemetrySessions)
      .where(eq(telemetrySessions.id, sessionId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ ok: true, stored: 0, deferred: true });
    }

    await db.insert(telemetryEvents).values(
      events.map((e) => ({
        sessionId,
        type: (e.type ?? "sys").slice(0, 16),
        at: new Date(typeof e.at === "number" ? e.at : Date.now()),
        tMs: Math.max(0, Math.round(e.tMs ?? 0)),
        x: typeof e.x === "number" ? Math.round(e.x) : null,
        y: typeof e.y === "number" ? Math.round(e.y) : null,
        keyName: typeof e.key === "string" ? e.key.slice(0, 32) : null,
        target: typeof e.target === "string" ? e.target.slice(0, 180) : null,
        detail: (e.detail ?? {}) as Record<string, unknown>,
      })),
    );
    const clicks = events.filter((e) => e.type === "click").length;
    const keys = events.filter((e) => e.type === "key").length;
    await db
      .update(telemetrySessions)
      .set({
        clicks: sql`${telemetrySessions.clicks} + ${clicks}`,
        keys: sql`${telemetrySessions.keys} + ${keys}`,
        eventCount: sql`${telemetrySessions.eventCount} + ${events.length}`,
        lastSeenAt: new Date(),
      })
      .where(eq(telemetrySessions.id, sessionId));
    return NextResponse.json({ ok: true, stored: events.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db-fejl" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? req.headers.get("x-op-code") ?? "";
  if (code !== OP_CODE) {
    return NextResponse.json({ ok: false, error: "forkert kode" }, { status: 401 });
  }
  const requestedSessionId = url.searchParams.get("sessionId") ?? "";

  try {
    const rawSessions = await db
      .select()
      .from(telemetrySessions)
      .orderBy(desc(telemetrySessions.lastSeenAt))
      .limit(80);

    /* Sortér alle bots og sessioner uden reel interaktion (0 klik og 0 taster) fra */
    const sessions = rawSessions.filter(
      (s) => !isBotUserAgent(s.userAgent) && s.clicks + s.keys > 0,
    );

    const hasRequested = sessions.some((s) => s.id === requestedSessionId);
    const activeSessionId = (hasRequested ? requestedSessionId : sessions[0]?.id) || "";

    const rows = activeSessionId
      ? await db
          .select()
          .from(telemetryEvents)
          .where(eq(telemetryEvents.sessionId, activeSessionId))
          .orderBy(desc(telemetryEvents.id))
          .limit(500)
      : [];

    return NextResponse.json({
      ok: true,
      selectedSessionId: activeSessionId,
      events: rows.reverse().map((r) => {
        const det = (r.detail ?? {}) as { text?: string };
        return {
          id: r.id,
          type: r.type,
          at: r.at.getTime(),
          tMs: r.tMs,
          x: r.x ?? undefined,
          y: r.y ?? undefined,
          key: r.keyName ?? undefined,
          target: r.target ?? undefined,
          detail: typeof det.text === "string" ? det.text : "",
        };
      }),
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.getTime(),
        lastSeenAt: s.lastSeenAt.getTime(),
        ip: s.ip,
        country: s.country,
        countryCode: s.countryCode,
        region: s.region,
        city: s.city,
        isp: s.isp,
        lat: s.lat,
        lon: s.lon,
        locSource: s.locSource,
        userAgent: s.userAgent,
        timezone: s.timezone,
        platform: s.platform,
        screen: s.screen,
        gpu: s.gpu,
        fingerprint: s.fingerprint,
        clicks: s.clicks,
        keys: s.keys,
        eventCount: s.eventCount,
        groups: fallbackGroupsFromSession(s),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db-fejl" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? req.headers.get("x-op-code") ?? "";
  if (code !== OP_CODE) {
    return NextResponse.json({ ok: false, error: "forkert kode" }, { status: 401 });
  }
  const sessionId = url.searchParams.get("sessionId") ?? "";
  try {
    if (sessionId) {
      await db.delete(telemetryEvents).where(eq(telemetryEvents.sessionId, sessionId));
      await db.delete(telemetrySessions).where(eq(telemetrySessions.id, sessionId));
    } else {
      await db.delete(telemetryEvents);
      await db.delete(telemetrySessions);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db-fejl" },
      { status: 500 },
    );
  }
}
