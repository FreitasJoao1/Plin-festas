import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getAllHomeContent, setHomeHero } from "@/lib/site-content";
import { validateHomeHero, validateImageDimensions } from "@/lib/validate-site-content";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const content = await getAllHomeContent();
  return NextResponse.json(content);
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const rawBody = await req.json().catch(() => null);
  const validated = validateHomeHero(rawBody);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const imageCheck = await validateImageDimensions(validated.data.image_url);
  if ("error" in imageCheck) return NextResponse.json({ error: imageCheck.error }, { status: 400 });

  const result = await setHomeHero(validated.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
