import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getBookedOrdersInRange, getBookingSettings } from "@/lib/orders";
import { getWeekOccupancies } from "@/lib/orders";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return NextResponse.json(
      { error: "Parâmetros 'start' e 'end' são obrigatórios, formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const [settings, weeks, orders] = await Promise.all([
    getBookingSettings(),
    getWeekOccupancies(start, end),
    getBookedOrdersInRange(start, end),
  ]);

  return NextResponse.json({ settings, weeks, orders });
}
