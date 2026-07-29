import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setDayStatusOverride } from "@/lib/orders";
import { DayStatus } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES: DayStatus[] = ["available", "limited", "full", "blocked"];

/**
 * Define o status manual de UM dia específico (available/limited/full/blocked),
 * independente da ocupação calculada da semana. Enviar status="available" (ou
 * null) remove o override e o dia volta a refletir a ocupação real.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const date = body?.date;
  const status = body?.status;

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "'date' é obrigatório, formato YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (status !== null && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `'status' deve ser um de: ${VALID_STATUSES.join(", ")}, ou null.` },
      { status: 400 }
    );
  }

  const result = await setDayStatusOverride(date, status);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
