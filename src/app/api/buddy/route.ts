import { NextResponse } from "next/server";
import { db } from "@/db";
import { buddies, careLog } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { applyDecay, newBuddy, type BuddyState } from "@/lib/game";

export const dynamic = "force-dynamic";

const BOTS: Array<Partial<BuddyState> & { slug: string; name: string }> = [
  { slug: "bot-nelli", name: "nmap_nelli", level: 14, xp: 120, careSeconds: 5400, actions: 380, skill: 88 },
  { slug: "bot-rocco", name: "root_rocco", level: 11, xp: 60, careSeconds: 3900, actions: 260, skill: 71 },
  { slug: "bot-kali", name: "Kaptajn Kali", level: 9, xp: 210, careSeconds: 2600, actions: 190, skill: 55 },
  { slug: "bot-tux", name: "tux_tiger", level: 7, xp: 30, careSeconds: 1800, actions: 140, skill: 42 },
  { slug: "bot-echo", name: "echo_papegøje", level: 5, xp: 95, careSeconds: 900, actions: 80, skill: 24 },
  { slug: "bot-birb", name: "birb.exe", level: 3, xp: 40, careSeconds: 420, actions: 35, skill: 11 },
];

async function seedBots() {
  try {
    const existing = await db.select({ slug: buddies.slug }).from(buddies).where(eq(buddies.isBot, true));
    if (existing.length >= BOTS.length) return;
    const have = new Set(existing.map((e) => e.slug));
    for (const b of BOTS) {
      if (have.has(b.slug)) continue;
      await db.insert(buddies).values({
        slug: b.slug,
        name: b.name,
        level: b.level ?? 1,
        xp: b.xp ?? 0,
        careSeconds: b.careSeconds ?? 0,
        actions: b.actions ?? 0,
        skill: b.skill ?? 0,
        isBot: true,
        accessories: [],
        achievements: [],
      });
    }
  } catch {
    /* seeding er ikke kritisk */
  }
}

function rowToState(r: typeof buddies.$inferSelect): BuddyState {
  return {
    slug: r.slug,
    name: r.name,
    species: r.species,
    level: r.level,
    xp: r.xp,
    hunger: r.hunger,
    energy: r.energy,
    joy: r.joy,
    hygiene: r.hygiene,
    skill: r.skill,
    asleep: r.asleep,
    careSeconds: r.careSeconds,
    poops: r.poops,
    actions: r.actions,
    accessories: r.accessories ?? [],
    achievements: r.achievements ?? [],
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").slice(0, 64);
  if (!slug) return NextResponse.json({ ok: false, error: "slug mangler" }, { status: 400 });

  try {
    await seedBots();
    const rows = await db.select().from(buddies).where(eq(buddies.slug, slug)).limit(1);
    let state: BuddyState;
    let offlineSeconds = 0;

    if (rows.length === 0) {
      state = newBuddy(slug);
      await db.insert(buddies).values({ slug, name: state.name });
    } else {
      const r = rows[0];
      offlineSeconds = Math.min(8 * 3600, Math.max(0, (Date.now() - r.lastSeen.getTime()) / 1000));
      state = applyDecay(rowToState(r), offlineSeconds);
    }

    const log = await db
      .select()
      .from(careLog)
      .where(eq(careLog.buddySlug, slug))
      .orderBy(desc(careLog.id))
      .limit(40);

    const board = await db
      .select({
        slug: buddies.slug,
        name: buddies.name,
        level: buddies.level,
        careSeconds: buddies.careSeconds,
        isBot: buddies.isBot,
      })
      .from(buddies)
      .orderBy(desc(buddies.level), desc(buddies.careSeconds))
      .limit(8);

    return NextResponse.json({
      ok: true,
      state,
      offlineSeconds: Math.round(offlineSeconds),
      log: log.map((l) => ({ id: l.id, kind: l.kind, label: l.label, xp: l.xp, at: l.at })),
      board,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db-fejl" },
      { status: 500 },
    );
  }
}

type SaveBody = {
  slug?: string;
  state?: BuddyState;
  entry?: { kind: string; label: string; xp: number };
};

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ ok: false, error: "ugyldig json" }, { status: 400 });
  }
  const slug = (body.slug || body.state?.slug || "").slice(0, 64);
  const s = body.state;
  if (!slug || !s) return NextResponse.json({ ok: false, error: "manglende data" }, { status: 400 });

  try {
    const values = {
      slug,
      name: s.name.slice(0, 24),
      level: s.level,
      xp: Math.round(s.xp),
      hunger: s.hunger,
      energy: s.energy,
      joy: s.joy,
      hygiene: s.hygiene,
      skill: s.skill,
      asleep: s.asleep,
      careSeconds: Math.round(s.careSeconds),
      poops: s.poops,
      actions: s.actions,
      accessories: s.accessories,
      achievements: s.achievements,
      lastSeen: new Date(),
    };
    await db
      .insert(buddies)
      .values(values)
      .onConflictDoUpdate({ target: buddies.slug, set: values });

    if (body.entry) {
      await db.insert(careLog).values({
        buddySlug: slug,
        kind: body.entry.kind.slice(0, 24),
        label: body.entry.label.slice(0, 120),
        xp: Math.round(body.entry.xp),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db-fejl" },
      { status: 500 },
    );
  }
}