import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDaySchedulesInRange, upsertDaySchedule, deleteDaySchedule } from "@/lib/orders";

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

  const schedules = await getDaySchedulesInRange(start, end);
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { day, is_open, capacity_override, reason } = await req.json();

  if (!day || !DATE_RE.test(day)) {
    return NextResponse.json({ error: "Campo 'day' obrigatório, formato YYYY-MM-DD." }, { status: 400 });
  }

  const result = await upsertDaySchedule(day, is_open, capacity_override, reason);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");

  if (!day || !DATE_RE.test(day)) {
    return NextResponse.json({ error: "Parâmetro 'day' obrigatório, formato YYYY-MM-DD." }, { status: 400 });
  }

  const success = await deleteDaySchedule(day);
  if (!success) {
    return NextResponse.json({ error: "Falha ao deletar agendamento." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
