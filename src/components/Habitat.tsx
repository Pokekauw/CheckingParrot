"use client";

import { memo, useMemo } from "react";
import { Parrot } from "./Parrot";
import type { Fx } from "@/hooks/useBuddy";
import type { Mood } from "@/lib/game";

const GLYPH: Record<string, string> = {
  heart: "♥",
  crumb: "•",
  spark: "✦",
  code: "⌘",
  drop: "◦",
  zzz: "z",
  xp: "▲",
};

type Props = {
  mood: Mood;
  scale: number;
  accessories: string[];
  talking: boolean;
  flapKey: number;
  level: number;
  poops: number;
  fx: Fx[];
  speech: string;
  name: string;
  stageLabel: string;
  careSeconds: number;
};

export const Habitat = memo(function Habitat({
  mood,
  scale,
  accessories,
  talking,
  flapKey,
  level,
  poops,
  fx,
  speech,
  name,
  stageLabel,
  careSeconds,
}: Props) {
  const asleep = mood === "sover";

  const motes = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        top: `${20 + ((i * 53) % 70)}%`,
        dur: `${9 + (i % 7) * 2.4}s`,
        delay: `${(i % 9) * 1.3}s`,
        dx: `${((i % 5) - 2) * 22}px`,
        size: i % 4 === 0 ? 3 : 2,
      })),
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-line/80 bg-ink-950 bg-grain scanlines">
      {/* ---------- baggrundslag ---------- */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: asleep
            ? "radial-gradient(120% 80% at 50% 10%, #0a1b3a 0%, #04101a 55%, #01060a 100%)"
            : "radial-gradient(120% 85% at 50% 8%, #0b3b45 0%, #05202a 48%, #010a0e 100%)",
          transition: "background 900ms ease",
        }}
      />
      <div
        className="anim-aurora pointer-events-none absolute -inset-24 opacity-70 blur-3xl"
        style={{
          background: asleep
            ? "radial-gradient(35% 40% at 25% 30%, rgba(58,165,255,.35), transparent 70%), radial-gradient(30% 35% at 75% 60%, rgba(120,60,255,.28), transparent 70%)"
            : "radial-gradient(32% 38% at 22% 28%, rgba(30,224,207,.42), transparent 70%), radial-gradient(30% 34% at 78% 62%, rgba(166,245,60,.26), transparent 70%), radial-gradient(26% 30% at 60% 12%, rgba(255,47,142,.22), transparent 70%)",
        }}
      />
      <div
        className="grid-floor pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          transform: "perspective(420px) rotateX(62deg)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, black, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent 85%)",
        }}
      />
      {motes.map((m, i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-full bg-teal-glow text-teal-glow"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            ["--dx" as string]: m.dx,
            animation: `drift ${m.dur} linear ${m.delay} infinite`,
            boxShadow: "0 0 8px currentColor",
          }}
        />
      ))}

      {/* ---------- HUD ---------- */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-[10px] tracking-[0.18em] text-teal-glow/70">
        <div className="flex items-start justify-between">
          <span className="rounded border border-teal-deep/60 bg-ink-950/70 px-2 py-1">CAM-01 · BURET</span>
          <span className="flex items-center gap-1.5 rounded border border-danger-red/50 bg-ink-950/70 px-2 py-1 text-danger-red">
            <span className="anim-rec inline-block h-1.5 w-1.5 rounded-full bg-danger-red" />
            LIVE
          </span>
        </div>
        <div className="flex items-end justify-between">
          <span className="rounded border border-line/60 bg-ink-950/70 px-2 py-1">
            {stageLabel.toUpperCase()} · LVL {level}
          </span>
          <span className="rounded border border-line/60 bg-ink-950/70 px-2 py-1">
            NÆRVÆR {Math.floor(careSeconds / 60)}m {careSeconds % 60}s
          </span>
        </div>
      </div>

      {/* ---------- taleboble ---------- */}
      <div className="pointer-events-none absolute left-1/2 top-11 z-20 w-[min(86%,420px)] -translate-x-1/2">
        <div
          key={speech}
          className="anim-pop notch relative border border-lime-acid/50 bg-ink-950/92 px-4 py-2.5 text-center text-[12.5px] leading-snug text-lime-acid shadow-[0_0_30px_-8px_rgba(166,245,60,.5)]"
        >
          <span className="mr-1.5 text-teal-glow">{name}@buddy:~$</span>
          {speech}
          <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-lime-acid/50 bg-ink-950" />
        </div>
      </div>

      {/* ---------- papegøje ---------- */}
      <div className="relative z-10 mx-auto flex h-[clamp(340px,46vh,460px)] w-full max-w-[440px] items-end justify-center px-4 pb-2 pt-16">
        <Parrot mood={mood} scale={scale} accessories={accessories} talking={talking} flapKey={flapKey} level={level} />
      </div>

      {/* ---------- bur-lort ---------- */}
      {poops > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-6">
          {Array.from({ length: poops }).map((_, i) => (
            <svg key={i} width="26" height="18" viewBox="0 0 26 18" className="anim-pop drop-shadow">
              <ellipse cx="13" cy="13" rx="11" ry="4.5" fill="#4d3b16" />
              <ellipse cx="10" cy="9" rx="7" ry="4" fill="#6b5320" />
              <ellipse cx="15" cy="7" rx="5" ry="3.2" fill="#836829" />
              <circle cx="11" cy="7.5" r="1.1" fill="#a6f53c" opacity="0.5" />
            </svg>
          ))}
        </div>
      )}

      {/* ---------- effekter ---------- */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        {fx.map((f, i) => (
          <span
            key={f.id}
            className="absolute select-none font-bold"
            style={{
              left: `${42 + ((i * 13) % 22)}%`,
              bottom: "26%",
              color: f.hue,
              fontSize: f.kind === "xp" || f.kind === "spark" ? 15 : 22,
              textShadow: "0 0 12px currentColor",
              ["--dx" as string]: `${((i % 5) - 2) * 26}px`,
              animation: "rise 1.8s ease-out forwards",
            }}
          >
            {GLYPH[f.kind] ?? "✦"} {f.label}
          </span>
        ))}
      </div>

      {/* nat-slør */}
      {asleep && <div className="pointer-events-none absolute inset-0 z-[15] bg-[#020a1a]/45" />}
    </div>
  );
});