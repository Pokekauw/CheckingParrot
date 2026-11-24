/* ------------------------------------------------------------------ */
/*  PARROT//BUDDY – spilkernen (ren logik, ingen React)                */
/* ------------------------------------------------------------------ */

export type BuddyState = {
  slug: string;
  name: string;
  species: string;
  level: number;
  xp: number;
  hunger: number;
  energy: number;
  joy: number;
  hygiene: number;
  skill: number;
  asleep: boolean;
  careSeconds: number;
  poops: number;
  actions: number;
  accessories: string[];
  achievements: string[];
};

export type Mood =
  | "ecstatic"
  | "glad"
  | "neutral"
  | "sulten"
  | "traet"
  | "ked"
  | "beskidt"
  | "sover";

export type ActionId =
  | "feed"
  | "fruit"
  | "pet"
  | "play"
  | "train"
  | "bath"
  | "sleep"
  | "clean";

export type ActionDef = {
  id: ActionId;
  label: string;
  sub: string;
  glyph: string;
  cooldown: number;
  xp: number;
  hue: string;
  effects: Partial<Record<"hunger" | "energy" | "joy" | "hygiene" | "skill", number>>;
  particle: string;
  sound: "chirp" | "eat" | "happy" | "clean" | "sleep" | "train";
};

export const ACTIONS: ActionDef[] = [
  {
    id: "feed",
    label: "Frø",
    sub: "solsikkeblanding",
    glyph: "◕",
    cooldown: 6000,
    xp: 5,
    hue: "var(--color-amber-sun)",
    effects: { hunger: 16, joy: 3, hygiene: -2 },
    particle: "crumb",
    sound: "eat",
  },
  {
    id: "fruit",
    label: "Mango",
    sub: "frisk frugt",
    glyph: "❍",
    cooldown: 15000,
    xp: 9,
    hue: "var(--color-magenta-hot)",
    effects: { hunger: 26, joy: 9, energy: 5, hygiene: -3 },
    particle: "heart",
    sound: "eat",
  },
  {
    id: "pet",
    label: "Klø",
    sub: "nakkefjer",
    glyph: "✶",
    cooldown: 4500,
    xp: 4,
    hue: "var(--color-teal-glow)",
    effects: { joy: 12, energy: 2 },
    particle: "heart",
    sound: "happy",
  },
  {
    id: "play",
    label: "Leg",
    sub: "kast med møtrikken",
    glyph: "◈",
    cooldown: 11000,
    xp: 11,
    hue: "var(--color-lime-acid)",
    effects: { joy: 20, energy: -12, hunger: -6 },
    particle: "spark",
    sound: "chirp",
  },
  {
    id: "train",
    label: "Træn",
    sub: "lær ny kommando",
    glyph: "⌘",
    cooldown: 13000,
    xp: 14,
    hue: "var(--color-info-blue)",
    effects: { skill: 9, energy: -9, joy: 5, hunger: -4 },
    particle: "code",
    sound: "train",
  },
  {
    id: "bath",
    label: "Bad",
    sub: "forstøver-tåge",
    glyph: "≈",
    cooldown: 18000,
    xp: 7,
    hue: "var(--color-info-blue)",
    effects: { hygiene: 30, joy: 4, energy: -3 },
    particle: "drop",
    sound: "clean",
  },
  {
    id: "clean",
    label: "Ryd op",
    sub: "tøm bur-bakken",
    glyph: "⌫",
    cooldown: 2500,
    xp: 3,
    hue: "var(--color-ok-green)",
    effects: { hygiene: 12, joy: 2 },
    particle: "spark",
    sound: "clean",
  },
  {
    id: "sleep",
    label: "Sov",
    sub: "dæmp lyset",
    glyph: "☾",
    cooldown: 1200,
    xp: 2,
    hue: "var(--color-magenta-hot)",
    effects: {},
    particle: "zzz",
    sound: "sleep",
  },
];

export const STAGES = [
  { min: 1, key: "kylling", label: "Kylling", scale: 0.72, blurb: "Dunet og nysgerrig" },
  { min: 3, key: "ung", label: "Ungfugl", scale: 0.84, blurb: "Fjerene sætter sig" },
  { min: 6, key: "voksen", label: "Voksen Ara", scale: 0.95, blurb: "Flyver i cirkler" },
  { min: 10, key: "kaptajn", label: "Kaptajn", scale: 1.04, blurb: "Egen SSH-nøgle" },
  { min: 15, key: "root", label: "Root-Ara", scale: 1.12, blurb: "sudo su - parrot" },
] as const;

export type StageDef = (typeof STAGES)[number];

export function stageFor(level: number): StageDef {
  let out: StageDef = STAGES[0];
  for (const s of STAGES) if (level >= s.min) out = s;
  return out;
}

export const ACCESSORIES = [
  { id: "hoodie", label: "Hættetrøje", level: 3, glyph: "▚" },
  { id: "shades", label: "Solbriller", level: 5, glyph: "▬" },
  { id: "headset", label: "Headset", level: 8, glyph: "◠" },
  { id: "crown", label: "Krone", level: 12, glyph: "♛" },
  { id: "cape", label: "Kappe", level: 15, glyph: "▼" },
] as const;

export type AchievementDef = {
  id: string;
  label: string;
  desc: string;
  glyph: string;
  test: (s: BuddyState) => boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first", label: "Første bid", desc: "Udfør din første handling", glyph: "◕", test: (s) => s.actions >= 1 },
  { id: "care25", label: "Håndtam", desc: "25 handlinger i alt", glyph: "✶", test: (s) => s.actions >= 25 },
  { id: "care100", label: "Flockleder", desc: "100 handlinger i alt", glyph: "✷", test: (s) => s.actions >= 100 },
  { id: "t5", label: "5 min sammen", desc: "300 sekunders nærvær", glyph: "◷", test: (s) => s.careSeconds >= 300 },
  { id: "t15", label: "Kvarters ven", desc: "900 sekunders nærvær", glyph: "◴", test: (s) => s.careSeconds >= 900 },
  { id: "lv5", label: "Fjeret femmer", desc: "Nå level 5", glyph: "⑤", test: (s) => s.level >= 5 },
  { id: "lv10", label: "Tocifret", desc: "Nå level 10", glyph: "⑩", test: (s) => s.level >= 10 },
  { id: "skill", label: "Script-kid", desc: "60 i evner", glyph: "⌘", test: (s) => s.skill >= 60 },
  { id: "clean", label: "Blankpudset", desc: "100 i renlighed", glyph: "≈", test: (s) => s.hygiene >= 99.5 },
  { id: "drip", label: "Fuld drip", desc: "Bær 3 accessories", glyph: "▚", test: (s) => s.accessories.length >= 3 },
  { id: "root", label: "Ring 0", desc: "Nå level 15", glyph: "♛", test: (s) => s.level >= 15 },
  { id: "night", label: "Nattevagt", desc: "Læg den til at sove", glyph: "☾", test: (s) => s.asleep },
];

/* ---------------------------- XP / level --------------------------- */

export function xpForLevel(level: number): number {
  return 45 + (level - 1) * 40;
}

export function grantXp(state: BuddyState, amount: number): { state: BuddyState; leveled: number } {
  let xp = state.xp + amount;
  let level = state.level;
  let leveled = 0;
  while (xp >= xpForLevel(level) && level < 99) {
    xp -= xpForLevel(level);
    level += 1;
    leveled += 1;
  }
  return { state: { ...state, xp, level }, leveled };
}

/* ---------------------------- Mood --------------------------------- */

export function moodOf(s: BuddyState): Mood {
  if (s.asleep) return "sover";
  if (s.hygiene < 26) return "beskidt";
  if (s.hunger < 24) return "sulten";
  if (s.energy < 22) return "traet";
  if (s.joy < 28) return "ked";
  const avg = (s.hunger + s.energy + s.joy + s.hygiene) / 4;
  if (avg > 88 && s.joy > 80) return "ecstatic";
  if (avg > 62) return "glad";
  return "neutral";
}

export function wellness(s: BuddyState): number {
  return Math.round((s.hunger + s.energy + s.joy + s.hygiene) / 4);
}

export const MOOD_LABEL: Record<Mood, string> = {
  ecstatic: "Ekstatisk",
  glad: "Glad",
  neutral: "Neutral",
  sulten: "Sulten",
  traet: "Træt",
  ked: "Ked af det",
  beskidt: "Trænger til bad",
  sover: "Sover",
};

/* ---------------------------- Tale --------------------------------- */

const LINES: Record<Mood, string[]> = {
  ecstatic: [
    "SKRIG! Livet er en uendelig loop af glæde!",
    "Jeg har root i mit eget hjerte i dag.",
    "01000110 01001100 01000001 01010000!",
    "Giv mig et keyboard, jeg skriver manifestet.",
  ],
  glad: [
    "Pib. Systemet kører stabilt.",
    "Skal vi nmap'e naboen? Bare for sjov.",
    "Jeg har optimeret min fjerpleje med 12%.",
    "Fortæl mig en hemmelighed, jeg logger den ikke.",
  ],
  neutral: [
    "Uptime er fint. Humøret er... til stede.",
    "Ventede på input. Stadig.",
    "Kan du høre blæseren eller er det mig?",
    "Jeg overvejer at lære bash. Igen.",
  ],
  sulten: [
    "MAVEN RETURNERER 404.",
    "Frø. Nu. Ellers rm -rf på din dag.",
    "Jeg kan se gennem min egen mave.",
    "Sidste måltid var i forrige kerneversion.",
  ],
  traet: [
    "Batteriet på 3%. Øjenlågene tungere end en mainframe.",
    "Lad mig få 20 minutters dvale...",
    "Zzz... compile... zzz...",
    "Jeg blunker i slowmotion nu.",
  ],
  ked: [
    "Ingen har kløet mig i 4 evigheder.",
    "Jeg sidder bare her. I et bur. Af pixels.",
    "Savner dig. Også selvom du er lige der.",
    "Leg. Bare lidt. Please.",
  ],
  beskidt: [
    "Buret trænger til en git clean -fdx.",
    "Der er... lagener af snavs overalt.",
    "Jeg kan ikke finde mine egne fjer.",
    "Bad. Vand. Nu. Tak.",
  ],
  sover: [
    "zzz... /dev/dream ...zzz",
    "zzz... frø... zzz... frø...",
    "zzz... defrag af vinger...",
    "zzz... 8 timers sleep() ...",
  ],
};

const TRAIN_LINES = [
  "sudo giv-mig-frø --nu",
  "nmap -sS 192.168.1.0/24",
  "cat /dev/urandom | pib",
  "whoami → en meget klog fugl",
  "git commit -m 'flap flap'",
  "chmod +x vinger.sh",
  "ping -c 3 hjertet.dit",
  "tail -f /var/log/hunger",
];

export function randomLine(mood: Mood): string {
  const arr = LINES[mood];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomTrainLine(): string {
  return TRAIN_LINES[Math.floor(Math.random() * TRAIN_LINES.length)];
}

export function lineForAction(id: ActionId): string {
  switch (id) {
    case "feed":
      return "Knas. Knas. KNAS. Bedre end kaffe.";
    case "fruit":
      return "MANGO! Du er min yndlingsprocess.";
    case "pet":
      return "Lige dér. Ja. Lige dér. *smelter*";
    case "play":
      return "KAST DEN IGEN! Jeg henter! Måske!";
    case "train":
      return `Lært: ${randomTrainLine()}`;
    case "bath":
      return "Tågebad! Fjerene bliver til silkedyner.";
    case "clean":
      return "Rent bur, rent sind. Tak, makker.";
    case "sleep":
      return "Logger af... ses i morgen, root.";
  }
}

/* ---------------------------- Simulering --------------------------- */

const DECAY_PER_MIN = {
  hunger: 2.1,
  energyAwake: 1.5,
  energyAsleep: -8.5,
  joy: 1.8,
  hygiene: 1.0,
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function applyDecay(state: BuddyState, seconds: number): BuddyState {
  const m = seconds / 60;
  if (m <= 0) return state;
  const next: BuddyState = { ...state };
  next.hunger = clamp(state.hunger - DECAY_PER_MIN.hunger * m);
  next.energy = clamp(
    state.energy - (state.asleep ? DECAY_PER_MIN.energyAsleep : DECAY_PER_MIN.energyAwake) * m,
  );
  next.joy = clamp(state.joy - DECAY_PER_MIN.joy * m * (state.asleep ? 0.35 : 1));
  next.hygiene = clamp(state.hygiene - DECAY_PER_MIN.hygiene * m);
  // sult og snavs æder humøret
  if (next.hunger < 20 || next.hygiene < 20) next.joy = clamp(next.joy - 0.9 * m);
  if (state.asleep && next.energy >= 100) next.asleep = false;
  return next;
}

const NUMERIC_KEYS = ["hunger", "energy", "joy", "hygiene", "skill"] as const;

export function applyAction(state: BuddyState, def: ActionDef): BuddyState {
  const next: BuddyState = { ...state, actions: state.actions + 1 };
  for (const k of NUMERIC_KEYS) {
    const v = def.effects[k];
    if (typeof v === "number") next[k] = clamp(next[k] + v);
  }
  if (def.id === "clean") next.poops = 0;
  if (def.id === "sleep") next.asleep = !state.asleep;
  return next;
}

export function checkAchievements(state: BuddyState): { state: BuddyState; unlocked: AchievementDef[] } {
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state)) unlocked.push(a);
  }
  if (!unlocked.length) return { state, unlocked };
  return {
    state: { ...state, achievements: [...state.achievements, ...unlocked.map((u) => u.id)] },
    unlocked,
  };
}

export function newBuddy(slug: string, name = "Sudo"): BuddyState {
  return {
    slug,
    name,
    species: "Ara Terminalis",
    level: 1,
    xp: 0,
    hunger: 74,
    energy: 88,
    joy: 80,
    hygiene: 94,
    skill: 6,
    asleep: false,
    careSeconds: 0,
    poops: 0,
    actions: 0,
    accessories: [],
    achievements: [],
  };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}t ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}