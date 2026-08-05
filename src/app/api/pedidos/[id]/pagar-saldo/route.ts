import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createPaymentLink, isInfinitePayConfigured, BALANCE_NSU_SUFFIX } from "@/lib/infinitepay";
import { markBalancePaymentPending } from "@/lib/orders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://plin-design-zeta.vercel.app";

/**
 * Gera o link de cobrança do SALDO (segunda metade do pagamento 50/50),
 * disparado pelo PRÓPRIO cliente na aba "Meus pedidos" — só libera quando
 * o pedido já está "enviado" (saiu para entrega) ou "entregue". Espelha
 * /api/admin/pedidos/[id]/link-saldo, mas checando dono do pedido (via
 * sessão logada) em vez de exigir admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`pagar-saldo:${ip}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase não está configurado neste ambiente (modo demo)." },
      { status: 503 }
    );
  }
  if (!isInfinitePayConfigured()) {
    return NextResponse.json(
      { error: "Pagamento online não está disponível no momento. Fale pelo WhatsApp." },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // RLS (orders_select_own_or_admin) já garante que só o dono ou admin
  // conseguem ler a linha — a checagem de user_id abaixo é só pra dar
  // uma mensagem de erro específica em vez do "não encontrado" genérico.
  const { data: order, error: fetchError } = await supabase!
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json(
      { error: "Este pedido não pertence à sua conta." },
      { status: 403 }
    );
  }
  if (order.payment_plan !== "split_50_50") {
    return NextResponse.json({ error: "Este pedido não é de pagamento fracionado." }, { status: 400 });
  }
  if (order.status !== "enviado" && order.status !== "entregue") {
    return NextResponse.json(
      { error: "O pagamento do saldo libera quando o pedido sai para entrega." },
      { status: 409 }
    );
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
