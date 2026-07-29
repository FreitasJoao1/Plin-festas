import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSiteCustomization, updateSiteCustomization } from "@/lib/orders";

export async function GET() {
  const customization = await getSiteCustomization();
  if (!customization) {
    return NextResponse.json({ error: "Customização não encontrada" }, { status: 404 });
  }
  return NextResponse.json(customization);
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const updates = await req.json();
  const result = await updateSiteCustomization(updates);
  
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
