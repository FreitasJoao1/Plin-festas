import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setWeekCapacityOverride } from "@/lib/orders";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Define a cota de pedidos de UMA semana específica (override), sem alterar
 * o padrão global. Enviar capacity=null remove o override e a semana volta
 * a usar booking_settings.weekly_capacity.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const weekStart = body?.week_start;
  const capacity = body?.capacity;

  if (!weekStart || !DATE_RE.test(weekStart)) {
    return NextResponse.json(
      { error: "'week_start' é obrigatório, formato YYYY-MM-DD (segunda-feira da semana)." },
      { status: 400 }
    );
  }
  if (capacity !== null && (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0)) {
    return NextResponse.json(
      { error: "'capacity' deve ser um número inteiro maior que zero, ou null para remover o override." },
      { status: 400 }
    );
  }

  const result = await setWeekCapacityOverride(weekStart, capacity);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
