import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { checkPayment } from "@/lib/infinitepay";
import { markPaymentConfirmed } from "@/lib/orders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consultada pela página de retorno do checkout (/checkout/pagamento)
 * para saber se o pagamento já foi confirmado. Lê o estado gravado no
 * banco (atualizado pelo webhook) — nunca confia nos query params que a
 * InfinitePay manda no redirect, que não têm garantia de assinatura.
 *
 * Se o webhook ainda não chegou mas o cliente já foi redirecionado com
 * sucesso (slug/transaction_nsu presentes na URL), fazemos uma consulta
 * ativa via payment_check aqui mesmo — cobre o caso do webhook atrasar.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order");
  const slug = searchParams.get("slug");
  const transactionNsu = searchParams.get("transaction_nsu");

  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ payment_status: "paid", order_code: order.order_code });
  }

  // Webhook pode não ter chegado ainda — se temos slug+transaction_nsu
  // do redirect, confirma agora mesmo (server-to-server) em vez de fazer
  // o cliente ficar recarregando a página.
  if (slug && transactionNsu) {
    const confirmation = await checkPayment(order.order_code, transactionNsu, slug);
    if (confirmation?.success && confirmation.paid) {
      await markPaymentConfirmed(order.order_code, {
        transactionNsu,
        invoiceSlug: slug,
        paidAmountCents: confirmation.paidAmountCents ?? confirmation.amountCents ?? order.total_cents,
        method: confirmation.captureMethod ?? "pix",
      });
      return NextResponse.json({ payment_status: "paid", order_code: order.order_code });
    }
  }

  return NextResponse.json({ payment_status: order.payment_status, order_code: order.order_code });
}
