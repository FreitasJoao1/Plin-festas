import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { setHomeTrustCards } from "@/lib/site-content";
import { validateHomeTrustCards } from "@/lib/validate-site-content";

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const rawBody = await req.json().catch(() => null);
  const validated = validateHomeTrustCards(rawBody);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const result = await setHomeTrustCards(validated.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
