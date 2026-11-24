"use client";

import { useCallback, useEffect, useState } from "react";
import { FrontSide } from "@/components/FrontSide";
import { Backside } from "@/components/Backside";
import { LockPanel } from "@/components/LockPanel";
import { useBuddy } from "@/hooks/useBuddy";
import { useTelemetry } from "@/hooks/useTelemetry";
import { audio } from "@/lib/audio";

const BOOT = [
  "[ ok ] starter parrot-buddy kerne 2.6.1",
  "[ ok ] monterer /dev/bur",
  "[ ok ] indlæser fjer-driver ................ done",
  "[ ok ] kalibrerer næb-sensor",
  "[ ok ] vækker papegøjen",
];

export default function Page() {
  const [side, setSide] = useState<"front" | "back">("front");
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [lockOpen, setLockOpen] = useState(false);

  const tel = useTelemetry(side === "front" && !lockOpen);
  const track = tel.track;
  const onCare = useCallback(
    (label: string) => {
      track("care", { detail: label, target: "buddy" });
    },
    [track],
  );
  const buddy = useBuddy(onCare);
  const [booted, setBooted] = useState(false);
  const [bootLine, setBootLine] = useState(0);

  /* boot-sekvens */
  useEffect(() => {
    const step = window.setInterval(() => setBootLine((n) => n + 1), 190);
    const done = window.setTimeout(() => setBooted(true), 1250);
    return () => {
      window.clearInterval(step);
      window.clearTimeout(done);
    };
  }, []);

  /* lyd må først starte efter en brugerhandling */
  useEffect(() => {
    const wake = () => audio.resume();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  const flip = useCallback(
    (next: "front" | "back") => {
      if (phase !== "idle") return;
      setPhase("out");
      window.setTimeout(() => {
        setSide(next);
        window.scrollTo({ top: 0 });
        setPhase("in");
        window.setTimeout(() => setPhase("idle"), 440);
      }, 330);
    },
    [phase],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* boot-overlay */}
      {!booted && (
        <div
          onClick={() => setBooted(true)}
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-ink-950 p-6 font-mono text-[12px] text-lime-acid"
        >
          <div className="scanlines pointer-events-none absolute inset-0" />
          {BOOT.slice(0, bootLine + 1).map((l) => (
            <div key={l} className="anim-pop">
              {l}
            </div>
          ))}
          <div className="mt-2 caret text-teal-glow">parrot@buddy:~$ ./start --buddy</div>
        </div>
      )}

      <div
        className={phase === "out" ? "anim-flipout" : phase === "in" ? "anim-flipin" : ""}
        style={{ transformStyle: "preserve-3d" }}
      >
        {side === "front" ? (
          <FrontSide buddy={buddy} onSecret={() => setLockOpen(true)} />
        ) : (
          <Backside tel={tel} onExit={() => flip("front")} />
        )}
      </div>

      <LockPanel
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        onUnlock={() => {
          setLockOpen(false);
          flip("back");
        }}
      />
    </div>
  );
}