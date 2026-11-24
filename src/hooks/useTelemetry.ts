"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectSnapshot,
  describeTarget,
  type InfoGroup,
  type Snapshot,
  type TelEvent,
  type TelEventType,
} from "@/lib/telemetry";
import { isAutomatedBrowser } from "@/lib/botFilter";
import type { GeoLookup } from "@/lib/geoip";

export type SessionRow = {
  id: string;
  startedAt: number;
  lastSeenAt: number;
  ip: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  lat: number | null;
  lon: number | null;
  locSource: string | null;
  userAgent: string | null;
  timezone: string | null;
  platform: string | null;
  screen: string | null;
  gpu: string | null;
  fingerprint: string | null;
  clicks: number;
  keys: number;
  eventCount: number;
  groups: InfoGroup[];
};

const MAX_EVENTS = 600;

function makeSessionId(): string {
  try {
    const existing = sessionStorage.getItem("pb.sid");
    if (existing) return existing;
    const id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("pb.sid", id);
    return id;
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

async function fetchClientPublicIp(): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1400);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    window.clearTimeout(timer);
    if (!res.ok) return undefined;
    const j = (await res.json()) as { ip?: string };
    return typeof j.ip === "string" && j.ip.trim() ? j.ip.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function useTelemetry(captureInput = true) {
  const [events, setEvents] = useState<TelEvent[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [netGroup, setNetGroup] = useState<InfoGroup | null>(null);
  const [myGeo, setMyGeo] = useState<GeoLookup | null>(null);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [remoteEvents, setRemoteEvents] = useState<TelEvent[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(Date.now());
  const buffer = useRef<TelEvent[]>([]);
  const pending = useRef<TelEvent[]>([]);
  const idRef = useRef(1);
  const counters = useRef({ clicks: 0, keys: 0 });
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const captureRef = useRef(captureInput);
  captureRef.current = captureInput;

  const sid = useRef("s-local");
  const isBotRef = useRef(false);
  const activatedRef = useRef(false);
  const registeredRef = useRef(false);
  const flushingRef = useRef(false);
  const selectedRef = useRef("");
  selectedRef.current = selectedId;

  /* ---------------- send ventende events når registreret ------------- */
  const flushPending = useCallback(async () => {
    if (isBotRef.current || !registeredRef.current || flushingRef.current) return;
    if (!pending.current.length) return;

    flushingRef.current = true;
    const batch = pending.current.splice(0, 120);
    try {
      const res = await fetch("/api/telemetry/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          sessionId: sid.current,
          events: batch.map((e) => ({
            type: e.type,
            at: e.at,
            tMs: e.tMs,
            x: e.x,
            y: e.y,
            key: e.key,
            target: e.target,
            detail: { text: e.detail ?? "" },
          })),
        }),
      });
      const j = (await res.json().catch(() => null)) as { deferred?: boolean } | null;
      if (j?.deferred) {
        pending.current.unshift(...batch);
      }
    } catch {
      /* ved kortvarigt netværksudfald gemmes batchet til næste flush */
      pending.current.unshift(...batch);
    } finally {
      flushingRef.current = false;
    }
  }, []);

  /* --------- aktivér session ved første menneskelige handling -------- */
  const activateSession = useCallback(async () => {
    if (activatedRef.current || isBotRef.current) return;
    if (isAutomatedBrowser()) {
      isBotRef.current = true;
      return;
    }
    activatedRef.current = true;
    setActivated(true);

    try {
      const [snap, publicIp] = await Promise.all([collectSnapshot(), fetchClientPublicIp()]);
      setSnapshot(snap);

      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sid.current,
          interacted: true,
          isBot: false,
          publicIp,
          fingerprint: snap.fingerprint,
          gpu: snap.gpu,
          screen: snap.screen,
          platform: snap.platform,
          timezone: snap.timezone,
          groups: snap.groups,
          flat: snap.flat,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        ignored?: boolean;
        group?: InfoGroup;
        ip?: string;
        geo?: GeoLookup;
      };
      if (!data.ok || data.ignored) return;
      if (data.group) setNetGroup(data.group);
      if (data.geo) setMyGeo(data.geo);
      if (data.ip) setMyIp(data.ip);

      registeredRef.current = true;
      await flushPending();
    } catch {
      /* offline er ok */
    }
  }, [flushPending]);

  /* ------------------------- event-optager -------------------------- */
  const record = useCallback(
    (type: TelEventType, data: Partial<TelEvent> = {}) => {
      if (pausedRef.current || isBotRef.current) return null;
      if (!activatedRef.current) {
        if (isAutomatedBrowser()) {
          isBotRef.current = true;
          return null;
        }
        /* Kun reelle brugerhandlinger kan vække tracking */
        if (type === "click" || type === "key" || type === "care") {
          void activateSession();
        } else {
          return null;
        }
      }

      const at = Date.now();
      const ev: TelEvent = {
        id: idRef.current++,
        type,
        at,
        tMs: at - startedAt.current,
        ...data,
      };
      if (type === "click") counters.current.clicks++;
      if (type === "key") counters.current.keys++;
      buffer.current.push(ev);
      if (buffer.current.length > MAX_EVENTS) {
        buffer.current.splice(0, buffer.current.length - MAX_EVENTS);
      }
      pending.current.push(ev);
      if (pending.current.length > 250) {
        pending.current.splice(0, pending.current.length - 250);
      }
      return ev;
    },
    [activateSession],
  );

  /* ------------ sæt lokalt session-ID uden netværkskald ------------- */
  useEffect(() => {
    sid.current = makeSessionId();
    setSelectedId(sid.current);
    startedAt.current = Date.now();
    isBotRef.current = isAutomatedBrowser();
  }, []);

  /* ------------- kun betroede klik + tastetryk lyttere -------------- */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted || !captureRef.current) return;
      record("click", {
        x: e.clientX,
        y: e.clientY,
        target: describeTarget(e.target),
        detail: `${e.clientX},${e.clientY}`,
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted || !captureRef.current) return;
      const mods = [e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", e.metaKey && "meta"]
        .filter(Boolean)
        .join("+");
      record("key", {
        key: e.key,
        target: describeTarget(e.target),
        detail: `${e.code}${mods ? ` · ${mods}` : ""}${e.repeat ? " · holdt" : ""}`,
      });
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [record]);

  /* ------------------- UI-opdatering + server-flush ------------------ */
  useEffect(() => {
    const ui = window.setInterval(() => {
      if (!activatedRef.current) return;
      setEvents([...buffer.current]);
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 450);

    const flush = window.setInterval(() => {
      void flushPending();
    }, 1800);

    const onHide = () => {
      void flushPending();
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearInterval(ui);
      window.clearInterval(flush);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flushPending]);

  /* --------------- admin: hent sessioner + valgt klient ------------- */
  const loadAdminData = useCallback(
    async (explicitSessionId?: string) => {
      await flushPending();
      const targetId = explicitSessionId ?? (selectedRef.current || sid.current);
      try {
        if (explicitSessionId && explicitSessionId !== selectedRef.current) {
          setLoadingRemote(true);
        }
        const res = await fetch(
          `/api/telemetry/events?code=1357&sessionId=${encodeURIComponent(targetId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          selectedSessionId: string;
          sessions: SessionRow[];
          events: TelEvent[];
        };
        if (!data.ok) return;
        setSessions(data.sessions);
        if (data.selectedSessionId && !data.sessions.some((s) => s.id === selectedRef.current)) {
          setSelectedId(data.selectedSessionId);
          selectedRef.current = data.selectedSessionId;
        }
        setRemoteEvents(data.events);
      } catch {
        /* stille */
      } finally {
        setLoadingRemote(false);
      }
    },
    [flushPending],
  );

  const selectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      selectedRef.current = id;
      void loadAdminData(id);
    },
    [loadAdminData],
  );

  const clearLog = useCallback(
    async (targetSessionId?: string) => {
      const id = targetSessionId ?? (selectedRef.current || sid.current);
      if (id === sid.current) {
        buffer.current = [];
        pending.current = [];
        counters.current = { clicks: 0, keys: 0 };
        setEvents([]);
      }
      setRemoteEvents([]);
      try {
        await fetch(`/api/telemetry/events?code=1357&sessionId=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await loadAdminData();
      } catch {
        /* stille */
      }
    },
    [loadAdminData],
  );

  const localGroups = useMemo<InfoGroup[]>(() => {
    const g: InfoGroup[] = [];
    if (netGroup) g.push(netGroup);
    if (snapshot) g.push(...snapshot.groups);
    return g;
  }, [netGroup, snapshot]);

  /* Vis kun verificerede aktive sessioner (fra DB + evt. nuværende aktiverede session) */
  const allSessions = useMemo<SessionRow[]>(() => {
    const hasCurrent = sessions.some((s) => s.id === sid.current);
    if (hasCurrent) {
      return sessions.map((s) =>
        s.id === sid.current
          ? {
              ...s,
              lastSeenAt: Math.max(s.lastSeenAt, Date.now()),
              clicks: Math.max(s.clicks, counters.current.clicks),
              keys: Math.max(s.keys, counters.current.keys),
              eventCount: Math.max(s.eventCount, events.length),
              groups: localGroups.length > 0 ? localGroups : s.groups,
            }
          : s,
      );
    }
    if (!activated || counters.current.clicks + counters.current.keys === 0) {
      return sessions;
    }
    const fallbackCurrent: SessionRow = {
      id: sid.current,
      startedAt: startedAt.current,
      lastSeenAt: Date.now(),
      ip: myIp ?? "henter…",
      country: myGeo?.country ?? "Danmark",
      countryCode: myGeo?.countryCode ?? "DK",
      region: myGeo?.region ?? "",
      city: myGeo?.city ?? "København",
      isp: myGeo?.isp ?? "Lokalt netværk",
      lat: myGeo?.lat ?? 55.6761,
      lon: myGeo?.lon ?? 12.5683,
      locSource: myGeo?.source ?? "Lokal session",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timezone: snapshot?.timezone ?? null,
      platform: snapshot?.platform ?? null,
      screen: snapshot?.screen ?? null,
      gpu: snapshot?.gpu ?? null,
      fingerprint: snapshot?.fingerprint ?? null,
      clicks: counters.current.clicks,
      keys: counters.current.keys,
      eventCount: events.length,
      groups: localGroups,
    };
    return [fallbackCurrent, ...sessions];
  }, [sessions, activated, events.length, localGroups, myIp, myGeo, snapshot]);

  const activeId = selectedId || allSessions[0]?.id || sid.current;
  const activeSession = useMemo(
    () => allSessions.find((s) => s.id === activeId) ?? allSessions[0] ?? null,
    [allSessions, activeId],
  );

  const activeEvents = useMemo<TelEvent[]>(() => {
    if (!activeSession) return [];
    if (activeSession.id === sid.current) {
      return events.length >= remoteEvents.length ? events : remoteEvents;
    }
    return remoteEvents;
  }, [activeSession, events, remoteEvents]);

  const activeGroups = useMemo<InfoGroup[]>(() => {
    if (!activeSession) return [];
    if (activeSession.id === sid.current && localGroups.length > 0) return localGroups;
    return activeSession.groups ?? [];
  }, [activeSession, localGroups]);

  /* ------------ statistik + keylog for den valgte klient ------------ */
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const keyCount: Record<string, number> = {};
    const targetCount: Record<string, number> = {};
    const keySequence: Array<{ id: number; key: string; at: number; target?: string }> = [];

    for (const e of activeEvents) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.type === "key" && e.key) {
        keyCount[e.key] = (keyCount[e.key] ?? 0) + 1;
        keySequence.push({ id: e.id, key: e.key, at: e.at, target: e.target });
      }
      if (e.type === "click" && e.target) {
        targetCount[e.target] = (targetCount[e.target] ?? 0) + 1;
      }
    }

    let typedBuffer = "";
    for (const k of keySequence) {
      if (k.key === "Backspace") {
        typedBuffer = typedBuffer.slice(0, -1);
      } else if (k.key === "Enter") {
        typedBuffer += " ⏎\n";
      } else if (k.key === "Tab") {
        typedBuffer += " ⇥ ";
      } else if (k.key.length === 1) {
        typedBuffer += k.key;
      }
    }

    const durSec = activeSession
      ? Math.max(1, (activeSession.lastSeenAt - activeSession.startedAt) / 1000)
      : Math.max(1, elapsed);
    const mins = Math.max(1 / 60, durSec / 60);
    const clicksCount = byType.click ?? activeSession?.clicks ?? 0;
    const keysCount = byType.key ?? activeSession?.keys ?? 0;

    return {
      byType,
      keyCount,
      keySequence,
      typedText: typedBuffer,
      topTargets: Object.entries(targetCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
      clicks: clicksCount,
      keys: keysCount,
      kpm: (keysCount / mins).toFixed(1),
      total: activeEvents.length,
    };
  }, [activeEvents, activeSession, elapsed]);

  const exportJson = useCallback(() => {
    const s = activeSession;
    const payload = {
      session: s?.id ?? sid.current,
      ip: s?.ip ?? myIp,
      location: s
        ? {
            city: s.city,
            region: s.region,
            country: s.country,
            countryCode: s.countryCode,
            lat: s.lat,
            lon: s.lon,
            isp: s.isp,
            source: s.locSource,
          }
        : myGeo,
      exportedAt: new Date().toISOString(),
      fingerprint: s?.fingerprint ?? snapshot?.fingerprint ?? null,
      groups: activeGroups,
      typedText: stats.typedText,
      events: activeEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parrot-klient-${s?.id ?? sid.current}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, [activeSession, myIp, myGeo, snapshot, activeGroups, stats.typedText, activeEvents]);

  return {
    sessionId: sid.current,
    sessions: allSessions,
    activeSession,
    selectedId: activeId,
    selectSession,
    loadingRemote,
    events: activeEvents,
    groups: activeGroups,
    stats,
    elapsed,
    paused,
    setPaused,
    loadAdminData,
    clearLog,
    exportJson,
    track: record,
  };
}
