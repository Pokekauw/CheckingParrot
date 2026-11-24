"use client";

import { useEffect, useState } from "react";
import type { Mood } from "@/lib/game";

type Props = {
  mood: Mood;
  scale: number;
  accessories: string[];
  talking: boolean;
  flapKey: number;
  level: number;
};

export function Parrot({ mood, scale, accessories, talking, flapKey, level }: Props) {
  const [blink, setBlink] = useState(false);
  const has = (a: string) => accessories.includes(a);
  const sleeping = mood === "sover";

  useEffect(() => {
    if (sleeping) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        loop();
      }, 2200 + Math.random() * 4200);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [sleeping]);

  const crestLift = mood === "ecstatic" ? -16 : mood === "glad" ? -8 : mood === "ked" || mood === "traet" ? 8 : 0;
  const beakOpen = talking || mood === "ecstatic" || mood === "sulten";
  const dirty = mood === "beskidt";

  const eyeClosed = sleeping || blink;

  return (
    <svg
      viewBox="0 0 320 360"
      className="h-full w-full overflow-visible"
      style={{
        filter: `drop-shadow(0 26px 34px rgba(0,0,0,.55)) drop-shadow(0 0 26px rgba(30,224,207,${
          mood === "ecstatic" ? 0.4 : 0.22
        }))`,
      }}
      aria-label={`Papegøje, humør: ${mood}, level ${level}`}
      role="img"
    >
      <defs>
        <linearGradient id="gBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2ff0dc" />
          <stop offset="52%" stopColor="#12b8ae" />
          <stop offset="100%" stopColor="#075f66" />
        </linearGradient>
        <linearGradient id="gHead" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#4affea" />
          <stop offset="60%" stopColor="#17c8bd" />
          <stop offset="100%" stopColor="#0a7f83" />
        </linearGradient>
        <linearGradient id="gWing" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#a6f53c" />
          <stop offset="55%" stopColor="#19c8b4" />
          <stop offset="100%" stopColor="#0a7f83" />
        </linearGradient>
        <linearGradient id="gT1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb422" />
          <stop offset="100%" stopColor="#ff2f8e" />
        </linearGradient>
        <linearGradient id="gT2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3aa5ff" />
          <stop offset="100%" stopColor="#1ee0cf" />
        </linearGradient>
        <linearGradient id="gT3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a6f53c" />
          <stop offset="100%" stopColor="#0a7f83" />
        </linearGradient>
        <linearGradient id="gBeak" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ffd06a" />
          <stop offset="45%" stopColor="#f2952a" />
          <stop offset="100%" stopColor="#7a3d0d" />
        </linearGradient>
        <linearGradient id="gPerch" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a2b33" />
          <stop offset="35%" stopColor="#12525d" />
          <stop offset="100%" stopColor="#071c22" />
        </linearGradient>
        <linearGradient id="gCape" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#ff2f8e" />
          <stop offset="100%" stopColor="#6d0f45" />
        </linearGradient>
        <radialGradient id="gGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#1ee0cf" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#1ee0cf" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* aura */}
      <ellipse cx="168" cy="205" rx="140" ry="150" fill="url(#gGlow)" opacity={mood === "ecstatic" ? 0.85 : 0.45} />

      {/* ---------------- pind / terminal-prompt ---------------- */}
      <g>
        <rect x="14" y="300" width="292" height="20" rx="10" fill="url(#gPerch)" stroke="#16505e" />
        <rect x="14" y="300" width="292" height="7" rx="4" fill="#1ee0cf" opacity="0.12" />
        <text
          x="30"
          y="314"
          fill="#6ee7db"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          letterSpacing="0.5"
          opacity="0.9"
        >
          parrot@buddy:~$
        </text>
        <rect x="140" y="304" width="7" height="12" fill="#a6f53c">
          <animate attributeName="opacity" values="1;1;0;0" dur="1.1s" repeatCount="indefinite" />
        </rect>
      </g>

      <g transform={`translate(168 254) scale(${scale}) translate(-168 -254)`}>
      <g
        className={sleeping ? "" : "anim-bob"}
        style={{ transformOrigin: "168px 240px", transformBox: "view-box" }}
      >
        {/* ---------------- kappe ---------------- */}
        {has("cape") && (
          <g className="anim-sway" style={{ transformOrigin: "180px 160px", transformBox: "view-box" }}>
            <path
              d="M186 152 C 236 168 252 226 244 292 L 200 292 C 214 236 210 188 178 160 Z"
              fill="url(#gCape)"
              opacity="0.92"
            />
            <path d="M200 292 L 244 292 L 236 302 L 206 300 Z" fill="#ff2f8e" opacity="0.6" />
          </g>
        )}

        {/* ---------------- halefjer ---------------- */}
        <g
          className={sleeping ? "" : "anim-tail"}
          style={{ transformOrigin: "198px 250px", transformBox: "view-box" }}
        >
          <path d="M196 246 C 226 268 252 302 266 336 L 240 332 C 224 302 206 278 184 262 Z" fill="url(#gT1)" />
          <path d="M200 252 C 224 278 240 312 246 342 L 222 336 C 212 306 198 280 182 264 Z" fill="url(#gT2)" opacity="0.95" />
          <path d="M192 256 C 208 284 216 316 216 344 L 196 334 C 192 304 184 280 174 264 Z" fill="url(#gT3)" opacity="0.9" />
        </g>

        {/* ---------------- krop ---------------- */}
        <path
          d="M168 128 C 224 128 238 180 232 222 C 226 268 200 294 168 294 C 136 294 108 268 102 222 C 96 180 112 128 168 128 Z"
          fill="url(#gBody)"
        />
        {/* brystlys */}
        <path
          d="M150 150 C 186 152 202 186 198 220 C 195 250 178 268 158 266 C 172 232 172 184 150 150 Z"
          fill="#7ff5e6"
          opacity="0.28"
        />
        {/* fjerstriber */}
        <g stroke="#04343a" strokeWidth="1.6" opacity="0.28" fill="none">
          <path d="M120 210 C 140 220 168 222 196 212" />
          <path d="M124 234 C 144 244 172 246 198 236" />
          <path d="M132 258 C 150 266 176 268 196 258" />
        </g>

        {dirty && (
          <g fill="#6b5a2f" opacity="0.55">
            <ellipse cx="140" cy="250" rx="13" ry="8" />
            <ellipse cx="182" cy="228" rx="9" ry="6" />
            <ellipse cx="158" cy="276" rx="10" ry="5" />
          </g>
        )}

        {/* ---------------- hættetrøje ---------------- */}
        {has("hoodie") && (
          <g>
            <path
              d="M102 200 C 112 258 138 298 168 298 C 198 298 224 258 234 200 C 218 232 192 246 168 246 C 142 246 118 230 102 200 Z"
              fill="#0d2a33"
              stroke="#a6f53c"
              strokeWidth="2"
            />
            <path d="M140 262 h 54 v 20 q -27 10 -54 0 Z" fill="#08202a" stroke="#a6f53c" strokeWidth="1.6" opacity="0.9" />
            <path d="M150 250 l -5 30" stroke="#a6f53c" strokeWidth="3" strokeLinecap="round" />
            <path d="M184 250 l 5 30" stroke="#a6f53c" strokeWidth="3" strokeLinecap="round" />
            <circle cx="145" cy="282" r="3.4" fill="#a6f53c" />
            <circle cx="189" cy="282" r="3.4" fill="#a6f53c" />
          </g>
        )}

        {/* ---------------- vinge ---------------- */}
        <g
          key={flapKey}
          className={flapKey > 0 ? "anim-flap" : ""}
          style={{ transformOrigin: "150px 158px", transformBox: "view-box" }}
        >
          <path
            d="M148 154 C 196 158 216 198 210 240 C 206 270 186 284 166 278 C 188 242 186 194 148 154 Z"
            fill="url(#gWing)"
            stroke="#04343a"
            strokeWidth="2.4"
            strokeOpacity="0.55"
          />
          <path
            d="M148 154 C 196 158 216 198 210 240 C 202 214 184 180 152 162 Z"
            fill="#c9ff6b"
            opacity="0.55"
          />
          <g stroke="#04343a" strokeWidth="1.8" opacity="0.45" fill="none">
            <path d="M162 176 C 182 196 190 222 186 250" />
            <path d="M172 170 C 194 192 202 216 198 240" />
            <path d="M154 190 C 172 210 178 234 176 258" />
          </g>
          <path d="M166 278 C 186 284 206 270 210 240 C 200 262 184 272 166 278 Z" fill="#a6f53c" opacity="0.85" />
        </g>

        {/* ---------------- ben ---------------- */}
        <g stroke="#f2952a" strokeWidth="7" strokeLinecap="round" fill="none">
          <path d="M150 288 L 146 302" />
          <path d="M184 288 L 188 302" />
        </g>
        <g stroke="#ffb422" strokeWidth="4.5" strokeLinecap="round" fill="none">
          <path d="M138 304 q 8 8 16 0" />
          <path d="M180 304 q 8 8 16 0" />
        </g>

        {/* ---------------- hoved ---------------- */}
        <g
          style={{ transformOrigin: "146px 118px", transformBox: "view-box" }}
          className={mood === "ecstatic" ? "anim-sway" : ""}
        >
          {/* hattekam */}
          <g style={{ transform: `translateY(${crestLift}px)`, transition: "transform .4s ease" }}>
            <path d="M150 74 C 140 46 146 24 160 12 C 166 34 162 58 158 76 Z" fill="#ffb422" />
            <path d="M166 76 C 162 46 172 26 188 18 C 188 42 180 62 174 78 Z" fill="#ff2f8e" />
            <path d="M136 80 C 122 58 120 38 128 22 C 140 40 144 60 146 80 Z" fill="#a6f53c" />
          </g>

          {has("hoodie") && (
            <path
              d="M82 134 C 78 60 112 30 150 30 C 190 30 218 60 212 134 C 204 96 182 72 150 72 C 116 72 92 96 82 134 Z"
              fill="#0d2a33"
              stroke="#a6f53c"
              strokeWidth="2"
              opacity="0.96"
            />
          )}

          <circle cx="146" cy="118" r="54" fill="url(#gHead)" />
          {/* kindpatch */}
          <ellipse cx="120" cy="140" rx="14" ry="11" fill="#ff2f8e" opacity="0.42" />
          {/* pandelys */}
          <path d="M120 82 C 140 72 166 76 180 92 C 160 84 138 84 120 82 Z" fill="#b8fff5" opacity="0.35" />

          {/* næb */}
          <g
            transform="translate(-4 0) translate(104 122) scale(1.22) translate(-104 -122)"
            style={{ transformOrigin: "104px 122px" }}
          >
            <path
              d="M106 96 C 82 100 66 118 70 136 C 73 148 88 152 102 146 C 96 130 98 110 106 96 Z"
              fill="url(#gBeak)"
            />
            <path d="M106 96 C 92 104 84 122 86 142 C 78 140 70 132 70 124 C 70 110 86 98 106 96 Z" fill="#ffe4a8" opacity="0.35" />
            <g style={{ transform: beakOpen ? "rotate(15deg)" : "rotate(0deg)", transformOrigin: "104px 140px", transition: "transform .16s ease" }}>
              <path d="M102 140 C 92 146 82 146 74 140 C 82 158 100 160 108 150 Z" fill="#c9711a" />
            </g>
            <circle cx="96" cy="108" r="2.6" fill="#5c2c06" opacity="0.8" />
          </g>

          {/* øje */}
          {eyeClosed ? (
            <g stroke="#04343a" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M112 108 q 15 12 30 0" />
            </g>
          ) : (
            <g>
              <circle cx="127" cy="106" r="17" fill="#eafefb" />
              <circle cx="127" cy="106" r="17" fill="none" stroke="#04343a" strokeWidth="2" opacity="0.5" />
              <circle cx={mood === "ked" ? 124 : 123} cy={mood === "traet" ? 110 : 106} r="9" fill="#05171c" />
              <circle cx="119" cy="100" r="3.6" fill="#ffffff" />
              <circle cx="131" cy="112" r="1.8" fill="#1ee0cf" />
              {mood === "traet" && <path d="M110 96 h 34 v 8 h -34 Z" fill="#0f9d97" opacity="0.95" />}
              {mood === "ecstatic" && (
                <path d="M127 92 l 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 Z" fill="#a6f53c" opacity="0.9" />
              )}
            </g>
          )}

          {/* solbriller */}
          {has("shades") && (
            <g>
              <path d="M100 100 h 56 v 22 q -28 12 -56 0 Z" fill="#061318" stroke="#ff2f8e" strokeWidth="2" />
              <path d="M104 104 l 14 12" stroke="#3aa5ff" strokeWidth="3" opacity="0.75" />
              <path d="M156 104 l 34 -6" stroke="#061318" strokeWidth="6" strokeLinecap="round" />
            </g>
          )}

          {/* headset */}
          {has("headset") && (
            <g>
              <path d="M96 108 C 96 62 196 62 196 108" fill="none" stroke="#0d2a33" strokeWidth="9" strokeLinecap="round" />
              <path d="M96 108 C 96 62 196 62 196 108" fill="none" stroke="#3aa5ff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
              <rect x="176" y="100" width="24" height="34" rx="10" fill="#0d2a33" stroke="#3aa5ff" strokeWidth="2" />
              <path d="M180 132 C 160 152 140 156 124 152" fill="none" stroke="#0d2a33" strokeWidth="5" />
              <circle cx="122" cy="151" r="6" fill="#ff2f8e" />
            </g>
          )}

          {/* krone */}
          {has("crown") && (
            <g>
              <path d="M112 46 L 122 22 L 138 40 L 152 14 L 166 40 L 182 22 L 190 48 Z" fill="#ffb422" stroke="#7a3d0d" strokeWidth="2" />
              <circle cx="152" cy="34" r="4" fill="#ff2f8e" />
              <circle cx="126" cy="40" r="3" fill="#3aa5ff" />
              <circle cx="178" cy="40" r="3" fill="#a6f53c" />
            </g>
          )}
        </g>

        {/* halsbånd med LED-tag */}
        <g transform="rotate(-5 166 166)">
          <rect x="132" y="158" width="66" height="10" rx="5" fill="#08222a" stroke="#1ee0cf" strokeWidth="1.4" opacity="0.95" />
          <path d="M165 168 v 6" stroke="#1ee0cf" strokeWidth="1.6" />
          <circle cx="165" cy="180" r="7.5" fill="#0d2a33" stroke="#a6f53c" strokeWidth="1.4" />
          <circle cx="165" cy="180" r="3.2" fill="#a6f53c">
            <animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>
      </g>

      {/* zzz */}
      {sleeping && (
        <g fill="#3aa5ff" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight="700">
          <text x="212" y="96" fontSize="22" opacity="0.9">
            z
            <animate attributeName="y" values="96;66" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="2.6s" repeatCount="indefinite" />
          </text>
          <text x="234" y="80" fontSize="16" opacity="0.7">
            z
            <animate attributeName="y" values="80;50" dur="2.6s" begin="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="2.6s" begin="0.8s" repeatCount="indefinite" />
          </text>
        </g>
      )}
    </svg>
  );
}