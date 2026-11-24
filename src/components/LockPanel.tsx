"use client";

import { useCallback, useEffect, useState } from "react";
import { audio } from "@/lib/audio";

export function LockPanel({
  open,
  onClose,
  onUnlock,
}: {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/telemetry/unlock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        const data = (await res.json()) as { ok: boolean };
        if (data.ok) {
          audio.play("unlock");
          setCode("");
          setAttempts(0);
          onUnlock();
        } else {
          audio.play("error");
          setAttempts((a) => a + 1);
          setError("ADGANG NÆGTET · forkert servicekode");
          setShake(true);
          setTimeout(() => setShake(false), 520);
          setCode("");
        }
      } catch {
        setError("ingen forbindelse til serviceporten");
      } finally {
        setBusy(false);
      }
    },
    [onUnlock],
  );

  const press = useCallback(
    (d: string) => {
      audio.resume();
      if (busy) return;
      audio.play("blip");
      setError("");
      const next = (code + d).slice(0, 4);
      setCode(next);
      if (next.length === 4) void submit(next);
    },
    [code, busy, submit],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Enter" && code.length === 4) void submit(code);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, press, code, submit, onClose]);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <button
        aria-label="Luk"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/85 backdrop-blur-sm"
      />
      <div
        className={`anim-pop panel relative w-[min(94vw,380px)] rounded-2xl p-5 ${shake ? "anim-shake" : ""}`}
        style={{ boxShadow: "0 40px 90px -30px #000, 0 0 60px -20px var(--color-magenta-hot)" }}
      >
        {/* skruer */}
        {[
          "left-2 top-2",
          "right-2 top-2",
          "left-2 bottom-2",
          "right-2 bottom-2",
        ].map((p) => (
          <span key={p} className={`absolute ${p} h-2.5 w-2.5 rounded-full border border-line bg-ink-800`}>
            <span className="absolute left-1/2 top-1/2 h-[1px] w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-dim" />
          </span>
        ))}

        <div className="hatch mb-4 h-2 rounded-full opacity-70" />

        <div className="text-center">
          <div className="text-[10px] tracking-[0.34em] text-danger-red">ADGANG BEGRÆNSET</div>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tracking-[0.1em] text-bone">
            SERVICEPANEL
          </h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Indtast den 4-cifrede servicekode for at vende enheden om.
          </p>
        </div>

        <div className="my-5 flex justify-center gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`grid h-12 w-11 place-items-center rounded-lg border text-lg font-bold transition ${
                code.length > i
                  ? "border-lime-acid bg-lime-acid/10 text-lime-acid shadow-[0_0_18px_-6px_var(--color-lime-acid)]"
                  : "border-line/70 bg-ink-950 text-dim"
              }`}
            >
              {code.length > i ? "•" : "_"}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeyBtn key={d} onClick={() => press(d)} label={d} />
          ))}
          <KeyBtn onClick={() => setCode("")} label="C" tone="danger" />
          <KeyBtn onClick={() => press("0")} label="0" />
          <KeyBtn
            onClick={() => code.length === 4 && void submit(code)}
            label={busy ? "…" : "OK"}
            tone="ok"
          />
        </div>

        <div className="mt-4 h-8 text-center text-[10.5px] leading-tight">
          {error ? (
            <span className="text-danger-red">
              {error}
              {attempts > 1 && <span className="block text-dim">forsøg nr. {attempts}</span>}
            </span>
          ) : (
            <span className="text-dim">
              {busy ? "verificerer mod serviceporten…" : "tast koden eller brug tasterne 0–9"}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-1 w-full rounded-lg border border-line/70 py-2 text-[10.5px] tracking-[0.2em] text-muted transition hover:border-teal-deep hover:text-bone"
        >
          TILBAGE TIL FUGLEN (ESC)
        </button>
      </div>
    </div>
  );
}

function KeyBtn({
  onClick,
  label,
  tone = "normal",
}: {
  onClick: () => void;
  label: string;
  tone?: "normal" | "ok" | "danger";
}) {
  const tones = {
    normal: "border-line/70 bg-ink-800/70 text-bone hover:border-teal-glow hover:text-teal-glow",
    ok: "border-lime-acid/60 bg-lime-acid/10 text-lime-acid hover:bg-lime-acid/20",
    danger: "border-danger-red/50 bg-danger-red/10 text-danger-red hover:bg-danger-red/20",
  } as const;
  return (
    <button
      onClick={onClick}
      data-track={`keypad-${label}`}
      className={`rounded-lg border py-3 text-base font-bold tabular-nums transition active:scale-95 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}