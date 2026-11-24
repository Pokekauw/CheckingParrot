"use client";

import { useEffect, useMemo, useState } from "react";
import { EVENT_META, type InfoGroup, type TelEvent, type TelEventType } from "@/lib/telemetry";
import type { useTelemetry } from "@/hooks/useTelemetry";
import { WorldMap } from "./WorldMap";
import { countryFlag } from "@/lib/geoip";
import { formatDuration } from "@/lib/game";
import { audio } from "@/lib/audio";

type Tel = ReturnType<typeof useTelemetry>;

const FILTERS: Array<{ id: TelEventType | "all"; label: string }> = [
  { id: "all", label: "ALT" },
  { id: "click", label: "KLIK" },
  { id: "key", label: "TASTER" },
  { id: "care", label: "PLEJE" },
  { id: "sys", label: "SYSTEM" },
];

const KEYS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "å"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "æ", "ø"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "-"],
];

function normKey(k: string): string {
  if (k === " ") return "mellemrum";
  return k.toLowerCase();
}

function parseViewportFromSession(screenStr: string | null | undefined, fallback: { w: number; h: number }) {
  if (!screenStr) return fallback;
  const m = screenStr.match(/^(\d+)[×x](\d+)/);
  if (!m) return fallback;
  return { w: Math.max(320, Number(m[1])), h: Math.max(240, Number(m[2])) };
}

export function Backside({ tel, onExit }: { tel: Tel; onExit: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TelEventType | "all">("all");
  const [logQuery, setLogQuery] = useState("");
  const [localVp, setLocalVp] = useState({ w: 1440, h: 900 });

  /* Hent alle klienter + valgt klients log ved åbning og poll live hvert 3. sekund */
  useEffect(() => {
    const updateVp = () => setLocalVp({ w: window.innerWidth, h: window.innerHeight });
    updateVp();
    window.addEventListener("resize", updateVp);
    void tel.loadAdminData();
    const poll = window.setInterval(() => {
      void tel.loadAdminData();
    }, 3000);
    return () => {
      window.removeEventListener("resize", updateVp);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = tel.activeSession;
  const isSelf = active?.id === tel.sessionId;
  const vp = useMemo(
    () => (isSelf ? localVp : parseViewportFromSession(active?.screen, localVp)),
    [isSelf, localVp, active?.screen],
  );

  const groups = useMemo<InfoGroup[]>(() => {
    if (!query.trim()) return tel.groups;
    const q = query.toLowerCase();
    return tel.groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => `${g.title} ${r.k} ${r.v}`.toLowerCase().includes(q)),
      }))
      .filter((g) => g.rows.length > 0);
  }, [tel.groups, query]);

  const shown = useMemo(() => {
    const q = logQuery.toLowerCase();
    return tel.events
      .filter((e) => (filter === "all" ? true : e.type === filter))
      .filter((e) =>
        q ? `${e.key ?? ""} ${e.target ?? ""} ${e.detail ?? ""} ${e.type}`.toLowerCase().includes(q) : true,
      )
      .slice(-260)
      .reverse();
  }, [tel.events, filter, logQuery]);

  const keyCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(tel.stats.keyCount)) {
      const nk = normKey(k);
      out[nk] = (out[nk] ?? 0) + v;
    }
    return out;
  }, [tel.stats.keyCount]);
  const maxKey = Math.max(1, ...Object.values(keyCounts));

  const clicks = useMemo(
    () => tel.events.filter((e) => e.type === "click" && e.x != null).slice(-140),
    [tel.events],
  );

  const totalFields = tel.groups.reduce((n, g) => n + g.rows.length, 0);
  const now = Date.now();

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="bg-grain pointer-events-none fixed inset-0 overflow-hidden" />
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(70% 50% at 12% 0%, rgba(255,47,142,.13), transparent 60%), radial-gradient(60% 45% at 88% 8%, rgba(58,165,255,.12), transparent 60%), radial-gradient(90% 60% at 50% 110%, rgba(30,224,207,.1), transparent 65%)",
        }}
      />

      {/* ---------- topbar ---------- */}
      <header className="sticky top-0 z-40 border-b border-danger-red/30 bg-ink-950/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="flex items-center gap-2 rounded-md border border-danger-red/60 bg-danger-red/10 px-2.5 py-1.5 text-[10.5px] font-bold tracking-[0.2em] text-danger-red">
            <span className="anim-rec inline-block h-2 w-2 rounded-full bg-danger-red" />
            {tel.paused ? "PAUSERET" : "LIVE"}
          </span>
          <div className="leading-none">
            <div className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[0.16em] text-bone">
              BAGSIDE<span className="text-magenta-hot">//</span>ADMIN-KORT
            </div>
            <div className="mt-0.5 text-[9.5px] tracking-[0.2em] text-dim">
              {tel.sessions.length} {tel.sessions.length === 1 ? "KLIENT" : "KLIENTER"} · INSPICERER{" "}
              <span className="text-lime-acid">{active?.id ?? tel.sessionId}</span> · {totalFields} DATAFELTER
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-[10.5px]">
            <button
              onClick={() => {
                tel.setPaused(!tel.paused);
                audio.play("blip");
              }}
              data-track="pause-optagelse"
              className={`rounded-md border px-2.5 py-1.5 font-bold tracking-[0.14em] transition ${
                tel.paused
                  ? "border-amber-sun/60 bg-amber-sun/10 text-amber-sun"
                  : "border-line/70 bg-ink-900 text-muted hover:border-amber-sun/60 hover:text-amber-sun"
              }`}
            >
              {tel.paused ? "▶ GENOPTAG" : "▮▮ PAUSE"}
            </button>
            <button
              onClick={tel.exportJson}
              data-track="eksport-json"
              className="rounded-md border border-info-blue/50 bg-info-blue/10 px-2.5 py-1.5 font-bold tracking-[0.14em] text-info-blue transition hover:bg-info-blue/20"
            >
              ↓ EKSPORTÉR KLIENT
            </button>
            <button
              onClick={() => {
                void tel.clearLog(active?.id);
                audio.play("error");
              }}
              data-track="ryd-log"
              className="rounded-md border border-line/70 bg-ink-900 px-2.5 py-1.5 font-bold tracking-[0.14em] text-muted transition hover:border-danger-red/60 hover:text-danger-red"
            >
              ⌫ RYD KLIENT-LOG
            </button>
            <button
              onClick={() => {
                audio.play("blip");
                onExit();
              }}
              data-track="laas-bagside"
              className="rounded-md border border-lime-acid/60 bg-lime-acid/10 px-2.5 py-1.5 font-bold tracking-[0.14em] text-lime-acid transition hover:bg-lime-acid/20"
            >
              ⟲ VEND OM
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1520px] px-4 py-4">
        {/* ---------- VERDENSKORT + BESØGENDE KLIENTER ---------- */}
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <WorldMap
            sessions={tel.sessions}
            selectedId={tel.selectedId}
            currentSessionId={tel.sessionId}
            onSelect={(id) => tel.selectSession(id)}
          />

          {/* Klient-liste synkroniseret med verdenskortet */}
          <section className="panel notch flex flex-col rounded-xl p-3.5">
            <header className="mb-2.5 flex items-center justify-between border-b border-line/50 pb-2">
              <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-teal-glow">
                <span>◎</span> BESØGENDE KLIENTER
              </h2>
              <button
                onClick={() => void tel.loadAdminData()}
                className="text-[9.5px] tracking-[0.16em] text-dim transition hover:text-teal-glow"
              >
                ↻ OPDATÉR
              </button>
            </header>

            <p className="mb-2.5 text-[10px] leading-snug text-dim">
              Klik på en klient på verdenskortet eller i listen herunder for at åbne dens datafelter, keylog og
              klik-historik.
            </p>

            <div className="flex max-h-[340px] flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {tel.sessions.map((s) => {
                const selected = s.id === tel.selectedId;
                const live = now - s.lastSeenAt < 35_000;
                const mine = s.id === tel.sessionId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      audio.play("blip");
                      tel.selectSession(s.id);
                    }}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${
                      selected
                        ? "border-lime-acid bg-lime-acid/10 shadow-[0_0_20px_-10px_var(--color-lime-acid)]"
                        : "border-line/60 bg-ink-950/65 hover:border-teal-deep hover:bg-ink-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-[11.5px] font-bold text-bone">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            live ? "bg-lime-acid shadow-[0_0_8px_var(--color-lime-acid)]" : "bg-amber-sun/80"
                          }`}
                        />
                        <span>{countryFlag(s.countryCode)}</span>
                        <span className="truncate">
                          {s.city || "Ukendt by"}
                          {s.country ? `, ${s.country}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-info-blue">{s.ip ?? "?"}</span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px] text-dim">
                      <span className="truncate text-muted">{s.platform || "Ukendt enhed"}</span>
                      {s.screen && <span>{s.screen}</span>}
                      {mine && (
                        <span className="rounded bg-teal-deep/30 px-1.5 py-0.2 text-[8.5px] font-bold text-teal-glow">
                          DIG
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between border-t border-line/35 pt-1 text-[9.5px]">
                      <span className="flex items-center gap-2.5">
                        <span className="text-lime-acid">
                          <b>{s.clicks}</b> klik
                        </span>
                        <span className="text-amber-sun">
                          <b>{s.keys}</b> taster
                        </span>
                      </span>
                      <span className="tabular-nums text-dim">
                        {live
                          ? "aktiv nu"
                          : new Date(s.lastSeenAt).toLocaleTimeString("da-DK", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ---------- VALGT KLIENT-BANNER + NØGLETAL ---------- */}
        {active && (
          <section className="panel notch mb-4 rounded-xl p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.2em] text-lime-acid">
                  <span>VALGT KLIENT</span>
                  <span className="rounded border border-line/70 bg-ink-950 px-1.5 py-0.5 text-muted">
                    {active.id}
                  </span>
                  {isSelf && (
                    <span className="rounded border border-teal-glow/50 bg-teal-deep/25 px-1.5 py-0.5 text-teal-glow">
                      DENNE BROWSER-SESSION
                    </span>
                  )}
                  {tel.loadingRemote && <span className="text-amber-sun">henter klientdata…</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-bone">
                    {countryFlag(active.countryCode)} {active.city || "Ukendt by"}
                    {active.region ? `, ${active.region}` : ""} · {active.country || "Ukendt land"}
                  </h2>
                  <span className="font-mono text-xs font-bold text-info-blue">{active.ip ?? "ukendt IP"}</span>
                  {active.lat != null && active.lon != null && (
                    <span className="text-[11px] tabular-nums text-dim">
                      ({active.lat.toFixed(3)}°, {active.lon.toFixed(3)}° · {active.isp || "ukendt ISP"})
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniMetric label="Klik" value={String(tel.stats.clicks)} hue="var(--color-lime-acid)" />
                <MiniMetric label="Tastetryk" value={String(tel.stats.keys)} hue="var(--color-amber-sun)" />
                <MiniMetric label="Taster/min" value={tel.stats.kpm} hue="var(--color-magenta-hot)" />
                <MiniMetric
                  label="Varighed"
                  value={formatDuration(Math.max(1, Math.round((active.lastSeenAt - active.startedAt) / 1000)))}
                  hue="var(--color-teal-glow)"
                />
              </div>
            </div>
          </section>
        )}

        {/* ---------- KEYLOG + HÆNDELSESLOG + KLIK-KORT ---------- */}
        <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Venstre: Hændelseslog */}
          <section className="panel notch flex min-h-[430px] flex-col rounded-xl p-3.5">
            <header className="mb-2 flex flex-wrap items-center gap-2 border-b border-line/50 pb-2">
              <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-lime-acid">
                <span className="anim-rec inline-block h-1.5 w-1.5 rounded-full bg-danger-red" />
                KLIENTENS HÆNDELSESLOG
              </h2>
              <input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="søg i klientens log…"
                data-track="soeg-log"
                className="ml-auto w-44 rounded border border-line/70 bg-ink-950 px-2 py-1 text-[10.5px] text-bone outline-none placeholder:text-dim focus:border-lime-acid"
              />
            </header>

            <div className="mb-2 flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const isActive = filter === f.id;
                const count = f.id === "all" ? tel.stats.total : (tel.stats.byType[f.id] ?? 0);
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    data-track={`filter-${f.id}`}
                    className={`rounded border px-2 py-1 text-[9.5px] font-bold tracking-[0.12em] transition ${
                      isActive
                        ? "border-lime-acid bg-lime-acid/15 text-lime-acid"
                        : "border-line/60 text-dim hover:border-teal-deep hover:text-muted"
                    }`}
                  >
                    {f.label} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: "54vh" }}>
              {shown.length === 0 && (
                <p className="py-10 text-center text-[11px] text-dim">
                  ingen registrerede hændelser for denne klient endnu
                </p>
              )}
              <ul className="flex flex-col gap-[3px]">
                {shown.map((e) => (
                  <LogRow key={`${e.id}-${e.at}`} e={e} />
                ))}
              </ul>
            </div>
          </section>

          {/* Højre: Keylog-strøm + Tastatur-heatmap + Klik-kort */}
          <div className="flex flex-col gap-4">
            {/* Rekonstrueret keylog */}
            <section className="panel notch rounded-xl p-3.5">
              <header className="mb-2.5 flex items-center justify-between border-b border-line/50 pb-2">
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-amber-sun">
                  ⌨ KEYLOG · INDTASTET STRØM
                </h2>
                <span className="text-[9.5px] tabular-nums text-dim">{tel.stats.keys} tastetryk</span>
              </header>

              <div className="min-h-[66px] max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-line/60 bg-ink-950 p-2.5 font-mono text-[11.5px] leading-relaxed text-bone">
                {tel.stats.typedText ? (
                  <span>
                    {tel.stats.typedText}
                    <span className="caret" />
                  </span>
                ) : (
                  <span className="text-dim">ingen bogstaver/tal indtastet af denne klient endnu…</span>
                )}
              </div>

              {tel.stats.keySequence.length > 0 && (
                <div className="mt-2.5 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                  {tel.stats.keySequence.slice(-40).map((k) => (
                    <span
                      key={`${k.id}-${k.at}`}
                      className="rounded border border-amber-sun/40 bg-amber-sun/10 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-sun"
                      title={k.target ?? ""}
                    >
                      {k.key === " " ? "␣" : k.key}
                    </span>
                  ))}
                </div>
              )}

              {/* Tastatur-heatmap */}
              <div className="mt-3 border-t border-line/40 pt-3">
                <div className="flex flex-col gap-1">
                  {KEYS.map((row, ri) => (
                    <div key={ri} className="flex justify-center gap-1" style={{ paddingLeft: ri * 8 }}>
                      {row.map((k) => (
                        <KeyCap key={k} k={k} n={keyCounts[k] ?? 0} max={maxKey} />
                      ))}
                    </div>
                  ))}
                  <div className="mt-1 flex justify-center gap-1">
                    <KeyCap k="mellemrum" n={keyCounts["mellemrum"] ?? 0} max={maxKey} wide={5} />
                    <KeyCap k="enter" n={keyCounts["enter"] ?? 0} max={maxKey} wide={2} />
                    <KeyCap k="backspace" n={keyCounts["backspace"] ?? 0} max={maxKey} wide={2} />
                    <KeyCap k="shift" n={keyCounts["shift"] ?? 0} max={maxKey} wide={2} />
                    <KeyCap k="escape" n={keyCounts["escape"] ?? 0} max={maxKey} wide={2} />
                  </div>
                </div>
              </div>
            </section>

            {/* Klik-kort */}
            <section className="panel notch rounded-xl p-3.5">
              <header className="mb-2.5 flex items-center justify-between border-b border-line/50 pb-2">
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-magenta-hot">⊙ KLIK-KORT</h2>
                <span className="text-[9.5px] tabular-nums text-dim">
                  {vp.w}×{vp.h}
                </span>
              </header>
              <div
                className="relative w-full overflow-hidden rounded-lg border border-line/60 bg-ink-950"
                style={{ aspectRatio: `${vp.w} / ${Math.max(vp.h, 1)}` }}
              >
                <div className="grid-floor absolute inset-0 opacity-25" />
                {clicks.map((c, i) => (
                  <span
                    key={`${c.id}-${c.at}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${Math.min(100, ((c.x ?? 0) / vp.w) * 100)}%`,
                      top: `${Math.min(100, ((c.y ?? 0) / vp.h) * 100)}%`,
                      width: 9,
                      height: 9,
                      background: i === clicks.length - 1 ? "var(--color-lime-acid)" : "var(--color-magenta-hot)",
                      opacity: 0.3 + (i / Math.max(1, clicks.length)) * 0.7,
                      boxShadow: "0 0 10px currentColor",
                    }}
                    title={c.target}
                  />
                ))}
                {clicks.length === 0 && (
                  <span className="absolute inset-0 grid place-items-center text-[10px] text-dim">
                    ingen klik registreret for denne klient endnu
                  </span>
                )}
              </div>
              {tel.stats.topTargets.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1">
                  <div className="text-[9.5px] tracking-[0.18em] text-dim">MEST KLIKKEDE ELEMENTER</div>
                  {tel.stats.topTargets.map(([t, n]) => (
                    <div key={t} className="flex items-center gap-2 text-[10px]">
                      <span className="w-6 text-right tabular-nums text-magenta-hot">{n}</span>
                      <span className="truncate text-muted">{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ---------- KLIENTENS DATAFELTER ---------- */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.2em] text-teal-glow">
            KLIENTENS DATAFELTER ({active?.id ?? tel.sessionId})
          </h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filtrér felter (fx ip, lokation, gpu, skærm)…"
            data-track="soeg-felter"
            className="ml-auto w-full max-w-xs rounded-md border border-line/70 bg-ink-950 px-3 py-1.5 text-[11px] text-bone outline-none transition placeholder:text-dim focus:border-teal-glow"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <section key={g.id} className="panel notch rounded-xl p-3.5">
              <header className="mb-2.5 flex items-center gap-2 border-b border-line/50 pb-2">
                <span className="text-[15px]" style={{ color: g.hue }}>
                  {g.glyph}
                </span>
                <h3 className="text-[11px] font-bold tracking-[0.2em]" style={{ color: g.hue }}>
                  {g.title.toUpperCase()}
                </h3>
                <span className="ml-auto text-[9.5px] tabular-nums text-dim">{g.rows.length}</span>
              </header>
              <dl className="flex flex-col gap-1">
                {g.rows.map((r, i) => (
                  <div
                    key={`${r.k}-${i}`}
                    className="flex items-start justify-between gap-3 rounded border border-transparent px-1.5 py-1 text-[10.5px] transition hover:border-line/60 hover:bg-ink-800/40"
                  >
                    <dt className="shrink-0 text-dim">{r.k}</dt>
                    <dd
                      className={`break-all text-right ${r.hot ? "font-bold" : "text-muted"}`}
                      style={r.hot ? { color: g.hue } : undefined}
                    >
                      {r.v || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {groups.length === 0 && <p className="text-[11px] text-dim">ingen felter matcher «{query}»</p>}
        </div>
      </main>
    </div>
  );
}

function MiniMetric({ label, value, hue }: { label: string; value: string; hue: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-ink-950/75 px-3 py-1.5">
      <div className="text-[9px] tracking-[0.18em] text-dim">{label.toUpperCase()}</div>
      <div className="font-[family-name:var(--font-display)] text-base font-bold tabular-nums" style={{ color: hue }}>
        {value}
      </div>
    </div>
  );
}

function LogRow({ e }: { e: TelEvent }) {
  const meta = EVENT_META[e.type] ?? EVENT_META.sys;
  const time = new Date(e.at).toLocaleTimeString("da-DK", { hour12: false });
  return (
    <li className="flex items-start gap-2 rounded border border-transparent px-1.5 py-1 text-[10.5px] leading-tight transition hover:border-line/50 hover:bg-ink-800/40">
      <span className="shrink-0 tabular-nums text-dim">{time}</span>
      <span
        className="w-12 shrink-0 rounded px-1 text-center text-[8.5px] font-bold tracking-wider"
        style={{ color: meta.hue, background: `color-mix(in oklab, ${meta.hue} 14%, transparent)` }}
      >
        {meta.label}
      </span>
      <span className="min-w-0 flex-1">
        {e.key && (
          <span
            className="mr-1.5 inline-block rounded border px-1 font-bold"
            style={{ borderColor: meta.hue, color: meta.hue }}
          >
            {e.key === " " ? "␣" : e.key}
          </span>
        )}
        {e.target && <span className="text-muted">{e.target}</span>}
        {e.detail && <span className="block truncate text-[9.5px] text-dim">{e.detail}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-dim/70">+{(e.tMs / 1000).toFixed(1)}s</span>
    </li>
  );
}

function KeyCap({ k, n, max, wide = 1 }: { k: string; n: number; max: number; wide?: number }) {
  const t = n / max;
  const label = k.length > 3 ? k.slice(0, 6) : k;
  return (
    <div
      className="flex h-8 flex-col items-center justify-center gap-0 rounded border text-[9.5px] font-bold leading-none transition-all duration-300"
      style={{
        flex: `${wide} 1 0`,
        minWidth: wide > 1 ? 52 : 24,
        borderColor: n
          ? `color-mix(in oklab, var(--color-amber-sun) ${20 + t * 80}%, var(--color-line))`
          : "color-mix(in oklab, var(--color-line) 60%, transparent)",
        background: n
          ? `color-mix(in oklab, var(--color-amber-sun) ${8 + t * 62}%, var(--color-ink-950))`
          : "color-mix(in oklab, var(--color-ink-900) 70%, transparent)",
        color: n ? (t > 0.6 ? "#1a0d00" : "var(--color-amber-sun)") : "var(--color-dim)",
        boxShadow: n ? `0 0 ${4 + t * 16}px -4px var(--color-amber-sun)` : undefined,
      }}
      title={`${k}: ${n} tryk`}
    >
      {label}
      {n > 0 && <span className="text-[8px] opacity-80">{n}</span>}
    </div>
  );
}
