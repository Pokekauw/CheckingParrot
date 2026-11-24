import { NextResponse } from "next/server";
import { OP_CODE } from "@/lib/opcode";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let code = "";
  try {
    const body = (await req.json()) as { code?: string };
    code = String(body.code ?? "");
  } catch {
    code = "";
  }
  const ok = code === OP_CODE;
  await new Promise((r) => setTimeout(r, ok ? 120 : 420));
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}