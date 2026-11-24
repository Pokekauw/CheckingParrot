"use client";

import { useEffect, useRef, useState } from "react";
import { Habitat } from "./Habitat";
import {
  ACCESSORIES,
  ACHIEVEMENTS,
  ACTIONS,
  MOOD_LABEL,
  formatDuration,
  type ActionId,
} from "@/lib/game";
import type { useBuddy } from "@/hooks/useBuddy";
import { audio } from "@/lib/audio";

type Buddy = ReturnType<typeof useBuddy>;

const STAT_META = [
  { key: "hunger", label: "Mæthed", glyph: "◕", hue: "var(--color-amber-sun)" },
  { key: "energy", label: "Energi", glyph: "⚡", hue: "var(--color-lime-acid)" },
  { key: "joy", label: "Humør", glyph: "♥", hue: "var(--color-magenta-hot)" },
  { key: "hygiene", label: "Renlighed", glyph: "≈", hue: "var(--color-info-blue)" },
  { key: "skill", label: "Evner", glyph: "⌘", hue: "var(--color-teal-glow)" },
] as const;

function StatBar({ label, value, glyph, hue }: { label: string; value: number; glyph: string; hue: string }) {
  const v = Math.round(value);
  const low = v < 25;
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="flex items-center gap-1.5 tracking-[0.14em] text-muted">
          <span style={{ color: hue }}>{glyph}</span>
          {label.toUpperCase()}
        </span>
        <span
          className={`font-bold tabular-nums ${low ? "text-danger-red" : "text-bone"}`}
          style={low ? { animation: "glowpulse 1.1s ease-in-out infinite" } : undefined}
        >
          {v}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full border border-line/60 bg-ink-950">
        <div className="absolute inset-0 hatch opacity-[0.07]" />
        <div
          className="relative h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(2, v)}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${hue} 45%, #041014), ${hue})`,
            boxShadow: `0 0 12px -2px ${hue}`,
          }}
        />
        <div className="absolute inset-y-0 left-1/4 w-px bg-ink-950/70" />
        <div className="absolute inset-y-0 left-2/4 w-px bg-ink-950/70" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-ink-950/70" />
      </div>
    </div>
  );
}

function Panel({
  title,
  glyph,
  children,
  accent = "var(--color-teal-glow)",
  right,
}: {
  title: string;
  glyph: string;
  children: React.ReactNode;
  accent?: string;
  right?: React.ReactNode;
}) {
  return (
    <section className="panel notch relative rounded-xl p-3.5">
      <header className="mb-3 flex items-center justify-between border-b border-line/50 pb-2">
        <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em]" style={{ color: accent }}>
          <span className="text-[13px]">{glyph}</span>
          {title.toUpperCase()}
        </h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export function FrontSide({ buddy, onSecret }: { buddy: Buddy; onSecret: () => void }) {
  const { state, mood, stage, xpNeed, sessionSeconds, cooldowns, speech, talking, flap, fx, toasts, board, log } =
    buddy;
  const [, force] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nameDraft, setNameDraft] = useState(state.name);
  const [editing, setEditing] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const secretRef = useRef<HTMLButtonElement>(null);
  const peeked = ACHIEVEMENTS.find((a) => a.id === peek) ?? null;

  useEffect(() => setNameDraft(state.name), [state.name]);

  /* cooldown-ur */
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 180);
    return () => window.clearInterval(t);
  }, []);

  /* tastatur-genveje */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ACTIONS.length) {
        e.preventDefault();
        buddy.doAction(ACTIONS[n - 1].id as ActionId);
      }
      if (e.key.toLowerCase() === "m") {
        setMuted((m) => {
          audio.setMuted(!m);
          return !m;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buddy]);

  const xpPct = Math.min(100, (state.xp / xpNeed) * 100);
  const now = Date.now();

  return (
    <div className="relative min-h-screen">
      {/* ------------- topbar ------------- */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 40 40" className="shrink-0">
              <circle cx="20" cy="20" r="19" fill="#041014" stroke="#12b8ae" strokeWidth="1.5" />
              <path d="M22 9 C 30 11 33 19 30 26 C 27 32 19 33 14 29 C 20 28 25 23 25 17 Z" fill="#1ee0cf" />
              <path d="M14 13 C 9 15 8 21 11 24 C 13 20 16 17 20 16 Z" fill="#a6f53c" />
              <circle cx="21" cy="15" r="2.2" fill="#041014" />
              <path d="M12 18 l -5 3 5 3 Z" fill="#ffb422" />
            </svg>
            <div className="leading-none">
              <div className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[0.14em] text-bone">
                PARROT<span className="text-magenta-hot">//</span>BUDDY
              </div>
              <div className="mt-0.5 text-[9.5px] tracking-[0.28em] text-dim">TERMINAL-TAMAGOTCHI v2.6</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="hidden rounded-md border border-line/70 bg-ink-900 px-2.5 py-1.5 tabular-nums text-muted sm:inline">
              SESSION <span className="text-teal-glow">{formatDuration(sessionSeconds)}</span>
            </span>
            <span className="hidden rounded-md border border-line/70 bg-ink-900 px-2.5 py-1.5 md:inline">
              HUMØR{" "}
              <span style={{ color: mood === "glad" || mood === "ecstatic" ? "var(--color-lime-acid)" : "var(--color-amber-sun)" }}>
                {MOOD_LABEL[mood].toUpperCase()}
              </span>
            </span>
            <span className="rounded-md border border-lime-acid/50 bg-lime-acid/10 px-2.5 py-1.5 font-bold tabular-nums text-lime-acid">
              LVL {state.level}
            </span>
            <button
              onClick={() => {
                audio.resume();
                const next = !muted;
                setMuted(next);
                audio.setMuted(next);
                if (!next) audio.play("blip");
              }}
              data-track="lyd-toggle"
              aria-label={muted ? "Slå lyd til" : "Slå lyd fra"}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-bold transition ${
                muted
                  ? "border-danger-red/60 bg-danger-red/10 text-danger-red"
                  : "border-teal-deep/70 bg-teal-deep/15 text-teal-glow hover:border-teal-glow"
              }`}
            >
              {muted ? "🔇" : "🔊"} <span className="hidden sm:inline">{muted ? "LYD FRA" : "LYD TIL"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------- toasts ------------- */}
      <div className="pointer-events-none fixed right-3 top-16 z-50 flex w-[min(92vw,300px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-pop notch border bg-ink-950/95 px-3 py-2.5 shadow-[0_18px_40px_-20px_#000]"
            style={{ borderColor: t.hue }}
          >
            <div className="text-[11px] font-bold tracking-[0.18em]" style={{ color: t.hue }}>
              {t.title}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{t.body}</div>
          </div>
        ))}
      </div>

      {/* ------------- hovedgitter ------------- */}
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[290px_minmax(0,1fr)_300px]">
        {/* ---- venstre ---- */}
        <div className="flex flex-col gap-4">
          <Panel title="Vitaltegn" glyph="◈">
            <div className="flex flex-col gap-3">
              {STAT_META.map((s) => (
                <StatBar
                  key={s.key}
                  label={s.label}
                  glyph={s.glyph}
                  hue={s.hue}
                  value={state[s.key as "hunger" | "energy" | "joy" | "hygiene" | "skill"]}
                />
              ))}
            </div>
            <p className="mt-3 border-t border-line/40 pt-2 text-[10.5px] leading-relaxed text-dim">
              Alt falder med tiden. Bliv på siden — hvert 10. sekund giver nærvær XP.
            </p>
          </Panel>

          <Panel title="Bedrifter" glyph="✷" accent="var(--color-amber-sun)" right={
            <span className="text-[10px] tabular-nums text-dim">
              {state.achievements.length}/{ACHIEVEMENTS.length}
            </span>
          }>
            <div className="grid grid-cols-4 gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const got = state.achievements.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onMouseEnter={() => setPeek(a.id)}
                    onFocus={() => setPeek(a.id)}
                    onMouseLeave={() => setPeek(null)}
                    onClick={() => setPeek(a.id)}
                    data-track={`bedrift-${a.id}`}
                    className={`grid aspect-square place-items-center rounded-lg border text-[15px] transition ${
                      got
                        ? "border-amber-sun/70 bg-amber-sun/15 text-amber-sun shadow-[0_0_16px_-6px_var(--color-amber-sun)]"
                        : "border-line/50 bg-ink-950/60 text-dim/60 hover:border-amber-sun/40 hover:text-dim"
                    }`}
                  >
                    {got ? a.glyph : "?"}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 min-h-[34px] rounded border border-line/40 bg-ink-950/60 px-2 py-1.5 text-[10px] leading-tight">
              {peeked ? (
                <>
                  <b style={{ color: "var(--color-amber-sun)" }}>{peeked.label}</b>
                  <span className="ml-1 text-dim">
                    {state.achievements.includes(peeked.id) ? "· låst op" : "· låst"}
                  </span>
                  <div className="text-muted">{peeked.desc}</div>
                </>
              ) : (
                <span className="text-dim">peg på en badge for detaljer</span>
              )}
            </div>
          </Panel>
        </div>

        {/* ---- midten ---- */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,4vw,2.5rem)] font-bold leading-none tracking-tight text-bone">
                {state.name}
                <span className="ml-2 align-middle text-[13px] font-medium tracking-[0.2em] text-teal-glow">
                  {stage.label.toUpperCase()}
                </span>
              </h1>
              <p className="mt-1 text-[11px] text-dim">
                {state.species} · {stage.blurb} · {state.actions} handlinger udført
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-dim">
              <span className="rounded border border-line/60 px-2 py-1">TASTER 1–8 = HANDLINGER</span>
              <span className="rounded border border-line/60 px-2 py-1">M = LYD</span>
            </div>
          </div>

          <Habitat
            mood={mood}
            scale={stage.scale}
            accessories={state.accessories}
            talking={talking}
            flapKey={flap}
            level={state.level}
            poops={state.poops}
            fx={fx}
            speech={speech}
            name={state.name.toLowerCase()}
            stageLabel={stage.label}
            careSeconds={state.careSeconds}
          />

          {/* XP */}
          <div className="panel notch rounded-xl px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="tracking-[0.2em] text-muted">
                ERFARING → LEVEL {state.level + 1}
              </span>
              <span className="tabular-nums text-lime-acid">
                {Math.floor(state.xp)} / {xpNeed} XP
              </span>
            </div>
            <div className="relative h-3.5 overflow-hidden rounded-full border border-line/60 bg-ink-950">
              <div className="absolute inset-0 hatch opacity-10" />
              <div
                className="relative h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${xpPct}%`,
                  background: "linear-gradient(90deg,#0a7f83,#1ee0cf 45%,#a6f53c)",
                  boxShadow: "0 0 18px -3px var(--color-lime-acid)",
                }}
              />
            </div>
          </div>

          {/* handlingsdock */}
          <div className="panel notch rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACTIONS.map((a, i) => {
                const until = cooldowns[a.id as ActionId] ?? 0;
                const left = Math.max(0, until - now);
                const busy = left > 0;
                const blocked = a.id === "clean" && state.poops === 0;
                return (
                  <button
                    key={a.id}
                    data-track={`handling-${a.id}`}
                    onClick={() => buddy.doAction(a.id as ActionId)}
                    disabled={busy || blocked}
                    className={`group relative overflow-hidden rounded-lg border px-2.5 py-2.5 text-left transition-all duration-150 ${
                      busy || blocked
                        ? "cursor-not-allowed border-line/40 bg-ink-950/70 opacity-55"
                        : "border-line/70 bg-ink-800/60 hover:-translate-y-0.5 hover:border-current active:translate-y-0"
                    }`}
                    style={{ color: busy || blocked ? undefined : a.hue }}
                  >
                    <span
                      className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: `radial-gradient(120% 100% at 50% 120%, ${a.hue}22, transparent 70%)` }}
                    />
                    {busy && (
                      <span
                        className="absolute bottom-0 left-0 h-[3px] transition-[width] duration-100"
                        style={{ width: `${(left / a.cooldown) * 100}%`, background: a.hue }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <span className="text-[17px] leading-none" style={{ color: a.hue }}>
                        {a.glyph}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-bold text-bone">{a.label}</span>
                        <span className="block truncate text-[9.5px] text-dim">
                          {blocked ? "bakken er ren" : busy ? `${(left / 1000).toFixed(1)}s` : a.sub}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 rounded border border-current/40 px-1 text-[9px] tabular-nums opacity-80">
                        {i + 1}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---- højre ---- */}
        <div className="flex flex-col gap-4">
          <Panel title="Identitet" glyph="⚿" accent="var(--color-magenta-hot)">
            <div className="flex flex-col gap-2 text-[11px]">
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    buddy.rename(nameDraft);
                    setEditing(false);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    autoFocus
                    value={nameDraft}
                    maxLength={18}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-full rounded border border-teal-deep bg-ink-950 px-2 py-1.5 text-[12px] text-bone outline-none focus:border-lime-acid"
                    placeholder="nyt navn"
                  />
                  <button className="rounded border border-lime-acid/60 bg-lime-acid/15 px-2 text-[11px] font-bold text-lime-acid">
                    OK
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between rounded border border-line/60 bg-ink-950/60 px-2 py-1.5">
                  <span className="text-bone">{state.name}</span>
                  <button
                    onClick={() => setEditing(true)}
                    data-track="omdoeb"
                    className="text-[10px] tracking-[0.16em] text-teal-glow hover:text-lime-acid"
                  >
                    OMDØB
                  </button>
                </div>
              )}
              <Row k="Art" v={state.species} />
              <Row k="Stadie" v={stage.label} />
              <Row k="Nærvær i alt" v={formatDuration(state.careSeconds)} />
              <Row k="Bur-bakke" v={state.poops === 0 ? "ren" : `${state.poops} klatter`} warn={state.poops > 0} />
              <Row k="Nøgle" v={buddy.slug.slice(0, 12)} />
            </div>
          </Panel>

          <Panel title="Garderobe" glyph="▚" accent="var(--color-lime-acid)">
            <div className="flex flex-wrap gap-1.5">
              {ACCESSORIES.map((a) => {
                const unlocked = state.level >= a.level;
                const on = state.accessories.includes(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={!unlocked}
                    data-track={`toej-${a.id}`}
                    onClick={() => buddy.toggleAccessory(a.id)}
                    className={`rounded-md border px-2 py-1.5 text-[10.5px] transition ${
                      !unlocked
                        ? "cursor-not-allowed border-line/40 text-dim/60"
                        : on
                          ? "border-lime-acid bg-lime-acid/15 text-lime-acid"
                          : "border-line/70 text-muted hover:border-lime-acid/60 hover:text-bone"
                    }`}
                  >
                    <span className="mr-1">{a.glyph}</span>
                    {a.label}
                    {!unlocked && <span className="ml-1 text-[9px]">L{a.level}</span>}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Flokken" glyph="◭" accent="var(--color-info-blue)">
            <ol className="flex flex-col gap-1 text-[11px]">
              {[...board]
                .map((raw) => (raw.slug === state.slug ? { ...raw, level: state.level, name: state.name } : raw))
                .sort((a, b) => b.level - a.level)
                .map((b, i) => (
                  <li
                    key={b.slug}
                    className={`flex items-center gap-2 rounded px-1.5 py-1 ${
                      b.slug === state.slug
                        ? "bg-teal-deep/25 text-bone shadow-[inset_0_0_0_1px_var(--color-teal-deep)]"
                        : "text-muted"
                    }`}
                  >
                    <span className="w-4 text-right tabular-nums text-dim">{i + 1}</span>
                    <span className="flex-1 truncate">
                      {b.name}
                      {b.slug === state.slug && <span className="ml-1 text-[9px] text-teal-glow">(dig)</span>}
                    </span>
                    <span className="tabular-nums" style={{ color: i === 0 ? "var(--color-amber-sun)" : undefined }}>
                      L{b.level}
                    </span>
                  </li>
                ))}
              {board.length === 0 && <li className="text-dim">henter flokken…</li>}
            </ol>
          </Panel>

          <Panel title="Pleje-log" glyph="▤">
            <ul className="no-scrollbar flex max-h-44 flex-col gap-1 overflow-y-auto text-[10.5px]">
              {log.length === 0 && <li className="text-dim">ingen handlinger endnu</li>}
              {log.map((l) => (
                <li key={`${l.id}-${l.at}`} className="flex items-center gap-2 border-b border-line/25 py-1 last:border-0">
                  <span className="text-teal-glow">›</span>
                  <span className="flex-1 truncate text-muted">{l.label}</span>
                  <span className="tabular-nums text-lime-acid">+{l.xp}</span>
                  <span className="tabular-nums text-dim">
                    {new Date(l.at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </main>

      {/* ------------- bund ------------- */}
      <footer className="mx-auto mt-2 max-w-[1400px] px-4 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/50 pt-4 text-[10px] tracking-[0.18em] text-dim">
          <span>PARROT//BUDDY · KØRER LOKALT · INGEN DATA FORLADER DIN SESSION UDEN DIT KENDSKAB</span>
          <span className="hidden sm:inline">SESSION {formatDuration(sessionSeconds)} · {state.actions} HANDLINGER</span>
          <button
            ref={secretRef}
            onClick={onSecret}
            data-track="hemmelig-knap"
            aria-label="Åbn servicepanel"
            title="servicepanel"
            className="group grid h-5 w-5 place-items-center rounded-full border border-line/70 bg-ink-900 text-[8px] text-dim transition hover:border-magenta-hot hover:text-magenta-hot hover:shadow-[0_0_14px_-2px_var(--color-magenta-hot)]"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-dim transition group-hover:bg-magenta-hot" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border border-line/40 bg-ink-950/40 px-2 py-1.5">
      <span className="text-dim">{k}</span>
      <span className={warn ? "text-amber-sun" : "text-bone"}>{v}</span>
    </div>
  );
}