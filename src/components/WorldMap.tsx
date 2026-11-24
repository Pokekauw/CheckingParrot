"use client";

import { useMemo, useRef, useState } from "react";
import { BORDER_PATH, LAND_PATH, MAP_H, MAP_W, projectLatLon } from "@/lib/worldPaths";
import { countryFlag } from "@/lib/geoip";
import type { SessionRow } from "@/hooks/useTelemetry";
import { audio } from "@/lib/audio";

type Props = {
  sessions: SessionRow[];
  selectedId: string;
  currentSessionId: string;
  onSelect: (id: string) => void;
};

type ViewBox = { x: number; y: number; w: number; h: number };

const WORLD_VIEW: ViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
const EUROPE_VIEW: ViewBox = { x: 430, y: 38, w: 195, h: 115 };

export function WorldMap({ sessions, selectedId, currentSessionId, onSelect }: Props) {
  const [view, setView] = useState<ViewBox>(WORLD_VIEW);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement>(null);

  const now = Date.now();

  /* Beregn klient-punkter med lille spredning hvis flere deler samme koordinat */
  const nodes = useMemo(() => {
    const valid = sessions.map((s) => {
      const lat = typeof s.lat === "number" && isFinite(s.lat) ? s.lat : 55.6761;
      const lon = typeof s.lon === "number" && isFinite(s.lon) ? s.lon : 12.5683;
      const base = projectLatLon(lat, lon);
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      return { session: s, lat, lon, base, key };
    });

    const groups = new Map<string, typeof valid>();
    for (const item of valid) {
      const arr = groups.get(item.key) ?? [];
      arr.push(item);
      groups.set(item.key, arr);
    }

    const scaleSpread = Math.max(0.32, view.w / MAP_W);
    const out: Array<{
      session: SessionRow;
      lat: number;
      lon: number;
      x: number;
      y: number;
      anchorX: number;
      anchorY: number;
      isLive: boolean;
      isSelf: boolean;
    }> = [];

    for (const arr of groups.values()) {
      arr.forEach((item, idx) => {
        let offsetX = 0;
        let offsetY = 0;
        if (arr.length > 1) {
          const angle = (idx / arr.length) * Math.PI * 2 - Math.PI / 4;
          const radius = 11 * scaleSpread;
          offsetX = Math.cos(angle) * radius;
          offsetY = Math.sin(angle) * radius;
        }
        out.push({
          session: item.session,
          lat: item.lat,
          lon: item.lon,
          x: item.base.x + offsetX,
          y: item.base.y + offsetY,
          anchorX: item.base.x,
          anchorY: item.base.y,
          isLive: now - item.session.lastSeenAt < 35_000,
          isSelf: item.session.id === currentSessionId,
        });
      });
    }
    /* Tegn valgt klient øverst */
    return out.sort((a, b) => (a.session.id === selectedId ? 1 : b.session.id === selectedId ? -1 : 0));
  }, [sessions, view.w, now, currentSessionId, selectedId]);

  const selectedNode = nodes.find((n) => n.session.id === selectedId) ?? nodes[nodes.length - 1] ?? null;
  const hoveredNode = hoveredId ? nodes.find((n) => n.session.id === hoveredId) ?? null : null;

  /* Skaler markør-størrelse efter zoom-niveau så pins altid står skarpt */
  const k = view.w / MAP_W;

  const clampView = (nx: number, ny: number, nw: number, nh: number): ViewBox => {
    const w = Math.max(90, Math.min(MAP_W, nw));
    const h = (w / MAP_W) * MAP_H;
    const x = Math.max(0, Math.min(MAP_W - w, nx));
    const y = Math.max(0, Math.min(MAP_H - h, ny));
    return { x, y, w, h };
  };

  const zoomBy = (factor: number) => {
    setView((v) => {
      const nw = v.w * factor;
      const nh = (nw / MAP_W) * MAP_H;
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return clampView(cx - nw / 2, cy - nh / 2, nw, nh);
    });
  };

  const focusSelected = () => {
    if (!selectedNode) return;
    const nw = 210;
    const nh = (nw / MAP_W) * MAP_H;
    setView(clampView(selectedNode.anchorX - nw / 2, selectedNode.anchorY - nh / 2, nw, nh));
  };

  /* længde- og breddegrader */
  const lonLines = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const latLines = [60, 30, 0, -30];

  return (
    <div className="relative overflow-hidden rounded-xl border border-line/80 bg-[#030d12]">
      {/* top-HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-ink-950/90 px-3 py-2 text-[10px]">
        <div className="flex items-center gap-2 tracking-[0.18em] text-teal-glow">
          <span className="inline-block h-2 w-2 rounded-full bg-lime-acid shadow-[0_0_8px_var(--color-lime-acid)]" />
          <span className="font-bold">GEOIP // VERDENSKORT</span>
          <span className="text-dim">
            · {sessions.length} {sessions.length === 1 ? "KLIENT" : "KLIENTER"} REGISTRERET
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setView(WORLD_VIEW)}
            className={`rounded border px-2 py-0.5 text-[9.5px] font-bold tracking-[0.12em] transition ${
              view.w >= MAP_W - 5
                ? "border-teal-glow/70 bg-teal-deep/25 text-teal-glow"
                : "border-line/60 text-dim hover:border-teal-deep hover:text-bone"
            }`}
          >
            VERDEN
          </button>
          <button
            type="button"
            onClick={() => setView(EUROPE_VIEW)}
            className="rounded border border-line/60 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.12em] text-dim transition hover:border-teal-deep hover:text-bone"
          >
            EUROPA
          </button>
          <button
            type="button"
            onClick={focusSelected}
            className="rounded border border-lime-acid/50 bg-lime-acid/10 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.12em] text-lime-acid transition hover:bg-lime-acid/20"
          >
            ◎ VALGT KLIENT
          </button>
          <div className="ml-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => zoomBy(0.68)}
              aria-label="Zoom ind"
              className="grid h-5 w-5 place-items-center rounded border border-line/70 bg-ink-900 text-[11px] font-bold text-bone hover:border-teal-glow hover:text-teal-glow"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.45)}
              aria-label="Zoom ud"
              className="grid h-5 w-5 place-items-center rounded border border-line/70 bg-ink-900 text-[11px] font-bold text-bone hover:border-teal-glow hover:text-teal-glow"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* selve SVG-kortet */}
      <div className="relative select-none">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="block h-auto w-full cursor-grab active:cursor-grabbing"
          style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-node]")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              vx: view.x,
              vy: view.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d || !svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const dxPx = e.clientX - d.startX;
            const dyPx = e.clientY - d.startY;
            if (Math.hypot(dxPx, dyPx) > 3) d.moved = true;
            const dx = (dxPx / Math.max(1, rect.width)) * view.w;
            const dy = (dyPx / Math.max(1, rect.height)) * view.h;
            setView((v) => clampView(d.vx - dx, d.vy - dy, v.w, v.h));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          <defs>
            <radialGradient id="oceanGlow" cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#07222b" />
              <stop offset="60%" stopColor="#041319" />
              <stop offset="100%" stopColor="#02090c" />
            </radialGradient>
            <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d3540" />
              <stop offset="100%" stopColor="#07222a" />
            </linearGradient>
          </defs>

          {/* hav-baggrund */}
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#oceanGlow)" />

          {/* graticule (længde-/breddegradslinjer) */}
          <g stroke="#124654" strokeWidth={0.6 * k} strokeDasharray={`${2.5 * k} ${3.5 * k}`} opacity={0.45}>
            {lonLines.map((lon) => {
              const { x } = projectLatLon(0, lon);
              return <line key={`lon-${lon}`} x1={x} y1={0} x2={x} y2={MAP_H} />;
            })}
            {latLines.map((lat) => {
              const { y } = projectLatLon(lat, 0);
              return <line key={`lat-${lat}`} x1={0} y1={y} x2={MAP_W} y2={y} />;
            })}
          </g>

          {/* ækvator */}
          {(() => {
            const eq = projectLatLon(0, 0);
            return (
              <line
                x1={0}
                y1={eq.y}
                x2={MAP_W}
                y2={eq.y}
                stroke="#1ee0cf"
                strokeWidth={0.7 * k}
                opacity={0.22}
              />
            );
          })()}

          {/* kontinenter & øer */}
          <path
            d={LAND_PATH}
            fill="url(#landFill)"
            stroke="#19a8a0"
            strokeWidth={0.9 * k}
            strokeLinejoin="round"
          />

          {/* landegrænser */}
          <path
            d={BORDER_PATH}
            fill="none"
            stroke="#1ee0cf"
            strokeWidth={0.45 * k}
            strokeOpacity={0.32}
            strokeLinejoin="round"
          />

          {/* sigtekorn på valgt klient */}
          {selectedNode && (
            <g pointerEvents="none" opacity={0.65}>
              <line
                x1={selectedNode.x}
                y1={0}
                x2={selectedNode.x}
                y2={MAP_H}
                stroke="#a6f53c"
                strokeWidth={0.6 * k}
                strokeDasharray={`${3 * k} ${3 * k}`}
                opacity={0.45}
              />
              <line
                x1={0}
                y1={selectedNode.y}
                x2={MAP_W}
                y2={selectedNode.y}
                stroke="#a6f53c"
                strokeWidth={0.6 * k}
                strokeDasharray={`${3 * k} ${3 * k}`}
                opacity={0.45}
              />
            </g>
          )}

          {/* klient-noder */}
          {nodes.map((n) => {
            const active = n.session.id === selectedId;
            const color = active ? "#a6f53c" : n.isLive ? "#1ee0cf" : "#ffb422";
            const rCore = (active ? 5.6 : 4.4) * k;
            const rRing = (active ? 12 : 8.5) * k;

            return (
              <g
                key={n.session.id}
                data-node="1"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  audio.play("blip");
                  onSelect(n.session.id);
                }}
                onMouseEnter={() => setHoveredId(n.session.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === n.session.id ? null : prev))}
              >
                {/* anker-streg hvis flere på samme koordinat */}
                {(n.x !== n.anchorX || n.y !== n.anchorY) && (
                  <line
                    x1={n.anchorX}
                    y1={n.anchorY}
                    x2={n.x}
                    y2={n.y}
                    stroke={color}
                    strokeWidth={0.8 * k}
                    strokeOpacity={0.55}
                  />
                )}

                {/* puls-halo */}
                {(n.isLive || active) && (
                  <circle cx={n.x} cy={n.y} r={rRing} fill="none" stroke={color} strokeWidth={1.1 * k}>
                    <animate
                      attributeName="r"
                      values={`${rCore};${rRing * 1.65}`}
                      dur={active ? "1.8s" : "2.6s"}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.85;0"
                      dur={active ? "1.8s" : "2.6s"}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* klik-ramme (større usynlig cirkel så den er nem at ramme) */}
                <circle cx={n.x} cy={n.y} r={14 * k} fill="transparent" />

                {/* ydre ring */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={rRing * 0.72}
                  fill="#031015"
                  fillOpacity={0.85}
                  stroke={color}
                  strokeWidth={(active ? 1.8 : 1.1) * k}
                />

                {/* kerne */}
                <circle cx={n.x} cy={n.y} r={rCore} fill={color} />
              </g>
            );
          })}
        </svg>

        {/* bund-info overlay over kortet */}
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex flex-wrap items-end justify-between gap-2 text-[10px]">
          <div className="rounded-md border border-line/70 bg-ink-950/90 px-2.5 py-1.5 backdrop-blur-sm">
            { (hoveredNode ?? selectedNode) ? (
              (() => {
                const target = (hoveredNode ?? selectedNode)!;
                const s = target.session;
                return (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className="font-bold text-lime-acid">
                      {countryFlag(s.countryCode)} {s.city || "Ukendt by"}
                      {s.country ? `, ${s.country}` : ""}
                    </span>
                    <span className="text-info-blue">{s.ip ?? "ukendt IP"}</span>
                    <span className="tabular-nums text-dim">
                      ({target.lat.toFixed(2)}°, {target.lon.toFixed(2)}°)
                    </span>
                    {target.isSelf && (
                      <span className="rounded bg-teal-deep/30 px-1.5 py-0.2 text-[9px] font-bold text-teal-glow">
                        DENNE ENHED
                      </span>
                    )}
                  </div>
                );
              })()
            ) : (
              <span className="text-dim">klik på en klient på kortet for at inspicere</span>
            )}
          </div>

          <div className="hidden items-center gap-3 rounded-md border border-line/60 bg-ink-950/85 px-2.5 py-1 text-[9.5px] text-dim sm:flex">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-lime-acid" /> Valgt
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-teal-glow" /> Aktiv nu
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-sun" /> Tidligere besøg
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
