/* ------------------------------------------------------------------ */
/*  Telemetri-indsamling: passiv enheds- & browserprofil              */
/*  Ingen tilladelses-dialoger bliver udløst – kun passive API'er.     */
/* ------------------------------------------------------------------ */

export type InfoRow = { k: string; v: string; hot?: boolean };
export type InfoGroup = {
  id: string;
  title: string;
  glyph: string;
  hue: string;
  rows: InfoRow[];
};

export type Snapshot = {
  groups: InfoGroup[];
  flat: Record<string, string>;
  fingerprint: string;
  gpu: string;
  screen: string;
  platform: string;
  timezone: string;
};

export type TelEventType = "click" | "key" | "care" | "sys";

export type TelEvent = {
  id: number;
  type: TelEventType;
  at: number;
  tMs: number;
  x?: number;
  y?: number;
  key?: string;
  target?: string;
  detail?: string;
};

/* ------------------------- typing af browser-API'er ----------------- */

interface Brand {
  brand: string;
  version: string;
}
interface UAData {
  brands?: Brand[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}
interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
interface BatteryInfo {
  level: number;
  charging: boolean;
}
interface NavigatorX extends Navigator {
  userAgentData?: UAData;
  deviceMemory?: number;
  connection?: NetworkInfo;
  mozConnection?: NetworkInfo;
  webkitConnection?: NetworkInfo;
  getBattery?: () => Promise<BatteryInfo>;
  globalPrivacyControl?: boolean;
}
type ScreenX = Screen & {
  orientation?: { type?: string; angle?: number };
};

/* ------------------------------ helpers ----------------------------- */

const yes = (b: boolean | undefined | null) => (b ? "ja" : b === false ? "nej" : "ukendt");

function fnv(str: string, seed = 0x811c9dc5): string {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function gpuInfo(): { vendor: string; renderer: string; version: string } {
  const out = { vendor: "ukendt", renderer: "ukendt", version: "-" };
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return out;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      out.vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) ?? "skjult");
      out.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "skjult");
    }
    out.version = String(gl.getParameter(gl.VERSION) ?? "-");
  } catch {
    /* stille */
  }
  return out;
}

function canvasFingerprint(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return "n/a";
    ctx.textBaseline = "top";
    ctx.font = "16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#0a7f83";
    ctx.fillRect(2, 2, 120, 30);
    ctx.fillStyle = "#ff2f8e";
    ctx.fillText("papegøje🦜ÆØÅ", 4, 8);
    ctx.strokeStyle = "rgba(166,245,60,0.7)";
    ctx.arc(60, 30, 22, 0, Math.PI * 1.6);
    ctx.stroke();
    return fnv(c.toDataURL());
  } catch {
    return "blokeret";
  }
}

async function audioFingerprint(): Promise<string> {
  try {
    const Ctor =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Ctor) return "n/a";
    const ctx = new Ctor(1, 4096, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 1000;
    const comp = ctx.createDynamicsCompressor();
    osc.connect(comp).connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    const data = buf.getChannelData(0);
    let sum = 0;
    for (let i = 2000; i < 3000; i++) sum += Math.abs(data[i]);
    return sum.toFixed(8).slice(-10);
  } catch {
    return "blokeret";
  }
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Ukendt";
}

function detectOS(ua: string): string {
  if (/windows nt 10/i.test(ua)) return "Windows 10/11";
  if (/windows/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Ukendt";
}

/* ------------------------------ main -------------------------------- */

export async function collectSnapshot(): Promise<Snapshot> {
  const nav = navigator as NavigatorX;
  const scr = screen as ScreenX;
  const ua = navigator.userAgent;
  const tz = Intl.DateTimeFormat().resolvedOptions();
  const now = new Date();

  let he: Record<string, unknown> = {};
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      he = await nav.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platformVersion",
        "uaFullVersion",
      ]);
    }
  } catch {
    he = {};
  }

  const gpu = gpuInfo();
  const cfp = canvasFingerprint();
  const afp = await audioFingerprint();

  let battery: BatteryInfo | null = null;
  try {
    if (nav.getBattery) battery = await nav.getBattery();
  } catch {
    battery = null;
  }

  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  const mm = (q: string) => (window.matchMedia ? window.matchMedia(q).matches : false);

  const groups: InfoGroup[] = [
    {
      id: "device",
      title: "Enhed & system",
      glyph: "▣",
      hue: "var(--color-teal-glow)",
      rows: [
        { k: "Operativsystem", v: detectOS(ua), hot: true },
        { k: "Platform", v: nav.userAgentData?.platform || nav.platform || "skjult" },
        { k: "Platform-version", v: String(he.platformVersion || "ikke oplyst") },
        {
          k: "Arkitektur",
          v: he.architecture
            ? `${String(he.architecture)}${he.bitness ? ` · ${String(he.bitness)}-bit` : ""}`
            : "ikke oplyst",
        },
        { k: "Model", v: String(he.model || "desktop / ikke oplyst") },
        { k: "Enhedstype", v: (nav.userAgentData?.mobile ?? /mobi/i.test(ua)) ? "Mobil / Tablet" : "Desktop" },
        { k: "Touch-punkter", v: String(nav.maxTouchPoints ?? 0) },
      ],
    },
    {
      id: "browser",
      title: "Browser & sprog",
      glyph: "◉",
      hue: "var(--color-info-blue)",
      rows: [
        { k: "Browser", v: detectBrowser(ua), hot: true },
        { k: "Fuld version", v: String(he.uaFullVersion || "standard UA") },
        { k: "Sprog", v: navigator.languages?.join(", ") || navigator.language },
        { k: "Tidszone", v: tz.timeZone ?? "ukendt", hot: true },
        {
          k: "UTC-offset",
          v: `UTC${-now.getTimezoneOffset() / 60 >= 0 ? "+" : ""}${-now.getTimezoneOffset() / 60}`,
        },
        { k: "Cookies slået til", v: yes(navigator.cookieEnabled) },
        { k: "User-Agent", v: ua },
      ],
    },
    {
      id: "hardware",
      title: "Skærm & hardware",
      glyph: "⚙",
      hue: "var(--color-amber-sun)",
      rows: [
        { k: "Skærmopløsning", v: `${scr.width} × ${scr.height}`, hot: true },
        { k: "Viewport", v: `${window.innerWidth} × ${window.innerHeight}` },
        { k: "Pixel-ratio (DPR)", v: `${window.devicePixelRatio}x (${scr.colorDepth}-bit)` },
        { k: "CPU-tråde", v: String(navigator.hardwareConcurrency ?? "skjult"), hot: true },
        { k: "RAM (afrundet)", v: nav.deviceMemory ? `${nav.deviceMemory} GB` : "ikke eksponeret" },
        { k: "GPU-renderer", v: gpu.renderer, hot: true },
        { k: "GPU-producent", v: gpu.vendor },
      ],
    },
    {
      id: "privacy",
      title: "Forbindelse & fingeraftryk",
      glyph: "⚿",
      hue: "var(--color-magenta-hot)",
      rows: [
        { k: "Forbindelsestype", v: conn?.effectiveType ?? "ikke eksponeret" },
        {
          k: "Båndbredde / RTT",
          v:
            conn?.downlink != null
              ? `${conn.downlink} Mbit/s · ${conn.rtt ?? "?"} ms`
              : "ikke eksponeret",
        },
        {
          k: "Batteri",
          v: battery ? `${Math.round(battery.level * 100)}% (${battery.charging ? "oplader" : "batteri"})` : "ikke eksponeret",
        },
        { k: "Mørkt tema", v: yes(mm("(prefers-color-scheme: dark)")) },
        { k: "Do Not Track / GPC", v: `${navigator.doNotTrack ?? "ikke sat"} / ${yes(nav.globalPrivacyControl)}` },
        { k: "Canvas-hash", v: cfp },
        { k: "Audio-hash", v: afp },
      ],
    },
  ];

  const stable = [
    ua,
    nav.hardwareConcurrency,
    nav.deviceMemory,
    `${scr.width}x${scr.height}x${scr.colorDepth}`,
    window.devicePixelRatio,
    tz.timeZone,
    navigator.language,
    gpu.renderer,
    cfp,
    afp,
  ].join("|");

  const fingerprint = `${fnv(stable)}-${fnv(stable, 0x1000193)}`.toUpperCase();

  const flat: Record<string, string> = {};
  for (const g of groups) for (const r of g.rows) flat[`${g.id}.${r.k}`] = r.v;

  return {
    groups,
    flat,
    fingerprint,
    gpu: gpu.renderer,
    screen: `${scr.width}×${scr.height}@${window.devicePixelRatio}x`,
    platform: `${detectOS(ua)} · ${detectBrowser(ua)}`,
    timezone: tz.timeZone ?? "ukendt",
  };
}

/* --------------------- pæn beskrivelse af et mål -------------------- */

export function describeTarget(el: EventTarget | null): string {
  if (!(el instanceof Element)) return "document";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const label =
    el.getAttribute("data-track") ||
    el.getAttribute("aria-label") ||
    (el instanceof HTMLElement ? el.innerText?.trim().slice(0, 28) : "") ||
    "";
  const cls =
    typeof el.className === "string" && el.className
      ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`
      : "";
  return `${tag}${id}${cls}${label ? ` «${label}»` : ""}`;
}

export const EVENT_META: Record<TelEventType, { label: string; hue: string; glyph: string }> = {
  click: { label: "KLIK", hue: "var(--color-lime-acid)", glyph: "⊙" },
  key: { label: "TAST", hue: "var(--color-amber-sun)", glyph: "⌨" },
  care: { label: "PLEJE", hue: "var(--color-teal-core)", glyph: "♥" },
  sys: { label: "SYS", hue: "var(--color-teal-glow)", glyph: "▤" },
};
