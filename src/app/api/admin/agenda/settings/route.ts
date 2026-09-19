import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setDailyCapacity } from "@/lib/orders";

/**
 * Define o limite automático de pedidos por dia (booking_settings.daily_capacity).
 * Enviar capacity=null remove o limite. O bloqueio em si é aplicado pelo
 * trigger do banco (enforce_booking_capacity) em todo INSERT/UPDATE de
 * booking_date — não há necessidade de recalcular nada aqui, a próxima
 * leitura da agenda já reflete o novo limite.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const capacity = body?.daily_capacity;

  if (capacity !== null && (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0)) {
    return NextResponse.json(
      { error: "'daily_capacity' deve ser um número inteiro maior que zero, ou null para remover o limite." },
      { status: 400 }
    );
  }

  const result = await setDailyCapacity(capacity);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
