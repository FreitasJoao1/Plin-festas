import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rejectBooking, getOrderById } from "@/lib/orders";
import { sendBookingRejectedEmail } from "@/lib/notifications";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, MAX_REASON) : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A justificativa da recusa é obrigatória." },
      { status: 400 }
    );
  }

  let alternativeDate: string | null = null;
  if (b.alternativeDate !== undefined && b.alternativeDate !== null) {
    if (typeof b.alternativeDate !== "string" || !DATE_RE.test(b.alternativeDate)) {
      return NextResponse.json({ error: "Data alternativa inválida." }, { status: 400 });
    }
    alternativeDate = b.alternativeDate;
  }

  const needsRefund = Boolean(b.needsRefund);

  const result = await rejectBooking(id, { reason, alternativeDate, needsRefund });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // Notificação por e-mail é best-effort: se falhar (ex: RESEND_API_KEY
  // não configurada), a recusa em si já foi salva — não desfazemos a
  // ação do admin por causa de um problema de envio de e-mail.
  const order = await getOrderById(id);
  if (order) {
    sendBookingRejectedEmail(order, reason, alternativeDate).catch((err) => {
      console.error("Falha ao enviar e-mail de recusa:", err);
    });
  }

  return NextResponse.json(result);
}
