import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uuid,
  bigserial,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  BUDDIES – selve papegøjen                                          */
/* ------------------------------------------------------------------ */

export const buddies = pgTable("buddies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().default("Sudo"),
  species: text("species").notNull().default("Ara Terminalis"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  hunger: real("hunger").notNull().default(72),
  energy: real("energy").notNull().default(84),
  joy: real("joy").notNull().default(78),
  hygiene: real("hygiene").notNull().default(92),
  skill: real("skill").notNull().default(4),
  asleep: boolean("asleep").notNull().default(false),
  careSeconds: integer("care_seconds").notNull().default(0),
  poops: integer("poops").notNull().default(0),
  actions: integer("actions").notNull().default(0),
  accessories: jsonb("accessories").$type<string[]>().notNull().default([]),
  achievements: jsonb("achievements").$type<string[]>().notNull().default([]),
  isBot: boolean("is_bot").notNull().default(false),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careLog = pgTable(
  "care_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    buddySlug: text("buddy_slug").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    xp: integer("xp").notNull().default(0),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_log_slug_idx").on(t.buddySlug)],
);

/* ------------------------------------------------------------------ */
/*  TELEMETRI – bagsiden                                               */
/* ------------------------------------------------------------------ */

export const telemetrySessions = pgTable("telemetry_sessions", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip"),
  country: text("country"),
  countryCode: text("country_code"),
  region: text("region"),
  city: text("city"),
  isp: text("isp"),
  lat: real("lat"),
  lon: real("lon"),
  locSource: text("loc_source"),
  userAgent: text("user_agent"),
  acceptLanguage: text("accept_language"),
  referer: text("referer"),
  timezone: text("timezone"),
  platform: text("platform"),
  screen: text("screen"),
  gpu: text("gpu"),
  fingerprint: text("fingerprint"),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
  clicks: integer("clicks").notNull().default(0),
  keys: integer("keys").notNull().default(0),
  eventCount: integer("event_count").notNull().default(0),
});

export const telemetryEvents = pgTable(
  "telemetry_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: text("session_id").notNull(),
    type: text("type").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    tMs: integer("t_ms").notNull().default(0),
    x: integer("x"),
    y: integer("y"),
    keyName: text("key_name"),
    target: text("target"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("telemetry_events_session_idx").on(t.sessionId)],
);

export type BuddyRow = typeof buddies.$inferSelect;
export type BuddyInsert = typeof buddies.$inferInsert;
export type TelemetrySessionRow = typeof telemetrySessions.$inferSelect;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;
