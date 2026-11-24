"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIONS,
  applyAction,
  applyDecay,
  checkAchievements,
  grantXp,
  lineForAction,
  moodOf,
  newBuddy,
  randomLine,
  stageFor,
  xpForLevel,
  type ActionDef,
  type ActionId,
  type BuddyState,
} from "@/lib/game";
import { audio } from "@/lib/audio";

export type Fx = { id: number; kind: string; label: string; hue: string };
export type Toast = { id: number; title: string; body: string; hue: string };
export type BoardRow = { slug: string; name: string; level: number; careSeconds: number; isBot: boolean };
export type LogRow = { id: number; kind: string; label: string; xp: number; at: string };

const SLUG_KEY = "pb.slug";
const CACHE_KEY = "pb.cache";

function makeSlug(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().slice(0, 18);
  return `b${Math.random().toString(36).slice(2, 12)}`;
}

export function useBuddy(onTrack?: (label: string) => void) {
  const [state, setState] = useState<BuddyState>(() => newBuddy("local"));
  const [ready, setReady] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [cooldowns, setCooldowns] = useState<Partial<Record<ActionId, number>>>({});
  const [speech, setSpeech] = useState("Booter fjer... goddag, menneske.");
  const [talking, setTalking] = useState(false);
  const [flap, setFlap] = useState(0);
  const [fx, setFx] = useState<Fx[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [offline, setOffline] = useState(0);

  const slugRef = useRef<string>("local");
  const uid = useRef(1);
  const stateRef = useRef(state);
  const poopRef = useRef(0);

  const commit = useCallback((next: BuddyState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /* ------------------------------ helpers --------------------------- */
  const pushFx = useCallback((kind: string, label: string, hue: string) => {
    const id = uid.current++;
    setFx((f) => [...f.slice(-14), { id, kind, label, hue }]);
    window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), 1900);
  }, []);

  const pushToast = useCallback((title: string, body: string, hue: string) => {
    const id = uid.current++;
    setToasts((t) => [...t.slice(-3), { id, title, body, hue }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  const say = useCallback((line: string) => {
    setSpeech(line);
    setTalking(true);
    window.setTimeout(() => setTalking(false), 1400);
  }, []);

  const save = useCallback((s: BuddyState, entry?: { kind: string; label: string; xp: number }) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {
      /* ignorer */
    }
    void fetch("/api/buddy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: s.slug, state: s, entry }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  const announceLevel = useCallback(
    (level: number) => {
      const st = stageFor(level);
      audio.play("levelup");
      pushToast(`LEVEL ${level}`, `${st.label} · ${st.blurb}`, "var(--color-lime-acid)");
      pushFx("spark", `LEVEL ${level}!`, "var(--color-lime-acid)");
    },
    [pushFx, pushToast],
  );

  /* ------------------------------ indlæs ---------------------------- */
  useEffect(() => {
    let slug = "";
    try {
      slug = localStorage.getItem(SLUG_KEY) ?? "";
      if (!slug) {
        slug = makeSlug();
        localStorage.setItem(SLUG_KEY, slug);
      }
    } catch {
      slug = makeSlug();
    }
    slugRef.current = slug;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as BuddyState;
        if (parsed?.slug === slug) {
          stateRef.current = parsed;
          setState(parsed);
        } else {
          stateRef.current = newBuddy(slug);
          setState(stateRef.current);
        }
      } else {
        stateRef.current = newBuddy(slug);
        setState(stateRef.current);
      }
    } catch {
      /* ignorer */
    }

    let alive = true;
    fetch(`/api/buddy?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { ok: boolean; state: BuddyState; offlineSeconds: number; log: LogRow[]; board: BoardRow[] } | null) => {
          if (!alive || !d?.ok) return;
          stateRef.current = d.state;
          setState(d.state);
          setOffline(d.offlineSeconds);
          setLog(d.log);
          setBoard(d.board);
          if (d.offlineSeconds > 90) {
            const mins = Math.round(d.offlineSeconds / 60);
            setSpeech(`Du var væk i ${mins} min. Jeg ventede. Og sultede.`);
          }
        },
      )
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  /* ------------------------------ ur -------------------------------- */
  useEffect(() => {
    const t = window.setInterval(() => {
      setSessionSeconds((s) => s + 1);

      const prev = stateRef.current;
      let next = applyDecay(prev, 1);
      const visible = typeof document === "undefined" || document.visibilityState === "visible";
      let leveledTo = 0;

      if (visible) {
        next.careSeconds = prev.careSeconds + 1;
        if (next.careSeconds % 10 === 0) {
          const bonus = next.asleep ? 1 : 3;
          const g = grantXp(next, bonus);
          next = g.state;
          if (g.leveled > 0) leveledTo = g.state.level;
          else pushFx("xp", `+${bonus} XP`, "var(--color-teal-glow)");
        }
      }

      poopRef.current += 1;
      if (poopRef.current >= 40 && !next.asleep) {
        poopRef.current = 0;
        if (next.poops < 4) {
          next.poops += 1;
          next.hygiene = Math.max(0, next.hygiene - 4);
        }
      }

      const a = checkAchievements(next);
      next = a.state;
      commit(next);

      if (leveledTo) announceLevel(leveledTo);
      for (const u of a.unlocked) {
        pushToast(`BEDRIFT: ${u.label}`, u.desc, "var(--color-amber-sun)");
        audio.play("happy");
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [commit, pushFx, pushToast, announceLevel]);

  /* -------------------- autosave + talebobler ----------------------- */
  useEffect(() => {
    const t = window.setInterval(() => save(stateRef.current), 9000);
    const onHide = () => save(stateRef.current);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [save]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Math.random() < 0.6) setSpeech(randomLine(moodOf(stateRef.current)));
    }, 11000);
    return () => window.clearInterval(t);
  }, []);

  /* ------------------------------ actions --------------------------- */
  const doAction = useCallback(
    (id: ActionId) => {
      const def = ACTIONS.find((a) => a.id === id) as ActionDef | undefined;
      if (!def) return;
      const now = Date.now();
      if ((cooldowns[id] ?? 0) > now) {
        audio.play("error");
        return;
      }
      if (def.id === "clean" && stateRef.current.poops === 0) return;
      audio.resume();
      setCooldowns((c) => ({ ...c, [id]: now + def.cooldown }));

      let next = applyAction(stateRef.current, def);
      const g = grantXp(next, def.xp);
      next = g.state;
      const a = checkAchievements(next);
      next = a.state;
      commit(next);

      if (g.leveled > 0) announceLevel(g.state.level);
      for (const u of a.unlocked) pushToast(`BEDRIFT: ${u.label}`, u.desc, "var(--color-amber-sun)");

      audio.play(def.sound);
      if (def.id === "play" || def.id === "pet") setFlap((f) => f + 1);
      pushFx(def.particle, `+${def.xp} XP`, def.hue);
      say(def.id === "sleep" && !next.asleep ? "Godmorgen! Fjerene er opladet." : lineForAction(def.id));
      setLog((l) => [
        { id: uid.current++, kind: def.id, label: def.label, xp: def.xp, at: new Date().toISOString() },
        ...l.slice(0, 39),
      ]);
      save(next, { kind: def.id, label: def.label, xp: def.xp });
      onTrack?.(`pleje: ${def.label} (+${def.xp} XP)`);
    },
    [cooldowns, commit, announceLevel, pushFx, pushToast, say, save, onTrack],
  );

  const toggleAccessory = useCallback(
    (accId: string) => {
      audio.resume();
      audio.play("blip");
      const prev = stateRef.current;
      const has = prev.accessories.includes(accId);
      const next = {
        ...prev,
        accessories: has ? prev.accessories.filter((x) => x !== accId) : [...prev.accessories, accId],
      };
      const a = checkAchievements(next);
      commit(a.state);
      for (const u of a.unlocked) pushToast(`BEDRIFT: ${u.label}`, u.desc, "var(--color-amber-sun)");
      save(a.state);
    },
    [commit, pushToast, save],
  );

  const rename = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 18) || "Sudo";
      const next = { ...stateRef.current, name: clean };
      commit(next);
      save(next);
      say(`Kald mig ${clean}. Jeg opdaterer min hostname.`);
      audio.play("chirp");
    },
    [commit, save, say],
  );

  const mood = useMemo(() => moodOf(state), [state]);
  const stage = useMemo(() => stageFor(state.level), [state.level]);
  const xpNeed = xpForLevel(state.level);

  return {
    state,
    ready,
    mood,
    stage,
    xpNeed,
    sessionSeconds,
    cooldowns,
    speech,
    talking,
    flap,
    fx,
    toasts,
    board,
    log,
    offline,
    doAction,
    toggleAccessory,
    rename,
    say,
    slug: slugRef.current,
  };
}