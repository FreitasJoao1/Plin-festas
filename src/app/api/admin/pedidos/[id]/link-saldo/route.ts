import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getOrderById, markBalancePaymentPending } from "@/lib/orders";
import { createPaymentLink, isInfinitePayConfigured, BALANCE_NSU_SUFFIX } from "@/lib/infinitepay";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://plin-design-zeta.vercel.app";

/**
 * Gera o link de cobrança do SALDO (segunda metade do pagamento
 * fracionado 50/50), disparado manualmente pelo admin (ex: na hora da
 * entrega). Usa order_code + "-SALDO" como NSU, diferente do NSU do
 * sinal, para a InfinitePay tratar como uma transação separada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  if (!isInfinitePayConfigured()) {
    return NextResponse.json({ error: "InfinitePay não está configurada." }, { status: 503 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.payment_plan !== "split_50_50") {
    return NextResponse.json({ error: "Este pedido não é de pagamento fracionado." }, { status: 400 });
  }
  if (order.balance_payment_status === "paid") {
    return NextResponse.json({ error: "O saldo deste pedido já foi pago." }, { status: 409 });
  }

  const orderNsu = `${order.order_code}${BALANCE_NSU_SUFFIX}`;

  const result = await createPaymentLink({
    orderNsu,
    items: [
      {
        product_id: "saldo",
        name: `Saldo restante — Pedido ${order.order_code}`,
        unit_price_cents: order.balance_amount_cents,
        quantity: 1,
      },
    ],
    shippingCents: 0,
    redirectUrl: `${SITE_URL}/checkout/pagamento?order=${order.id}&leg=balance`,
    webhookUrl: `${SITE_URL}/api/pagamento/webhook`,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const marked = await markBalancePaymentPending(order.id);
  if ("error" in marked) {
    console.error("Falha ao marcar balance_payment_status=pending:", marked.error);
  }

  return NextResponse.json({ url: result.url });
}
