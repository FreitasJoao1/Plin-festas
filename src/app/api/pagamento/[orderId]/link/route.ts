import { NextRequest, NextResponse } from "next/server";
import { getOrderByIdForPaymentFlow, markPaymentPending } from "@/lib/orders";
import { createPaymentLink, isInfinitePayConfigured } from "@/lib/infinitepay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isServiceRoleConfigured } from "@/lib/supabase/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://plin-design-zeta.vercel.app";

/**
 * Gera o link de pagamento InfinitePay para um pedido JÁ CRIADO via
 * /api/checkout. Pagamento é sempre uma etapa opcional depois do pedido
 * existir — nunca substitui a criação do pedido em si.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`pagamento-link:${ip}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
  }

  if (!isInfinitePayConfigured()) {
    return NextResponse.json(
      { error: "Pagamento online ainda não está disponível. Finalize pelo WhatsApp." },
      { status: 503 }
    );
  }

  if (!isServiceRoleConfigured()) {
    // Erro de configuração de ambiente, não do cliente — mensagem
    // diferente da genérica de "pedido não encontrado" pra facilitar
    // diagnosticar em produção (ver SUPABASE_SERVICE_ROLE_KEY na Vercel).
    console.error("SUPABASE_SERVICE_ROLE_KEY ausente — fluxo de pagamento online não pode ler pedidos anônimos.");
    return NextResponse.json(
      { error: "Pagamento online temporariamente indisponível (configuração pendente). Finalize pelo WhatsApp." },
      { status: 503 }
    );
  }

  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getOrderByIdForPaymentFlow(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "Este pedido já foi pago." }, { status: 409 });
  }

  // Pagamento fracionado 50/50: o link gerado aqui (checkout) é sempre o
  // do SINAL — cobra só deposit_amount_cents, via um item sintético único
  // em vez do carrinho real, pra não cobrar o valor cheio por engano. O
  // link do SALDO (os outros 50%, na entrega) é gerado depois, separado,
  // por /api/admin/pedidos/[id]/link-saldo — ver esse arquivo.
  const isSplit = order.payment_plan === "split_50_50";
  const linkItems = isSplit
    ? [
        {
          product_id: "sinal",
          name: `Sinal (50%) — Pedido ${order.order_code}`,
          unit_price_cents: order.deposit_amount_cents,
          quantity: 1,
        },
      ]
    : order.items;
  const linkShippingCents = isSplit ? 0 : order.shipping_cents;

  const result = await createPaymentLink({
    orderNsu: order.order_code,
    items: linkItems,
    shippingCents: linkShippingCents,
    redirectUrl: `${SITE_URL}/checkout/pagamento?order=${order.id}`,
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

  const marked = await markPaymentPending(order.id, order.order_code);
  if ("error" in marked) {
    // Não falha a resposta por isto — o link já foi gerado e é o que
    // importa pro cliente. Só loga pra investigar depois.
    console.error("Falha ao marcar payment_status=pending:", marked.error);
  }

  return NextResponse.json({ url: result.url });
}
